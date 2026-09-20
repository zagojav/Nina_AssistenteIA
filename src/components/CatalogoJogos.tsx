"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Jogo } from "@/lib/types";

const EMOJI: Record<string, string> = {
  memoria: "🃏",
  atencao: "🔢",
  raciocinio: "🧩",
  linguagem: "💬",
};

export default function CatalogoJogos() {
  const router = useRouter();
  const [jogos, setJogos] = useState<Jogo[] | null>(null);

  useEffect(() => {
    (async () => {
      const resposta = await fetch("/api/jogos");
      if (resposta.status === 401) {
        router.replace("/");
        return;
      }
      const dados = await resposta.json();
      setJogos(dados.jogos ?? []);
    })();
  }, [router]);

  if (!jogos) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-xl text-tinta-suave">Carregando…</p>
      </main>
    );
  }

  if (!jogos.length) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-xl text-tinta-suave">
          Nenhum jogo disponível ainda. Fale com um cuidador.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 py-8">
      <ul className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        {jogos.map((jogo) => (
          <li key={jogo.id}>
            <Link
              href={`/jogos/${jogo.slug}`}
              className="flex min-h-40 flex-col justify-between rounded-3xl border-2 border-borda bg-superficie p-6 transition hover:border-marca"
            >
              <span className="text-5xl" role="img" aria-label={`Ícone de ${jogo.nome}`}>
                {EMOJI[jogo.tipo] ?? "🎲"}
              </span>
              <span>
                <span className="block text-2xl font-bold">{jogo.nome}</span>
                <span className="mt-1 block text-lg text-tinta-suave">
                  {jogo.descricao}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
