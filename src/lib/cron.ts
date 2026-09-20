import "server-only";

/**
 * Rotinas agendadas se autenticam por segredo compartilhado, o Vercel Cron
 * manda `Authorization: Bearer $CRON_SECRET`; o Cloud Scheduler/Functions
 * manda o mesmo valor em `x-cron-secret`.
 */
export function cronAutorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;

  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  return bearer === segredo || req.headers.get("x-cron-secret") === segredo;
}
