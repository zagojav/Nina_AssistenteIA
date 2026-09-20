import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { carregarIdoso } from "@/lib/conversa";
import { lerPdf, montarPdf } from "@/lib/relatorio";
import { registrarAcesso } from "@/lib/logs";
import type { Relatorio } from "@/lib/types";

type Ctx = { params: Promise<{ relatorioId: string }> };

/**
 * Download do PDF. O arquivo no Storage é privado: o browser nunca recebe URL
 * direta, só este stream autenticado — e cada download vira log.
 *
 * Sem arquivo no Storage (bucket indisponível quando o relatório foi gerado),
 * o PDF é montado na hora a partir do texto guardado no Firestore. O documento
 * é o texto; o arquivo é só a renderização dele.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const curador = await curadorAutenticado(req);
    const { relatorioId } = await params;
    const inst = curador.instituicaoId;

    const snap = await db().doc(`${paths.relatorios(inst)}/${relatorioId}`).get();
    if (!snap.exists) {
      return Response.json({ erro: "Relatório não encontrado." }, { status: 404 });
    }
    const relatorio = snap.data() as Relatorio;

    let buffer: Buffer;
    if (relatorio.pdfUrl) {
      buffer = await lerPdf(relatorio.pdfUrl);
    } else {
      const [idoso, instSnap] = await Promise.all([
        carregarIdoso(inst, relatorio.idosoId),
        db().doc(paths.instituicao(inst)).get(),
      ]);
      const bytes = await montarPdf({
        idoso,
        instituicaoNome: (instSnap.data()?.nome as string) ?? "Instituição",
        tipo: relatorio.tipo,
        periodoInicio: relatorio.periodoInicio,
        periodoFim: relatorio.periodoFim,
        conteudo: relatorio.conteudoFormatado,
      });
      buffer = Buffer.from(bytes);
    }

    await registrarAcesso({
      instituicaoId: inst,
      curadorId: curador.id,
      idosoId: relatorio.idosoId,
      acao: "baixou_pdf",
      detalhe: relatorioId,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="relatorio-${relatorioId}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return respostaErro(e);
  }
}
