"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LinkGrande } from "@/components/ui";
import type { Jogo } from "@/lib/types";

/** O que cada jogo treina, em linguagem de quem joga, não de quem pesquisa. */
const TREINA: Record<string, string> = {
  atencao: "Treina a rapidez de perceber as coisas",
  memoria: "Treina a memória do dia a dia",
  raciocinio: "Treina o raciocínio",
  linguagem: "Treina as palavras",
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
        <p className="text-2xl text-tinta-suave">Carregando…</p>
      </main>
    );
  }

  if (!jogos.length) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-2xl text-tinta-suave">
          Nenhum jogo disponível ainda. Fale com um cuidador.
        </p>
        <div className="w-full max-w-sm">
          <LinkGrande href="/conversa" variante="secundario">
            Voltar para a Nina
          </LinkGrande>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 py-8">
      <p className="mx-auto mb-6 max-w-3xl text-center text-xl text-tinta-suave">
        Escolha um jogo. Não existe pressa e não existe nota. O que vale é
        exercitar um pouquinho todo dia.
      </p>

      <ul className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-3">
        {jogos.map((jogo) => {
          const treina = TREINA[jogo.tipo] ?? "Exercita o cérebro";
          return (
            <li key={jogo.id}>
              <Link
                href={`/jogos/${jogo.slug}`}
                className="flex h-full flex-col gap-3 rounded-3xl border-2 border-borda bg-superficie p-6 text-center transition hover:border-marca hover:shadow-md active:bg-marca-clara"
              >
                <span className="text-2xl font-bold text-marca">{jogo.nome}</span>

                <span className="rounded-full bg-marca-clara px-3 py-1 text-base font-semibold text-marca">
                  {treina}
                </span>

                <span className="text-lg leading-snug text-tinta-suave">
                  {jogo.descricao}
                </span>

                <span className="mt-auto pt-3 text-xl font-bold text-marca">
                  Jogar →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
