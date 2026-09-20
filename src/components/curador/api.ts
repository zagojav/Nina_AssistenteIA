"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";

import { clientAuth } from "@/lib/firebase/client";

/** Estado de sessão do curador (Firebase Auth). */
export function useCurador() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(clientAuth(), (u) => {
      setUsuario(u);
      setCarregando(false);
    });
  }, []);

  return { usuario, carregando };
}

/**
 * Toda chamada da área admin leva o ID token no Authorization. O servidor é
 * quem decide o que o curador pode ver — o client nunca fala com o Firestore.
 */
export async function apiCurador<T>(
  caminho: string,
  init: RequestInit = {},
): Promise<T> {
  const usuario = clientAuth().currentUser;
  if (!usuario) throw new Error("Sessão expirada. Entre novamente.");

  const token = await usuario.getIdToken();
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.erro ?? `Falha na requisição (${resposta.status}).`);
  }
  return resposta.json() as Promise<T>;
}

/** Download autenticado: o PDF não tem URL pública. */
export async function baixarPdf(relatorioId: string, nomeArquivo: string) {
  const usuario = clientAuth().currentUser;
  if (!usuario) throw new Error("Sessão expirada.");

  const token = await usuario.getIdToken();
  const resposta = await fetch(`/api/admin/relatorios/${relatorioId}/pdf`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.erro ?? "Não consegui baixar o PDF.");
  }

  const blob = await resposta.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export function dataHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
