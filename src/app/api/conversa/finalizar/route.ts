import { lerSessaoIdoso } from "@/lib/session";
import { db, paths } from "@/lib/firebase/admin";
import { finalizarConversa } from "@/lib/conversa";
import type { Conversa } from "@/lib/types";

// Análise + relatório + PDF numa chamada só; precisa de folga de tempo.
export const maxDuration = 300;

/**
 * Encerra a conversa e dispara análise, indícios, relatório e PDF.
 */
export async function POST(req: Request) {
  const sessao = await lerSessaoIdoso();
  if (!sessao) return Response.json({ erro: "Sem sessão." }, { status: 401 });

  const { conversaId } = await req.json();
  if (typeof conversaId !== "string") {
    return Response.json({ erro: "conversaId ausente." }, { status: 400 });
  }

  const { instituicaoId, idosoId } = sessao;
  const ref = db().doc(paths.conversa(instituicaoId, conversaId));
  const snap = await ref.get();
  if (!snap.exists || (snap.data() as Conversa).idosoId !== idosoId) {
    return Response.json({ erro: "Conversa não encontrada." }, { status: 404 });
  }

  await ref.update({ status: "concluida", finalizadaEm: new Date().toISOString() });

  // O pipeline roda inteiro no servidor. O tablet dispara esta chamada e já
  // mostra a despedida sem esperar, nenhuma tela de carregamento de curadoria
  // na frente do idoso.
  try {
    const resultado = await finalizarConversa({ instituicaoId, conversaId });
    return Response.json({ ok: true, ...resultado });
  } catch (e) {
    console.error("[finalizarConversa] falhou", { conversaId }, e);
    return Response.json(
      { ok: false, erro: "Conversa encerrada, mas o relatório falhou." },
      { status: 500 },
    );
  }
}
