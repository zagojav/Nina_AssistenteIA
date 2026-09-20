import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { listarOrdenado } from "@/lib/consultas";
import type { Indicio } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const url = new URL(req.url);
    const idosoId = url.searchParams.get("idosoId");
    const desde = url.searchParams.get("desde");

    const colecao = db().collection(paths.indicios(curador.instituicaoId));
    if (idosoId) await idosoDoCurador(curador, idosoId);

    const indicios = await listarOrdenado<Omit<Indicio, "id">>(
      idosoId ? colecao.where("idosoId", "==", idosoId) : colecao,
      "detectadoEm",
      200,
    );

    // O corte por data é aplicado depois da ordenação, para não precisar
    // combinar desigualdade com filtro de igualdade (que exigiria índice).
    return Response.json({
      indicios: desde ? indicios.filter((i) => i.detectadoEm >= desde) : indicios,
    });
  } catch (e) {
    return respostaErro(e);
  }
}
