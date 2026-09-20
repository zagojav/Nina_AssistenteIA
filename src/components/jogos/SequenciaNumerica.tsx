"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MolduraJogo,
  TelaFinal,
  useCronometro,
  useJogo,
  salvarSessao,
} from "@/components/jogos/comum";
import type { Dificuldade } from "@/lib/types";

const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const RODADAS = 5;

type Fase = "aguardando" | "mostrando" | "respondendo" | "errou" | "fim";

function dificuldadePor(tamanho: number): Dificuldade {
  if (tamanho <= 3) return "facil";
  if (tamanho <= 5) return "medio";
  return "dificil";
}

export default function SequenciaNumerica({ slug }: { slug: string }) {
  const { jogo, carregando } = useJogo(slug);
  const cronometro = useCronometro();

  const [sequencia, setSequencia] = useState<number[]>([]);
  const [aceso, setAceso] = useState<number | null>(null);
  const [posicao, setPosicao] = useState(0);
  const [rodada, setRodada] = useState(1);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [fase, setFase] = useState<Fase>("aguardando");
  const inicio = useRef(new Date().toISOString());
  const salvou = useRef(false);

  const mostrar = useCallback(async (seq: number[]) => {
    setFase("mostrando");
    for (const n of seq) {
      setAceso(n);
      await new Promise((r) => setTimeout(r, 700));
      setAceso(null);
      await new Promise((r) => setTimeout(r, 260));
    }
    setPosicao(0);
    setFase("respondendo");
    cronometro.reiniciar();
  }, [cronometro]);

  const novaRodada = useCallback(
    (numeroDaRodada: number) => {
      // Começa com 3 números e cresce um a cada rodada.
      const tamanho = 2 + numeroDaRodada;
      const nova = Array.from(
        { length: tamanho },
        () => NUMEROS[Math.floor(Math.random() * NUMEROS.length)],
      );
      setSequencia(nova);
      void mostrar(nova);
    },
    [mostrar],
  );

  function tocar(n: number) {
    if (fase !== "respondendo") return;
    cronometro.marcar();

    if (n !== sequencia[posicao]) {
      setErros((e) => e + 1);
      setFase("errou");
      setTimeout(() => avancar(), 1400);
      return;
    }

    const proxima = posicao + 1;
    if (proxima < sequencia.length) {
      setPosicao(proxima);
      return;
    }

    setAcertos((a) => a + 1);
    avancar();
  }

  function avancar() {
    if (rodada >= RODADAS) {
      setFase("fim");
      return;
    }
    const proxima = rodada + 1;
    setRodada(proxima);
    novaRodada(proxima);
  }

  const reiniciar = useCallback(() => {
    setRodada(1);
    setAcertos(0);
    setErros(0);
    setPosicao(0);
    inicio.current = new Date().toISOString();
    salvou.current = false;
    novaRodada(1);
  }, [novaRodada]);

  useEffect(() => {
    if (!carregando && fase === "aguardando") novaRodada(1);
  }, [carregando, fase, novaRodada]);

  useEffect(() => {
    if (fase !== "fim" || salvou.current || !jogo) return;
    salvou.current = true;
    void salvarSessao(jogo.id, {
      pontuacao: acertos * 25,
      acertos,
      erros,
      tempoMedioResposta: cronometro.media(),
      dificuldade: dificuldadePor(sequencia.length),
      iniciadaEm: inicio.current,
    });
  }, [fase, acertos, erros, jogo, sequencia.length, cronometro]);

  const instrucao =
    fase === "mostrando"
      ? "Olhe com atenção…"
      : fase === "respondendo"
        ? "Agora toque nos números na mesma ordem."
        : "Veja a sequência e repita.";

  return (
    <MolduraJogo titulo="Sequência numérica" instrucao={instrucao}>
      {fase === "fim" ? (
        <TelaFinal
          acertos={acertos}
          erros={erros}
          pontuacao={acertos * 25}
          aoJogarDeNovo={reiniciar}
        />
      ) : (
        <>
          <p className="mb-6 text-xl" aria-live="polite">
            Rodada <strong>{rodada}</strong> de {RODADAS} — {sequencia.length} números
          </p>

          {fase === "errou" && (
            <p role="alert" className="mb-4 text-xl font-semibold text-destaque">
              Quase! Vamos para a próxima.
            </p>
          )}

          <ul className="grid w-full max-w-md grid-cols-3 gap-3">
            {NUMEROS.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => tocar(n)}
                  disabled={fase !== "respondendo"}
                  className={`aspect-square w-full rounded-2xl border-2 text-4xl font-bold transition ${
                    aceso === n
                      ? "border-marca bg-marca text-white"
                      : "border-borda bg-superficie text-tinta"
                  } disabled:opacity-60`}
                >
                  {n}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </MolduraJogo>
  );
}
