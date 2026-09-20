import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import type { SessaoJogo } from "@/lib/types";

/** Histórico de partidas de um idoso, para a área do curador. */
export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const idosoId = new URL(req.url).searchParams.get("idosoId");
    if (!idosoId) {
      return Response.json({ erro: "idosoId obrigatório." }, { status: 400 });
    }
    await idosoDoCurador(curador, idosoId);

    const snap = await db()
      .collection(paths.sessoesJogo(curador.instituicaoId, idosoId))
      .orderBy("iniciadaEm", "desc")
      .limit(100)
      .get();

    return Response.json({
      sessoes: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SessaoJogo, "id">) })),
    });
  } catch (e) {
    return respostaErro(e);
  }
}
