import { cronAutorizado } from "@/lib/cron";
import { bucket, db, paths } from "@/lib/firebase/admin";
import { instituicaoPadrao } from "@/lib/instituicao";
import type { Relatorio } from "@/lib/types";

export const maxDuration = 800;

/**
 * Política de retenção (LGPD, art. 15-16: o dado só fica enquanto a finalidade
 * durar). Os prazos são decisão da instituição; ajuste por ambiente:
 *
 *   RETENCAO_CONVERSAS_DIAS  transcrições brutas (padrão 180 dias)
 *   RETENCAO_INDICIOS_DIAS   indícios já consolidados em relatório (padrão 730)
 *   RETENCAO_RELATORIOS_DIAS relatórios e PDFs (padrão 1825 = 5 anos)
 *   RETENCAO_LOGS_DIAS       trilha de auditoria (padrão 1825)
 *
 * A transcrição some primeiro porque é o dado mais cru; o relatório, que é o
 * documento de acompanhamento, sobrevive mais tempo.
 */
function limite(variavel: string, padrao: number): string {
  const dias = Number(process.env[variavel] ?? padrao);
  const data = new Date();
  data.setDate(data.getDate() - (Number.isFinite(dias) ? dias : padrao));
  return data.toISOString();
}

export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const inst = instituicaoPadrao();
  const firestore = db();
  const resumo = { conversas: 0, indicios: 0, relatorios: 0, logs: 0 };

  // Conversas + mensagens
  const conversas = await firestore
    .collection(paths.conversas(inst))
    .where("iniciadaEm", "<", limite("RETENCAO_CONVERSAS_DIAS", 180))
    .limit(200)
    .get();
  for (const doc of conversas.docs) {
    await firestore.recursiveDelete(doc.ref);
    resumo.conversas++;
  }

  // Indícios
  const indicios = await firestore
    .collection(paths.indicios(inst))
    .where("detectadoEm", "<", limite("RETENCAO_INDICIOS_DIAS", 730))
    .limit(500)
    .get();
  for (const doc of indicios.docs) {
    await doc.ref.delete();
    resumo.indicios++;
  }

  // Relatórios + PDFs
  const relatorios = await firestore
    .collection(paths.relatorios(inst))
    .where("criadoEm", "<", limite("RETENCAO_RELATORIOS_DIAS", 1825))
    .limit(200)
    .get();
  for (const doc of relatorios.docs) {
    const dados = doc.data() as Relatorio;
    if (dados.pdfUrl) {
      await bucket()
        .file(dados.pdfUrl)
        .delete()
        .catch((e) => console.error("[retencao] PDF não removido", dados.pdfUrl, e));
    }
    await doc.ref.delete();
    resumo.relatorios++;
  }

  // Logs de acesso
  const logs = await firestore
    .collection(paths.logsAcesso(inst))
    .where("timestamp", "<", limite("RETENCAO_LOGS_DIAS", 1825))
    .limit(500)
    .get();
  for (const doc of logs.docs) {
    await doc.ref.delete();
    resumo.logs++;
  }

  return Response.json({ ok: true, removidos: resumo });
}
