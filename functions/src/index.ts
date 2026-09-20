import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

/**
 * Rotinas agendadas.
 *
 * A lógica pesada (análise, relatório, PDF) vive na aplicação Next.js, que já
 * tem a chave da Claude e o acesso ao Storage. Duplicar isso aqui significaria
 * manter dois motores de indícios, então estas funções só disparam as rotas
 * protegidas por segredo compartilhado.
 *
 * Se o deploy for na Vercel, o `vercel.json` já agenda as mesmas rotas e este
 * pacote é dispensável. Use um ou outro, nunca os dois (relatório duplicado).
 *
 *   firebase functions:secrets:set CRON_SECRET
 *   firebase deploy --only functions
 */
const urlApp = defineString("URL_APP", {
  description: "URL pública da aplicação, ex: https://nina.suainstituicao.com.br",
});
const cronSecret = defineSecret("CRON_SECRET");

const FUSO = "America/Sao_Paulo";

async function chamar(caminho: string) {
  const resposta = await fetch(`${urlApp.value()}${caminho}`, {
    method: "GET",
    headers: { "x-cron-secret": cronSecret.value() },
  });
  const corpo = await resposta.text();

  if (!resposta.ok) {
    logger.error("Rotina falhou", { caminho, status: resposta.status, corpo });
    throw new Error(`Rotina ${caminho} respondeu ${resposta.status}`);
  }
  logger.info("Rotina concluída", { caminho, corpo });
}

export const consolidadoDiario = onSchedule(
  { schedule: "0 23 * * *", timeZone: FUSO, secrets: [cronSecret], timeoutSeconds: 540 },
  async () => {
    await chamar("/api/cron/consolidar?tipo=diario");
  },
);

export const consolidadoSemanal = onSchedule(
  { schedule: "0 23 * * 0", timeZone: FUSO, secrets: [cronSecret], timeoutSeconds: 540 },
  async () => {
    await chamar("/api/cron/consolidar?tipo=semanal");
  },
);

export const retencaoDeDados = onSchedule(
  { schedule: "30 4 * * *", timeZone: FUSO, secrets: [cronSecret], timeoutSeconds: 540 },
  async () => {
    await chamar("/api/cron/retencao");
  },
);
