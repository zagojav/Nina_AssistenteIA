import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { registrarAcesso } from "@/lib/logs";
import type { Indicio, Relatorio } from "@/lib/types";

type Ctx = { params: Promise<{ relatorioId: string }> };

/** Abre o relatório. Toda abertura vira log de acesso (dado sensível). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const curador = await curadorAutenticado(req);
    const { relatorioId } = await params;
    const inst = curador.instituicaoId;

    const snap = await db().doc(`${paths.relatorios(inst)}/${relatorioId}`).get();
    if (!snap.exists) {
      return Response.json({ erro: "Relatório não encontrado." }, { status: 404 });
    }
    const relatorio = { id: snap.id, ...(snap.data() as Omit<Relatorio, "id">) };

    const indicios: Indicio[] = [];
    for (const id of relatorio.indiciosIncluidos ?? []) {
      const d = await db().doc(`${paths.indicios(inst)}/${id}`).get();
      if (d.exists) indicios.push({ id: d.id, ...(d.data() as Omit<Indicio, "id">) });
    }

    await registrarAcesso({
      instituicaoId: inst,
      curadorId: curador.id,
      idosoId: relatorio.idosoId,
      acao: "visualizou_relatorio",
      detalhe: relatorioId,
    });

    return Response.json({ relatorio: { ...relatorio, pdfUrl: undefined }, indicios });
  } catch (e) {
    return respostaErro(e);
  }
}
