import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "nina_sessao_idoso";
const DURACAO_DIAS = 30;

export interface SessaoIdoso {
  instituicaoId: string;
  idosoId: string;
  nome: string;
  dispositivoId: string;
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curta demais (mínimo 32 caracteres). Defina no .env.local.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function criarSessaoIdoso(sessao: SessaoIdoso) {
  const token = await new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function lerSessaoIdoso(): Promise<SessaoIdoso | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      instituicaoId: String(payload.instituicaoId),
      idosoId: String(payload.idosoId),
      nome: String(payload.nome),
      dispositivoId: String(payload.dispositivoId),
    };
  } catch {
    return null;
  }
}

export async function encerrarSessaoIdoso() {
  (await cookies()).delete(COOKIE);
}
