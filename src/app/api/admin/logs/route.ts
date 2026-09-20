import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import type { LogAcesso } from "@/lib/types";

/** Trilha de auditoria da instituição (LGPD). */
export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const idosoId = new URL(req.url).searchParams.get("idosoId");

    const base = db().collection(paths.logsAcesso(curador.instituicaoId));
    const consulta = idosoId
      ? base.where("idosoId", "==", idosoId).orderBy("timestamp", "desc").limit(200)
      : base.orderBy("timestamp", "desc").limit(200);

    const snap = await consulta.get();
    return Response.json({
      logs: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LogAcesso, "id">) })),
    });
  } catch (e) {
    return respostaErro(e);
  }
}
