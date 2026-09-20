"use client";

const CHAVE = "nina_dispositivo_id";

/**
 * UUID do tablet, gravado no localStorage no primeiro login e enviado nos
 * acessos seguintes. É ele que permite pular o PIN, e é ele que o curador
 * invalida no admin quando troca o aparelho.
 */
export function dispositivoId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(CHAVE);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(CHAVE, id);
  }
  return id;
}

export function esquecerDispositivo() {
  window.localStorage.removeItem(CHAVE);
}
