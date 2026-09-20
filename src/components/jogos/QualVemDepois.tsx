"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MolduraJogo,
  TelaFinal,
  useCronometro,
  useJogo,
  salvarSessao,
} from "@/components/jogos/comum";
import { BotaoGrande, Instrucao, Progresso } from "@/components/ui";
import type { Dificuldade } from "@/lib/types";

/*
 * Raciocínio indutivo, o braço de "reasoning" do ACTIVE, que treinava
 * justamente completar séries com padrão serial (letras, números, formas).
 *
 * As séries são geradas, não sorteadas de uma lista fixa: repetir sempre os
 * mesmos itens treinaria memória da resposta, não a descoberta do padrão.
 * A dificuldade cresce ao longo das rodadas.
 */

interface Serie {
  mostrar: string[];
  certa: string;
  alternativas: string[];
  explicacao: string;
}

const FORMAS = ["🔴", "🔵", "🟡", "🟢"];
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function sortear<T>(itens: T[]): T {
  return itens[Math.floor(Math.random() * itens.length)];
}

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Série de números com passo constante. */
function serieNumerica(passo: number): Serie {
  const inicio = 1 + Math.floor(Math.random() * 9);
  const termos = [0, 1, 2, 3].map((i) => inicio + i * passo);
  const certa = String(inicio + 4 * passo);
  const distratores = [
    String(inicio + 5 * passo),
    String(inicio + 3 * passo),
    String(inicio + 4 * passo + 1),
  ];
  return {
    mostrar: termos.map(String),
    certa,
    alternativas: embaralhar([certa, ...distratores]),
    explicacao: `Cada número aumenta de ${passo} em ${passo}.`,
  };
}

/** Série de formas que se repete em ciclo. */
function serieDeFormas(tamanhoCiclo: number): Serie {
  const ciclo = embaralhar(FORMAS).slice(0, tamanhoCiclo);
  const termos = Array.from({ length: 6 }, (_, i) => ciclo[i % ciclo.length]);
  const certa = ciclo[6 % ciclo.length];
  return {
    mostrar: termos,
    certa,
    alternativas: embaralhar([
      certa,
      ...FORMAS.filter((f) => f !== certa).slice(0, 3),
    ]),
    explicacao: `A sequência repete ${tamanhoCiclo} figuras sempre na mesma ordem.`,
  };
}

/** Série de letras pulando um número fixo de posições no alfabeto. */
function serieDeLetras(passo: number): Serie {
  const inicio = Math.floor(Math.random() * (LETRAS.length - 5 * passo));
  const termos = [0, 1, 2, 3].map((i) => LETRAS[inicio + i * passo]);
  const certa = LETRAS[inicio + 4 * passo];
  const distratores = [
    LETRAS[inicio + 5 * passo],
    LETRAS[inicio + 3 * passo],
    LETRAS[inicio + 4 * passo + 1],
  ].filter(Boolean);
  return {
    mostrar: termos,
    certa,
    alternativas: embaralhar([certa, ...distratores]),
    explicacao:
      passo === 1
        ? "As letras seguem a ordem do alfabeto."
        : `As letras pulam ${passo} posições no alfabeto.`,
  };
}

const RODADAS = 6;

/** Cada rodada puxa um tipo de série e um grau de dificuldade. */
function gerarSerie(rodada: number): Serie {
  if (rodada === 0) return serieNumerica(2);
  if (rodada === 1) return serieDeFormas(2);
  if (rodada === 2) return serieDeLetras(1);
  if (rodada === 3) return serieNumerica(sortear([3, 5]));
  if (rodada === 4) return serieDeFormas(3);
  return serieDeLetras(sortear([2, 3]));
}

function dificuldadePor(rodada: number): Dificuldade {
  if (rodada <= 1) return "facil";
  if (rodada <= 3) return "medio";
  return "dificil";
}

export default function QualVemDepois({ slug }: { slug: string }) {
  const { jogo, carregando } = useJogo(slug);
  const cronometro = useCronometro();

  const [rodada, setRodada] = useState(0);
  const [serie, setSerie] = useState<Serie>(() => gerarSerie(0));
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [fim, setFim] = useState(false);

  const inicio = useRef(new Date().toISOString());
  const salvou = useRef(false);

  function responder(opcao: string) {
    if (escolhida) return;
    cronometro.marcar();
    setEscolhida(opcao);
    if (opcao === serie.certa) setAcertos((a) => a + 1);
    else setErros((e) => e + 1);
  }

  function proxima() {
    const seguinte = rodada + 1;
    if (seguinte >= RODADAS) {
      setFim(true);
      return;
    }
    setRodada(seguinte);
    setSerie(gerarSerie(seguinte));
    setEscolhida(null);
  }

  const reiniciar = useCallback(() => {
    setRodada(0);
    setSerie(gerarSerie(0));
    setEscolhida(null);
    setAcertos(0);
    setErros(0);
    setFim(false);
    inicio.current = new Date().toISOString();
    salvou.current = false;
  }, []);

  useEffect(() => {
    if (!fim || salvou.current || !jogo) return;
    salvou.current = true;
    void salvarSessao(jogo.id, {
      pontuacao: acertos * 20,
      acertos,
      erros,
      tempoMedioResposta: cronometro.media(),
      dificuldade: dificuldadePor(rodada),
      iniciadaEm: inicio.current,
    });
  }, [fim, acertos, erros, jogo, rodada, cronometro]);

  if (carregando) {
    return (
      <MolduraJogo titulo="Qual vem depois?" instrucao="Carregando…" voltarPara="/jogos">
        <p className="text-xl text-tinta-suave">Um instante…</p>
      </MolduraJogo>
    );
  }

  const acertou = escolhida === serie.certa;

  return (
    <MolduraJogo
      titulo="Qual vem depois?"
      instrucao="Descubra o padrão e complete a sequência."
      voltarPara="/jogos"
    >
      {fim ? (
        <TelaFinal
          acertos={acertos}
          erros={erros}
          pontuacao={acertos * 20}
          destaque="Procurar o padrão é o mesmo jeito de pensar que resolve um problema do dia a dia."
          aoJogarDeNovo={reiniciar}
        />
      ) : (
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <Progresso atual={rodada + 1} total={RODADAS} />
          <Instrucao>
            {escolhida
              ? acertou
                ? "Acertou!"
                : "Quase! Veja a resposta certa."
              : "O que vem no lugar da interrogação?"}
          </Instrucao>

          <ol className="flex flex-wrap items-center justify-center gap-3">
            {serie.mostrar.map((termo, i) => (
              <li
                key={i}
                className="flex min-h-22 min-w-22 items-center justify-center rounded-2xl border-2 border-borda bg-superficie px-5 text-4xl font-bold"
              >
                {termo}
              </li>
            ))}
            <li
              aria-label="posição a descobrir"
              className={`flex min-h-22 min-w-22 items-center justify-center rounded-2xl border-4 border-dashed px-5 text-4xl font-bold ${
                escolhida
                  ? "border-marca bg-marca-clara text-marca"
                  : "border-marca text-marca"
              }`}
            >
              {escolhida ? serie.certa : "?"}
            </li>
          </ol>

          <ul className="grid w-full grid-cols-2 gap-3">
            {serie.alternativas.map((opcao) => {
              const revelada = escolhida !== null;
              const ehCerta = opcao === serie.certa;
              return (
                <li key={opcao}>
                  <button
                    type="button"
                    onClick={() => responder(opcao)}
                    disabled={revelada}
                    className={`min-h-22 w-full rounded-2xl border-2 text-3xl font-bold transition ${
                      revelada && ehCerta
                        ? "border-marca bg-marca text-white"
                        : revelada && opcao === escolhida
                          ? "border-destaque bg-superficie text-destaque"
                          : "border-borda bg-superficie text-tinta hover:border-marca"
                    } disabled:opacity-100`}
                  >
                    {opcao}
                    {revelada && ehCerta && (
                      <span className="mt-1 block text-base font-semibold">
                        resposta certa
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {escolhida && (
            <>
              <p className="rounded-2xl bg-superficie px-5 py-4 text-center text-xl">
                {serie.explicacao}
              </p>
              <BotaoGrande onClick={proxima}>
                {rodada + 1 >= RODADAS ? "Ver resultado" : "Próxima sequência"}
              </BotaoGrande>
            </>
          )}
        </div>
      )}
    </MolduraJogo>
  );
}
