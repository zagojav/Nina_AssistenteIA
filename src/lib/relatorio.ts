import "server-only";

import { groq, MODELO_ANALISE, RACIOCINIO_OCULTO, textoDaResposta } from "@/lib/groq";
import { PROMPT_RELATORIO } from "@/lib/prompts";
import { bucket, db, paths } from "@/lib/firebase/admin";
import { gerarPdf } from "@/lib/pdf";
import { CATEGORIA_LABEL } from "@/lib/types";
import type { Idoso, Indicio, Relatorio } from "@/lib/types";

const SEVERIDADE_LABEL = {
  baixo: "sinal baixo",
  medio: "sinal médio",
  alto: "sinal alto",
} as const;

function dataBr(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function idade(dataNascimento: string) {
  const n = new Date(dataNascimento);
  if (Number.isNaN(n.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) anos--;
  return anos;
}

/** Redige o texto do relatório a partir dos indícios já validados contra a base. */
export async function redigirRelatorio(params: {
  idoso: Idoso;
  instituicaoNome: string;
  indicios: Indicio[];
  tipo: Relatorio["tipo"];
  periodoInicio: string;
  periodoFim: string;
  transcricao?: string;
  totalConversas: number;
}): Promise<string> {
  const {
    idoso,
    instituicaoNome,
    indicios,
    tipo,
    periodoInicio,
    periodoFim,
    transcricao,
    totalConversas,
  } = params;

  const anos = idade(idoso.dataNascimento);
  const listaIndicios = indicios.length
    ? indicios
        .map(
          (i, n) =>
            `${n + 1}. tipo: ${i.tipo}\n   categoria: ${CATEGORIA_LABEL[i.categoriaRelacionada]}\n   observação: ${i.descricao}\n   intensidade do sinal: ${SEVERIDADE_LABEL[i.severidadeSinal]}\n   fonte: ${i.fonteReferencia}\n   registrado em: ${dataBr(i.detectadoEm)}`,
        )
        .join("\n\n")
    : "Nenhum indício correspondente à base de referência foi registrado no período.";

  const rotuloTipo = {
    por_conversa: "relatório de conversa única",
    diario: "consolidado diário",
    semanal: "consolidado semanal",
  }[tipo];

  const entrada = [
    `TIPO DE RELATÓRIO: ${rotuloTipo}`,
    `INSTITUIÇÃO: ${instituicaoNome}`,
    `RESIDENTE: ${idoso.nome} ${idoso.sobrenome}${anos !== null ? `, ${anos} anos` : ""}, quarto ${idoso.quartoNumero || "não informado"}`,
    `CONDIÇÕES JÁ CONHECIDAS E REGISTRADAS PELA EQUIPE: ${idoso.condicoesConhecidas.length ? idoso.condicoesConhecidas.join(", ") : "nenhuma registrada"}`,
    `PERÍODO: ${dataBr(periodoInicio)} a ${dataBr(periodoFim)}`,
    `CONVERSAS NO PERÍODO: ${totalConversas}`,
    "",
    "INDÍCIOS REGISTRADOS (já validados contra a base de referência, não acrescente outros):",
    listaIndicios,
    transcricao ? `\nTRANSCRIÇÃO DA CONVERSA (contexto para descrever a coleta):\n${transcricao}` : "",
  ].join("\n");

  const resposta = await groq().chat.completions.create({
    model: MODELO_ANALISE,
    max_tokens: 8000,
    // Documento de acompanhamento: texto previsível, não texto criativo.
    temperature: 0.3,
    reasoning_format: RACIOCINIO_OCULTO,
    messages: [
      { role: "system", content: PROMPT_RELATORIO },
      { role: "user", content: entrada },
    ],
  });

  return textoDaResposta(resposta);
}

/** Monta os bytes do PDF a partir do texto já redigido. */
export async function montarPdf(params: {
  idoso: Idoso;
  instituicaoNome: string;
  tipo: Relatorio["tipo"];
  periodoInicio: string;
  periodoFim: string;
  conteudo: string;
}): Promise<Uint8Array> {
  const titulo = {
    por_conversa: "Relatório de acompanhamento: conversa",
    diario: "Relatório de acompanhamento: consolidado diário",
    semanal: "Relatório de acompanhamento: consolidado semanal",
  }[params.tipo];

  return gerarPdf({
    tituloDocumento: titulo,
    instituicao: params.instituicaoNome,
    idoso: `${params.idoso.nome} ${params.idoso.sobrenome}`,
    periodo: `${dataBr(params.periodoInicio)} a ${dataBr(params.periodoFim)}`,
    geradoEm: dataBr(new Date().toISOString()),
    conteudo: params.conteudo,
  });
}

/**
 * Gera o PDF, sobe no Storage privado e devolve o caminho do objeto.
 *
 * Devolve `null` se o Storage falhar, bucket ainda não criado no projeto, por
 * exemplo. O documento de verdade é o texto já gravado no Firestore; o PDF é
 * uma renderização dele e pode ser refeito na hora do download. Derrubar o
 * pipeline aqui custaria a análise e o resumo da conversa inteira.
 */
export async function publicarPdf(params: {
  instituicaoId: string;
  relatorioId: string;
  idoso: Idoso;
  instituicaoNome: string;
  tipo: Relatorio["tipo"];
  periodoInicio: string;
  periodoFim: string;
  conteudo: string;
}): Promise<string | null> {
  // Caminho privado: o Storage nunca é lido direto pelo browser, só pela rota
  // de download que autentica o curador e grava o log de acesso.
  const caminho = `relatorios/${params.instituicaoId}/${params.idoso.id}/${params.relatorioId}.pdf`;

  try {
    const bytes = await montarPdf(params);
    await bucket()
      .file(caminho)
      .save(Buffer.from(bytes), {
        contentType: "application/pdf",
        metadata: { cacheControl: "private, max-age=0, no-store" },
      });
    return caminho;
  } catch (e) {
    console.error("[relatorio] PDF não foi para o Storage; segue sem arquivo", e);
    return null;
  }
}

/** Link temporário para compartilhamento pontual (e-mail/WhatsApp). */
export async function linkTemporario(caminho: string, minutos = 30) {
  const [url] = await bucket()
    .file(caminho)
    .getSignedUrl({ action: "read", expires: Date.now() + minutos * 60_000 });
  return url;
}

export async function lerPdf(caminho: string) {
  const [buffer] = await bucket().file(caminho).download();
  return buffer;
}

/** Grava o relatório e retorna o doc criado. */
export async function salvarRelatorio(
  instituicaoId: string,
  dados: Omit<Relatorio, "id">,
) {
  const ref = await db().collection(paths.relatorios(instituicaoId)).add(dados);
  return { id: ref.id, ...dados } as Relatorio;
}
