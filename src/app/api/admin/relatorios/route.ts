import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { listarOrdenado } from "@/lib/consultas";
import type { Relatorio } from "@/lib/types";

/** Lista relatórios da instituição, opcionalmente filtrando por idoso. */
export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const idosoId = new URL(req.url).searchParams.get("idosoId");

    const colecao = db().collection(paths.relatorios(curador.instituicaoId));
    if (idosoId) await idosoDoCurador(curador, idosoId);

    const docs = await listarOrdenado<Omit<Relatorio, "id">>(
      idosoId ? colecao.where("idosoId", "==", idosoId) : colecao,
      "criadoEm",
      100,
    );

    // O conteúdo completo só sai na rota de leitura individual, que grava log.
    const relatorios = docs.map((r) => {
      return {
        id: r.id,
        idosoId: r.idosoId,
        tipo: r.tipo,
        periodoInicio: r.periodoInicio,
        periodoFim: r.periodoFim,
        qtdIndicios: r.indiciosIncluidos?.length ?? 0,
        status: r.status,
        metodoEnvio: r.metodoEnvio,
        enviadoEm: r.enviadoEm,
        // O PDF é sempre obtenível: vem do Storage ou é montado na hora.
        temPdf: true,
        pdfArmazenado: Boolean(r.pdfUrl),
        criadoEm: r.criadoEm,
      };
    });

    return Response.json({ relatorios });
  } catch (e) {
    return respostaErro(e);
  }
}
