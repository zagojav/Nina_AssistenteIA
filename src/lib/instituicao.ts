import "server-only";

/**
 * Cada deploy atende uma casa de repouso. O tablet do idoso não tem como
 * escolher instituição, então ela vem do ambiente — e é ela que delimita o
 * escopo de toda busca feita a partir do login por PIN.
 */
export function instituicaoPadrao(): string {
  const id = process.env.INSTITUICAO_ID;
  if (!id) {
    throw new Error("INSTITUICAO_ID ausente. Defina no .env.local.");
  }
  return id;
}
