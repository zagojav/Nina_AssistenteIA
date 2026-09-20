import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

function credentialFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // A chave vem do .env com \n escapado.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credenciais do Firebase Admin ausentes. Defina FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env.local.",
    );
  }
  return cert({ projectId, clientEmail, privateKey });
}

let app: App | undefined;

function adminApp(): App {
  if (app) return app;
  app =
    getApps()[0] ??
    initializeApp({
      credential: credentialFromEnv(),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  return app;
}

export function db(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function bucket() {
  return getStorage(adminApp()).bucket(process.env.FIREBASE_STORAGE_BUCKET);
}

/* ------------------------------------------------------------------ *
 * Helpers de caminho, todo dado sensível vive sob uma instituição.   *
 * ------------------------------------------------------------------ */

export const paths = {
  instituicao: (i: string) => `instituicoes/${i}`,
  idosos: (i: string) => `instituicoes/${i}/idosos`,
  idoso: (i: string, id: string) => `instituicoes/${i}/idosos/${id}`,
  sessoesJogo: (i: string, id: string) =>
    `instituicoes/${i}/idosos/${id}/sessoesJogo`,
  curadores: (i: string) => `instituicoes/${i}/curadores`,
  conversas: (i: string) => `instituicoes/${i}/conversas`,
  conversa: (i: string, c: string) => `instituicoes/${i}/conversas/${c}`,
  mensagens: (i: string, c: string) =>
    `instituicoes/${i}/conversas/${c}/mensagens`,
  indicios: (i: string) => `instituicoes/${i}/indicios`,
  relatorios: (i: string) => `instituicoes/${i}/relatorios`,
  logsAcesso: (i: string) => `instituicoes/${i}/logsAcesso`,
  jogos: () => "jogos",
  padroesReferencia: () => "padroesReferencia",
};
