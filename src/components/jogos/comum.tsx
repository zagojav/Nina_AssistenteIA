"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BotaoGrande, LinkGrande, Voltar } from "@/components/ui";
import type { Dificuldade, Jogo } from "@/lib/types";

/** Resolve o slug da rota para o doc do catálogo global de jogos. */
export function useJogo(slug: string) {
  const router = useRouter();
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const resposta = await fetch("/api/jogos");
      if (resposta.status === 401) {
        router.replace("/");
        return;
      }
      const dados = await resposta.json();
      setJogo((dados.jogos as Jogo[]).find((j) => j.slug === slug) ?? null);
      setCarregando(false);
    })();
  }, [slug, router]);

  return { jogo, carregando };
}

export interface ResultadoPartida {
  pontuacao: number;
  acertos: number;
  erros: number;
  tempoMedioResposta: number;
  dificuldade: Dificuldade;
  iniciadaEm: string;
}

export async function salvarSessao(jogoId: string, resultado: ResultadoPartida) {
  try {
    await fetch("/api/jogos/sessao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jogoId, ...resultado }),
    });
  } catch {
    // Partida perdida não atrapalha o idoso: a métrica é secundária aqui.
    console.warn("Não foi possível salvar a partida.");
  }
}

/**
 * Cronômetro de resposta: mede o intervalo entre jogadas.
 *
 * O objeto devolvido é estável entre renders (useRef, não literal novo a cada
 * vez). Sem isso, qualquer `useEffect` que o liste como dependência rodaria a
 * cada render, e nos jogos esses efeitos controlam `setTimeout` de exibição
 * de estímulo e contagem regressiva, que se reiniciariam sem parar.
 */
export function useCronometro() {
  const marco = useRef<number | null>(null);
  const tempos = useRef<number[]>([]);

  // Inicializador de estado: roda uma vez e a identidade nunca muda, sem
  // precisar ler um ref durante o render.
  const [api] = useState(() => ({
    reiniciar() {
      marco.current = Date.now();
    },
    marcar() {
      const agora = Date.now();
      tempos.current.push((agora - (marco.current ?? agora)) / 1000);
      marco.current = agora;
    },
    media() {
      if (!tempos.current.length) return 0;
      const soma = tempos.current.reduce((a, b) => a + b, 0);
      return Number((soma / tempos.current.length).toFixed(2));
    },
  }));

  return api;
}

export function MolduraJogo({
  titulo,
  instrucao,
  voltarPara = "/jogos",
  children,
}: {
  titulo: string;
  instrucao: string;
  voltarPara?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-borda bg-superficie px-5 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-marca">{titulo}</h1>
          <p className="text-base text-tinta-suave">{instrucao}</p>
        </div>
        <Voltar href={voltarPara} rotulo="Jogos" />
      </header>

      <main className="flex flex-1 flex-col items-center px-5 py-8">{children}</main>
    </div>
  );
}

export function TelaFinal({
  acertos,
  erros,
  pontuacao,
  destaque,
  aoJogarDeNovo,
}: {
  acertos: number;
  erros: number;
  pontuacao: number;
  destaque?: string;
  aoJogarDeNovo: () => void;
}) {
  return (
    <section
      aria-live="polite"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border-2 border-borda bg-superficie p-8 text-center"
    >
      <h2 className="text-3xl font-bold">Muito bem!</h2>

      <dl className="grid w-full grid-cols-3 gap-3 text-lg">
        <div className="rounded-2xl bg-marca-clara p-4">
          <dt className="text-tinta-suave">Acertos</dt>
          <dd className="text-2xl font-bold">{acertos}</dd>
        </div>
        <div className="rounded-2xl bg-marca-clara p-4">
          <dt className="text-tinta-suave">Erros</dt>
          <dd className="text-2xl font-bold">{erros}</dd>
        </div>
        <div className="rounded-2xl bg-marca-clara p-4">
          <dt className="text-tinta-suave">Pontos</dt>
          <dd className="text-2xl font-bold">{pontuacao}</dd>
        </div>
      </dl>

      {destaque && <p className="text-lg text-tinta-suave">{destaque}</p>}

      <div className="flex w-full flex-col gap-3">
        <BotaoGrande onClick={aoJogarDeNovo}>
          Jogar de novo
        </BotaoGrande>
        <LinkGrande href="/jogos" variante="secundario">
          Escolher outro jogo
        </LinkGrande>
        <LinkGrande href="/conversa" variante="suave">
          Voltar para a Nina
        </LinkGrande>
      </div>
    </section>
  );
}
