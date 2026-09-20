import "server-only";

import Groq from "groq-sdk";

/**
 * Cliente único da Groq. A chave só existe no servidor, nenhuma rota devolve,
 * loga ou repassa o valor de GROQ_API_KEY ao client.
 */
let cliente: Groq | undefined;

export function groq(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY ausente. Defina no .env.local.");
  }
  cliente ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
  return cliente;
}

/*
 * Escolha de modelo.
 *
 * A especificação pedia `llama-3.1-8b-instant` e `llama-3.3-70b-versatile`,
 * mas a Groq não serve mais esses modelos nesta conta (404 model_not_found).
 * Para conferir o catálogo de uma chave:
 *   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
 *
 * O candidato natural para a conversa era o `openai/gpt-oss-20b`, menor e mais
 * barato. Ele foi descartado por instabilidade medida: em 12 chamadas com o
 * prompt real da Nina, 5 falharam com HTTP 400 `tool_use_failed`: o modelo
 * emite um token de canal malformado que a Groq lê como chamada de ferramenta.
 * Na mesma bateria o 120b falhou 0 de 12. Numa tela que um idoso usa sozinho,
 * 40% de erro não se resolve com retry.
 *
 * Os dois papéis ficam então no mesmo modelo, separados pelo esforço de
 * raciocínio: conversa em `low` (respostas de ~50 tokens, rápidas e baratas),
 * análise e relatório no esforço padrão, onde raciocinar paga.
 */

/** Conversa com a Nina: roda a cada mensagem do idoso, com esforço baixo. */
export const MODELO_CONVERSA = "openai/gpt-oss-120b";

/** Análise de indícios e redação do relatório: precisa de mais raciocínio. */
export const MODELO_ANALISE = "openai/gpt-oss-120b";

/**
 * Os modelos gpt-oss raciocinam antes de responder. `hidden` mantém esse
 * rascunho fora da resposta. O idoso não pode ler a IA "pensando" sobre ele,
 * e o relatório não pode carregar raciocínio solto no meio do texto clínico.
 *
 * Atenção: o raciocínio oculto continua consumindo `max_tokens`. Com esforço
 * padrão e teto apertado o modelo gasta a cota inteira pensando e devolve
 * conteúdo VAZIO, sem erro nenhum. Foi o que aconteceu na conversa antes de
 * baixar o esforço. Toda chamada aqui precisa de teto folgado.
 */
export const RACIOCINIO_OCULTO = "hidden" as const;

/**
 * Bater papo não é tarefa de raciocínio: esforço baixo responde em ~50 tokens,
 * mantém a regra de uma pergunta por vez e deixa a conversa mais rápida.
 * A análise e o relatório ficam no esforço padrão, onde o raciocínio paga.
 */
export const ESFORCO_CONVERSA = "low" as const;

/** Junta o texto da resposta; a API devolve uma escolha por requisição. */
export function textoDaResposta(resposta: Groq.Chat.ChatCompletion): string {
  return (resposta.choices[0]?.message?.content ?? "").trim();
}

/**
 * Uma nova tentativa para a fala da Nina.
 *
 * Erro de provedor na tela de conversa vira "a Nina não respondeu" na frente
 * de um idoso sozinho com o tablet. Uma retentativa cobre a falha transitória
 * (429, 5xx, queda de conexão) sem esconder erro real: 400 de requisição
 * malformada sobe na hora, porque repetir não conserta.
 */
export async function comRetentativa<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const status = (e as { status?: number }).status;
    const transitorio = status === undefined || status === 408 || status === 429 || status >= 500;
    if (!transitorio) throw e;

    console.warn("[groq] falha transitória, tentando de novo", status);
    await new Promise((r) => setTimeout(r, 600));
    return fn();
  }
}
