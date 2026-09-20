import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import type { Indicio } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const url = new URL(req.url);
    const idosoId = url.searchParams.get("idosoId");
    const desde = url.searchParams.get("desde");

    let consulta = db()
      .collection(paths.indicios(curador.instituicaoId))
      .orderBy("detectadoEm", "desc")
      .limit(200);

    if (idosoId) {
      await idosoDoCurador(curador, idosoId);
      let q = db()
        .collection(paths.indicios(curador.instituicaoId))
        .where("idosoId", "==", idosoId);
      if (desde) q = q.where("detectadoEm", ">=", desde);
      consulta = q.orderBy("detectadoEm", "desc").limit(200);
    }

    const snap = await consulta.get();
    return Response.json({
      indicios: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Indicio, "id">) })),
    });
  } catch (e) {
    return respostaErro(e);
  }
}
