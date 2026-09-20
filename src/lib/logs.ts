import "server-only";

import { db, paths } from "@/lib/firebase/admin";
import type { AcaoLog } from "@/lib/types";

/**
 * Trilha de auditoria da LGPD: toda visualização, download ou edição de dado
 * sensível vira um registro imutável. Falha aqui não derruba a operação, mas
 * é logada: o registro perdido precisa ser visível na observabilidade.
 */
export async function registrarAcesso(params: {
  instituicaoId: string;
  curadorId: string;
  idosoId: string;
  acao: AcaoLog;
  detalhe?: string;
}) {
  const { instituicaoId, curadorId, idosoId, acao, detalhe } = params;
  try {
    await db()
      .collection(paths.logsAcesso(instituicaoId))
      .add({
        curadorId,
        idosoId,
        acao,
        ...(detalhe ? { detalhe } : {}),
        timestamp: new Date().toISOString(),
      });
  } catch (e) {
    console.error("[logsAcesso] falha ao registrar", { acao, idosoId }, e);
  }
}
