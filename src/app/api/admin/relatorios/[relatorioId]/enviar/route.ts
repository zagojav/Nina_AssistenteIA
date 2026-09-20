import { Resend } from "resend";

import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { lerPdf, linkTemporario } from "@/lib/relatorio";
import { registrarAcesso } from "@/lib/logs";
import { carregarIdoso } from "@/lib/conversa";
import type { Relatorio } from "@/lib/types";

type Ctx = { params: Promise<{ relatorioId: string }> };

/**
 * Envia o relatório por e-mail (anexo) ou devolve um link wa.me pronto.
 *
 * O WhatsApp não aceita anexo por link, então o que vai na mensagem é uma URL
 * assinada de curta duração, 30 minutos, o bastante para o destinatário
 * baixar sem que o link fique circulando.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const curador = await curadorAutenticado(req);
    const { relatorioId } = await params;
    const { metodo, destino } = await req.json();
    const inst = curador.instituicaoId;

    if (metodo !== "email" && metodo !== "whatsapp") {
      return Response.json({ erro: "Método inválido." }, { status: 400 });
    }
    if (typeof destino !== "string" || !destino.trim()) {
      return Response.json({ erro: "Destino ausente." }, { status: 400 });
    }

    const ref = db().doc(`${paths.relatorios(inst)}/${relatorioId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return Response.json({ erro: "Relatório não encontrado." }, { status: 404 });
    }
    const relatorio = snap.data() as Relatorio;
    if (!relatorio.pdfUrl) {
      return Response.json({ erro: "PDF ainda não gerado." }, { status: 409 });
    }

    const idoso = await carregarIdoso(inst, relatorio.idosoId);
    const nomeCompleto = `${idoso.nome} ${idoso.sobrenome}`;
    const agora = new Date().toISOString();
    let linkWhatsapp: string | undefined;

    if (metodo === "email") {
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_REMETENTE) {
        return Response.json(
          { erro: "Envio por e-mail não configurado (RESEND_API_KEY/EMAIL_REMETENTE)." },
          { status: 503 },
        );
      }
      const pdf = await lerPdf(relatorio.pdfUrl);
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_REMETENTE,
        to: destino.trim(),
        subject: `Relatório de acompanhamento: ${nomeCompleto}`,
        text:
          `Segue em anexo o relatório de acompanhamento de ${nomeCompleto}.\n\n` +
          "Documento confidencial: contém dado pessoal sensível de saúde (LGPD). " +
          "Não encaminhe sem autorização do responsável.\n\n" +
          `Enviado por ${curador.nome}.`,
        attachments: [
          {
            filename: `relatorio-${nomeCompleto.replace(/\s+/g, "-").toLowerCase()}.pdf`,
            content: pdf.toString("base64"),
          },
        ],
      });
      if (error) {
        return Response.json({ erro: `Falha no envio: ${error.message}` }, { status: 502 });
      }
    } else {
      const url = await linkTemporario(relatorio.pdfUrl, 30);
      const numero = destino.replace(/\D/g, "");
      const texto = encodeURIComponent(
        `Relatório de acompanhamento de ${nomeCompleto}. ` +
          `Link válido por 30 minutos: ${url}`,
      );
      linkWhatsapp = `https://wa.me/${numero}?text=${texto}`;
    }

    await ref.update({
      metodoEnvio: metodo,
      enviadoEm: agora,
      enviadoPara: destino.trim(),
      status: "enviado",
    });

    await registrarAcesso({
      instituicaoId: inst,
      curadorId: curador.id,
      idosoId: relatorio.idosoId,
      acao: "enviou_relatorio",
      detalhe: `${metodo} → ${destino.trim()}`,
    });

    return Response.json({ ok: true, linkWhatsapp });
  } catch (e) {
    return respostaErro(e);
  }
}
