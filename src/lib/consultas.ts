import "server-only";

import type { Query } from "firebase-admin/firestore";

/**
 * Teto de documentos lidos numa listagem filtrada por residente.
 * Alto o bastante para cobrir anos de uso de uma pessoa, baixo o bastante
 * para não virar uma leitura cara.
 */
const TETO_LEITURA = 800;

/**
 * Lista documentos filtrados por igualdade e ordena em memória.
 *
 * Por que não `orderBy` no Firestore: combinar um filtro de igualdade com uma
 * ordenação por outro campo exige índice composto, e índice que falta derruba
 * a tela com `FAILED_PRECONDITION`: o curador vê erro numa funcionalidade que
 * deveria só funcionar. Filtrar por igualdade usa o índice automático de campo
 * único, que todo projeto já tem, e ordenar algumas centenas de documentos em
 * memória é barato.
 *
 * O limite existe para a leitura não crescer sem teto; a política de retenção
 * (`/api/cron/retencao`) é quem mantém o volume sob controle de verdade.
 */
export async function listarOrdenado<T extends Record<string, unknown>>(
  consulta: Query,
  campoData: keyof T & string,
  quantidade: number,
): Promise<(T & { id: string })[]> {
  const snap = await consulta.limit(TETO_LEITURA).get();

  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as T) }))
    .sort((a, b) => String(b[campoData] ?? "").localeCompare(String(a[campoData] ?? "")))
    .slice(0, quantidade);
}
