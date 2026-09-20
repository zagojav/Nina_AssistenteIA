import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { listarOrdenado } from "@/lib/consultas";
import type { LogAcesso } from "@/lib/types";

/** Trilha de auditoria da instituição (LGPD). */
export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const idosoId = new URL(req.url).searchParams.get("idosoId");

    const base = db().collection(paths.logsAcesso(curador.instituicaoId));
    const logs = await listarOrdenado<Omit<LogAcesso, "id">>(
      idosoId ? base.where("idosoId", "==", idosoId) : base,
      "timestamp",
      200,
    );

    return Response.json({ logs });
  } catch (e) {
    return respostaErro(e);
  }
}
