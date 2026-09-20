import "server-only";

import { z } from "zod";

import { groq, MODELO_ANALISE, RACIOCINIO_OCULTO, textoDaResposta } from "@/lib/groq";
import { promptAnalise } from "@/lib/prompts";
import type { Mensagem, PadraoReferencia, SeveridadeSinal } from "@/lib/types";

const SaidaAnalise = z.object({
  indicios: z.array(
    z.object({
      padraoId: z.string(),
      descricao: z.string(),
      severidadeSinal: z.enum(["baixo", "medio", "alto"]),
      trechoCitado: z.string(),
    }),
  ),
});

export interface IndicioDetectado {
  padrao: PadraoReferencia;
  descricao: string;
  severidadeSinal: SeveridadeSinal;
  trechoCitado: string;
}

export function transcrever(mensagens: Mensagem[], nomeIdoso: string): string {
  return mensagens
    .map((m) => {
      const quem = m.autor === "ia" ? "Nina" : nomeIdoso;
      const hora = new Date(m.timestamp).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `[${hora}] ${quem} (${m.categoriaPergunta}): ${m.texto}`;
    })
    .join("\n");
}

/**
 * Compara a transcrição COMPLETA contra a base de padrões e devolve só os
 * indícios que casam com um padrão existente. Nada de resumo antes da análise:
 * resumir aqui perderia justamente o detalhe que a base procura.
 */
export async function analisarConversa(params: {
  mensagens: Mensagem[];
  nomeIdoso: string;
  padroes: PadraoReferencia[];
}): Promise<IndicioDetectado[]> {
  const { mensagens, nomeIdoso, padroes } = params;
  if (!padroes.length || mensagens.length < 2) return [];

  const porId = new Map(padroes.map((p) => [p.id, p]));
  const transcricao = transcrever(mensagens, nomeIdoso);

  const resposta = await groq().chat.completions.create({
    model: MODELO_ANALISE,
    max_tokens: 8000,
    // Temperatura baixa: aqui não se quer criatividade, se quer aderência à base.
    temperature: 0.2,
    reasoning_format: RACIOCINIO_OCULTO,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: promptAnalise(padroes) },
      {
        role: "user",
        content: `TRANSCRIÇÃO COMPLETA DA CONVERSA COM ${nomeIdoso}:\n\n${transcricao}`,
      },
    ],
  });

  // O modo JSON garante JSON sintático, não o formato certo. O zod é a trava:
  // saída fora do contrato vira zero indício, nunca indício inventado.
  let saida: z.infer<typeof SaidaAnalise>;
  try {
    const validado = SaidaAnalise.safeParse(JSON.parse(textoDaResposta(resposta)));
    if (!validado.success) {
      console.error("[analise] saída fora do contrato", validado.error.issues);
      return [];
    }
    saida = validado.data;
  } catch (e) {
    console.error("[analise] resposta não é JSON válido", e);
    return [];
  }

  // Descarta qualquer indício cujo padraoId não exista na base: a IA não pode
  // inventar padrão, então o que não bate é ruído e não vira registro.
  const vistos = new Set<string>();
  const detectados: IndicioDetectado[] = [];

  for (const bruto of saida.indicios) {
    const padrao = porId.get(bruto.padraoId);
    if (!padrao) {
      console.warn("[analise] padraoId inexistente descartado", bruto.padraoId);
      continue;
    }
    if (vistos.has(padrao.id)) continue; // no máximo um indício por padrão
    vistos.add(padrao.id);
    detectados.push({
      padrao,
      descricao: bruto.descricao,
      severidadeSinal: bruto.severidadeSinal,
      trechoCitado: bruto.trechoCitado,
    });
  }

  return detectados;
}
