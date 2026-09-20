import { db, paths } from "@/lib/firebase/admin";
import { lerSessaoIdoso } from "@/lib/session";
import type { SessaoJogo } from "@/lib/types";

/**
 * Grava a partida jogada. A performance fica isolada por enquanto: ainda não
 * alimenta o motor de indícios, que só trabalha sobre transcrição de conversa.
 */
export async function POST(req: Request) {
  const sessao = await lerSessaoIdoso();
  if (!sessao) return Response.json({ erro: "Sem sessão." }, { status: 401 });

  const corpo = await req.json();
  const { jogoId, pontuacao, acertos, erros, tempoMedioResposta, dificuldade, iniciadaEm } = corpo;

  if (typeof jogoId !== "string") {
    return Response.json({ erro: "jogoId ausente." }, { status: 400 });
  }

  const agora = new Date().toISOString();
  const registro: Omit<SessaoJogo, "id"> = {
    jogoId,
    iniciadaEm: typeof iniciadaEm === "string" ? iniciadaEm : agora,
    finalizadaEm: agora,
    pontuacao: Number(pontuacao) || 0,
    acertos: Number(acertos) || 0,
    erros: Number(erros) || 0,
    tempoMedioResposta: Number(tempoMedioResposta) || 0,
    dificuldade: ["facil", "medio", "dificil"].includes(dificuldade) ? dificuldade : "facil",
  };

  const ref = await db()
    .collection(paths.sessoesJogo(sessao.instituicaoId, sessao.idosoId))
    .add(registro);

  return Response.json({ id: ref.id, ok: true }, { status: 201 });
}
