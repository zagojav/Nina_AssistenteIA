import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import type { Relatorio } from "@/lib/types";

/** Lista relatórios da instituição, opcionalmente filtrando por idoso. */
export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const idosoId = new URL(req.url).searchParams.get("idosoId");

    let consulta = db()
      .collection(paths.relatorios(curador.instituicaoId))
      .orderBy("criadoEm", "desc")
      .limit(100);

    if (idosoId) {
      await idosoDoCurador(curador, idosoId);
      consulta = db()
        .collection(paths.relatorios(curador.instituicaoId))
        .where("idosoId", "==", idosoId)
        .orderBy("criadoEm", "desc")
        .limit(100);
    }

    const snap = await consulta.get();
    // O conteúdo completo só sai na rota de leitura individual, que grava log.
    const relatorios = snap.docs.map((d) => {
      const r = d.data() as Relatorio;
      return {
        id: d.id,
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
