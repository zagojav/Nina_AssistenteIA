import "server-only";

import {
  comRetentativa,
  ESFORCO_CONVERSA,
  groq,
  MODELO_CONVERSA,
  MODELO_ANALISE,
  RACIOCINIO_OCULTO,
  textoDaResposta,
} from "@/lib/groq";
import { INSTRUCAO_ENCERRAMENTO, PROMPT_RESUMO, promptNina } from "@/lib/prompts";
import { db, paths } from "@/lib/firebase/admin";
import { analisarConversa, transcrever } from "@/lib/analise";
import { publicarPdf, redigirRelatorio, salvarRelatorio } from "@/lib/relatorio";
import { CATEGORIAS } from "@/lib/types";
import type {
  CategoriaPergunta,
  Conversa,
  Idoso,
  Indicio,
  Mensagem,
  PadraoReferencia,
} from "@/lib/types";

/** Conversa curta de propósito: 3 a 5 trocas, como manda o roteiro da Nina. */
export const MAX_TROCAS = 5;

export async function carregarIdoso(instituicaoId: string, idosoId: string) {
  const snap = await db().doc(paths.idoso(instituicaoId, idosoId)).get();
  if (!snap.exists) throw new Error("Idoso não encontrado.");
  return { id: snap.id, ...(snap.data() as Omit<Idoso, "id">) } as Idoso;
}

export async function carregarMensagens(
  instituicaoId: string,
  conversaId: string,
): Promise<Mensagem[]> {
  const snap = await db()
    .collection(paths.mensagens(instituicaoId, conversaId))
    .orderBy("timestamp")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Mensagem, "id">) }));
}

/**
 * Escolhe a categoria de foco: a menos visitada nas conversas recentes do
 * idoso, ignorando as já cobertas nesta conversa. Rodízio no servidor — a Nina
 * não faz esse controle, ela só recebe a categoria do dia pronta.
 */
export async function escolherCategoria(
  instituicaoId: string,
  idosoId: string,
  cobertas: CategoriaPergunta[],
): Promise<CategoriaPergunta> {
  const restantes = CATEGORIAS.filter((c) => !cobertas.includes(c));
  const pool = restantes.length ? restantes : CATEGORIAS;

  // O histórico de rodízio vive no próprio doc do idoso (um get), e não numa
  // consulta ordenada sobre `conversas`. A consulta exigiria índice composto,
  // e índice faltando derrubava a conversa inteira num projeto recém-criado —
  // justamente na tela que o idoso usa sozinho.
  const snap = await db().doc(paths.idoso(instituicaoId, idosoId)).get();
  const recentes = (snap.data()?.categoriasRecentes ?? []) as CategoriaPergunta[];

  const uso = new Map<CategoriaPergunta, number>(pool.map((c) => [c, 0]));
  recentes.forEach((c, indice) => {
    // Quanto mais recente, mais pesa — empurra o rodízio para o que faz tempo.
    const peso = Math.max(1, MEMORIA_CATEGORIAS - indice);
    if (uso.has(c)) uso.set(c, (uso.get(c) ?? 0) + peso);
  });

  return [...uso.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

/** Quantas categorias recentes o rodízio leva em conta. */
const MEMORIA_CATEGORIAS = 12;

/** Empilha as categorias desta conversa no histórico de rodízio do idoso. */
function atualizarCategoriasRecentes(
  anteriores: CategoriaPergunta[],
  desta: CategoriaPergunta[],
): CategoriaPergunta[] {
  return [...[...desta].reverse(), ...anteriores].slice(0, MEMORIA_CATEGORIAS);
}

/** Próxima fala da Nina. `encerrando` faz a última fala virar despedida. */
export async function falaDaNina(params: {
  idoso: Idoso;
  mensagens: Mensagem[];
  categoriaAlvo: CategoriaPergunta;
  encerrando: boolean;
}): Promise<string> {
  const { idoso, mensagens, categoriaAlvo, encerrando } = params;

  const system =
    promptNina({
      nomeIdoso: idoso.nome,
      condicoesConhecidas: idoso.condicoesConhecidas ?? [],
      resumoHistorico: idoso.resumoHistorico ?? "",
      categoriaAlvo,
    }) + (encerrando ? INSTRUCAO_ENCERRAMENTO : "");

  const historico = mensagens.map((m) => ({
    role: m.autor === "ia" ? ("assistant" as const) : ("user" as const),
    content: m.texto,
  }));

  // Na abertura não há histórico nenhum, e a API precisa de ao menos uma
  // mensagem além da de sistema — então entra a deixa de início.
  if (!historico.length) {
    historico.push({ role: "user", content: "(início da conversa)" });
  }

  const resposta = await comRetentativa(() =>
    groq().chat.completions.create({
      model: MODELO_CONVERSA,
      // Folga proposital: a fala tem ~50 tokens, o resto é margem para o
      // raciocínio oculto não engolir a resposta.
      max_tokens: 800,
      // Conversa afetuosa pede alguma variação, sem virar imprevisível.
      temperature: 0.7,
      reasoning_format: RACIOCINIO_OCULTO,
      reasoning_effort: ESFORCO_CONVERSA,
      messages: [{ role: "system" as const, content: system }, ...historico],
    }),
  );

  return textoDaResposta(resposta);
}

async function padroesAtivos(): Promise<PadraoReferencia[]> {
  const snap = await db()
    .collection(paths.padroesReferencia())
    .where("ativo", "==", true)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PadraoReferencia, "id">),
  }));
}

async function resumirParaContexto(transcricao: string): Promise<string> {
  const resposta = await groq().chat.completions.create({
    model: MODELO_CONVERSA,
    max_tokens: 800,
    temperature: 0.3,
    reasoning_format: RACIOCINIO_OCULTO,
    reasoning_effort: ESFORCO_CONVERSA,
    messages: [
      { role: "system", content: PROMPT_RESUMO },
      { role: "user", content: transcricao },
    ],
  });
  return textoDaResposta(resposta);
}

/**
 * Fecha a conversa: analisa a transcrição completa contra a base de padrões,
 * grava os indícios, redige o relatório da conversa, gera o PDF e só então
 * resume a conversa — o resumo serve à próxima conversa, nunca à análise.
 */
export async function finalizarConversa(params: {
  instituicaoId: string;
  conversaId: string;
}): Promise<{ relatorioId: string | null; indicios: number }> {
  const { instituicaoId, conversaId } = params;
  const firestore = db();

  const conversaRef = firestore.doc(paths.conversa(instituicaoId, conversaId));
  const conversaSnap = await conversaRef.get();
  if (!conversaSnap.exists) throw new Error("Conversa não encontrada.");
  const conversa = { id: conversaSnap.id, ...(conversaSnap.data() as Omit<Conversa, "id">) };

  const agora = new Date().toISOString();
  if (conversa.status !== "concluida") {
    await conversaRef.update({ status: "concluida", finalizadaEm: agora });
  }

  const [idoso, mensagens, padroes] = await Promise.all([
    carregarIdoso(instituicaoId, conversa.idosoId),
    carregarMensagens(instituicaoId, conversaId),
    padroesAtivos(),
  ]);

  const instSnap = await firestore.doc(paths.instituicao(instituicaoId)).get();
  const instituicaoNome = (instSnap.data()?.nome as string) ?? "Instituição";

  const transcricao = transcrever(mensagens, idoso.nome);
  const detectados = await analisarConversa({ mensagens, nomeIdoso: idoso.nome, padroes });

  // Grava os indícios
  const lote = firestore.batch();
  const indicios: Indicio[] = [];
  for (const d of detectados) {
    const ref = firestore.collection(paths.indicios(instituicaoId)).doc();
    const indicio: Indicio = {
      id: ref.id,
      idosoId: idoso.id,
      conversaId,
      tipo: d.padrao.tipo,
      descricao: d.trechoCitado
        ? `${d.descricao} Trecho: "${d.trechoCitado}".`
        : d.descricao,
      categoriaRelacionada: d.padrao.categoriaRelacionada,
      fonteReferencia: d.padrao.fonteReferencia,
      severidadeSinal: d.severidadeSinal,
      detectadoEm: agora,
      revisadoPeloCurador: false,
    };
    const { id: _id, ...semId } = indicio;
    lote.set(ref, semId);
    indicios.push(indicio);
  }
  await lote.commit();

  // Relatório da conversa
  const conteudo = await redigirRelatorio({
    idoso,
    instituicaoNome,
    indicios,
    tipo: "por_conversa",
    periodoInicio: conversa.iniciadaEm,
    periodoFim: agora,
    transcricao,
    totalConversas: 1,
  });

  const relatorio = await salvarRelatorio(instituicaoId, {
    idosoId: idoso.id,
    curadorId: idoso.curadorResponsavelId,
    tipo: "por_conversa",
    conversaId,
    periodoInicio: conversa.iniciadaEm,
    periodoFim: agora,
    conteudoFormatado: conteudo,
    indiciosIncluidos: indicios.map((i) => i.id),
    pdfUrl: null,
    metodoEnvio: null,
    enviadoEm: null,
    enviadoPara: null,
    status: "gerado",
    criadoEm: agora,
  });

  const caminhoPdf = await publicarPdf({
    instituicaoId,
    relatorioId: relatorio.id,
    idoso,
    instituicaoNome,
    tipo: "por_conversa",
    periodoInicio: conversa.iniciadaEm,
    periodoFim: agora,
    conteudo,
  });

  if (caminhoPdf) {
    await firestore
      .doc(`${paths.relatorios(instituicaoId)}/${relatorio.id}`)
      .update({ pdfUrl: caminhoPdf });
  }

  // Resumo só como contexto da próxima conversa, e o rodízio de categorias
  // fica registrado no doc do idoso para a próxima escolha.
  const resumo = await resumirParaContexto(transcricao);
  await firestore.doc(paths.idoso(instituicaoId, idoso.id)).update({
    resumoHistorico: resumo,
    categoriasRecentes: atualizarCategoriasRecentes(
      (idoso.categoriasRecentes ?? []) as CategoriaPergunta[],
      conversa.categoriasCobertas ?? [],
    ),
  });

  return { relatorioId: relatorio.id, indicios: indicios.length };
}

/** Consolidado diário/semanal: junta os indícios da janela num só relatório. */
export async function consolidar(params: {
  instituicaoId: string;
  idosoId: string;
  tipo: "diario" | "semanal";
  periodoInicio: string;
  periodoFim: string;
}) {
  const { instituicaoId, idosoId, tipo, periodoInicio, periodoFim } = params;
  const firestore = db();

  const [idoso, instSnap, indiciosSnap, conversasSnap] = await Promise.all([
    carregarIdoso(instituicaoId, idosoId),
    firestore.doc(paths.instituicao(instituicaoId)).get(),
    firestore
      .collection(paths.indicios(instituicaoId))
      .where("idosoId", "==", idosoId)
      .where("detectadoEm", ">=", periodoInicio)
      .where("detectadoEm", "<=", periodoFim)
      .get(),
    firestore
      .collection(paths.conversas(instituicaoId))
      .where("idosoId", "==", idosoId)
      .where("iniciadaEm", ">=", periodoInicio)
      .where("iniciadaEm", "<=", periodoFim)
      .get(),
  ]);

  const indicios = indiciosSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Indicio, "id">),
  }));

  const instituicaoNome = (instSnap.data()?.nome as string) ?? "Instituição";
  const conteudo = await redigirRelatorio({
    idoso,
    instituicaoNome,
    indicios,
    tipo,
    periodoInicio,
    periodoFim,
    totalConversas: conversasSnap.size,
  });

  const relatorio = await salvarRelatorio(instituicaoId, {
    idosoId,
    curadorId: idoso.curadorResponsavelId,
    tipo,
    conversaId: null,
    periodoInicio,
    periodoFim,
    conteudoFormatado: conteudo,
    indiciosIncluidos: indicios.map((i) => i.id),
    pdfUrl: null,
    metodoEnvio: null,
    enviadoEm: null,
    enviadoPara: null,
    status: "gerado",
    criadoEm: new Date().toISOString(),
  });

  const caminhoPdf = await publicarPdf({
    instituicaoId,
    relatorioId: relatorio.id,
    idoso,
    instituicaoNome,
    tipo,
    periodoInicio,
    periodoFim,
    conteudo,
  });

  if (caminhoPdf) {
    await firestore
      .doc(`${paths.relatorios(instituicaoId)}/${relatorio.id}`)
      .update({ pdfUrl: caminhoPdf });
  }

  return { ...relatorio, pdfUrl: caminhoPdf };
}

export { MODELO_ANALISE };
