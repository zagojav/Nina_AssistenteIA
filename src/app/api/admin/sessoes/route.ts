import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { listarOrdenado } from "@/lib/consultas";
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

    const sessoes = await listarOrdenado<Omit<SessaoJogo, "id">>(
      db().collection(paths.sessoesJogo(curador.instituicaoId, idosoId)),
      "iniciadaEm",
      100,
    );

    return Response.json({ sessoes });
  } catch (e) {
    return respostaErro(e);
  }
}
