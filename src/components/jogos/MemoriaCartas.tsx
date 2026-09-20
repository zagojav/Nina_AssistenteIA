"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MolduraJogo,
  TelaFinal,
  useCronometro,
  useJogo,
  salvarSessao,
} from "@/components/jogos/comum";

const SIMBOLOS = [
  { emoji: "🌻", nome: "girassol" },
  { emoji: "🐦", nome: "passarinho" },
  { emoji: "☕", nome: "xícara de café" },
  { emoji: "🍎", nome: "maçã" },
  { emoji: "🏠", nome: "casa" },
  { emoji: "🐶", nome: "cachorro" },
];

const PARES = 6;

interface Carta {
  id: number;
  emoji: string;
  nome: string;
  virada: boolean;
  achada: boolean;
}

function embaralhar(): Carta[] {
  const baralho = SIMBOLOS.slice(0, PARES)
    .flatMap((s) => [s, s])
    .map((s, i) => ({ id: i, ...s, virada: false, achada: false }));

  for (let i = baralho.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
  }
  return baralho;
}

export default function MemoriaCartas({ slug }: { slug: string }) {
  const { jogo, carregando } = useJogo(slug);
  const cronometro = useCronometro();
  const [cartas, setCartas] = useState<Carta[]>(embaralhar);
  const [abertas, setAbertas] = useState<number[]>([]);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [bloqueado, setBloqueado] = useState(false);
  const [fim, setFim] = useState(false);
  const inicio = useRef(new Date().toISOString());
  const salvou = useRef(false);

  const reiniciar = useCallback(() => {
    setCartas(embaralhar());
    setAbertas([]);
    setAcertos(0);
    setErros(0);
    setFim(false);
    setBloqueado(false);
    inicio.current = new Date().toISOString();
    salvou.current = false;
    cronometro.reiniciar();
  }, [cronometro]);

  function virar(indice: number) {
    if (bloqueado || fim) return;
    const carta = cartas[indice];
    if (carta.virada || carta.achada) return;

    const novas = cartas.map((c, i) => (i === indice ? { ...c, virada: true } : c));
    setCartas(novas);
    const novasAbertas = [...abertas, indice];

    if (novasAbertas.length < 2) {
      setAbertas(novasAbertas);
      return;
    }

    cronometro.marcar();
    const [a, b] = novasAbertas;
    setBloqueado(true);

    if (novas[a].emoji === novas[b].emoji) {
      setTimeout(() => {
        setCartas((atual) =>
          atual.map((c, i) =>
            i === a || i === b ? { ...c, achada: true, virada: true } : c,
          ),
        );
        setAcertos((n) => n + 1);
        setAbertas([]);
        setBloqueado(false);
      }, 420);
    } else {
      setErros((n) => n + 1);
      setTimeout(() => {
        setCartas((atual) =>
          atual.map((c, i) => (i === a || i === b ? { ...c, virada: false } : c)),
        );
        setAbertas([]);
        setBloqueado(false);
      }, 1100);
    }
  }

  useEffect(() => {
    if (acertos < PARES || salvou.current || !jogo) return;
    salvou.current = true;
    setFim(true);
    void salvarSessao(jogo.id, {
      pontuacao: Math.max(0, PARES * 20 - erros * 5),
      acertos,
      erros,
      tempoMedioResposta: cronometro.media(),
      dificuldade: "facil",
      iniciadaEm: inicio.current,
    });
  }, [acertos, erros, jogo, cronometro]);

  if (carregando) {
    return (
      <MolduraJogo titulo="Memória de cartas" instrucao="Carregando…">
        <p className="text-xl text-tinta-suave">Um instante…</p>
      </MolduraJogo>
    );
  }

  return (
    <MolduraJogo
      titulo="Memória de cartas"
      instrucao="Toque em duas cartas e encontre as iguais."
    >
      {fim ? (
        <TelaFinal
          acertos={acertos}
          erros={erros}
          pontuacao={Math.max(0, PARES * 20 - erros * 5)}
          aoJogarDeNovo={reiniciar}
        />
      ) : (
        <>
          <p className="mb-6 text-xl" aria-live="polite">
            Pares encontrados: <strong>{acertos}</strong> de {PARES}
          </p>
          <ul className="grid w-full max-w-lg grid-cols-3 gap-3 sm:grid-cols-4">
            {cartas.map((carta, i) => {
              const aberta = carta.virada || carta.achada;
              return (
                <li key={carta.id}>
                  <button
                    type="button"
                    onClick={() => virar(i)}
                    disabled={aberta || bloqueado}
                    aria-label={aberta ? carta.nome : "Carta virada para baixo"}
                    className={`flex aspect-square w-full items-center justify-center rounded-2xl border-2 text-5xl transition ${
                      carta.achada
                        ? "border-marca bg-marca-clara"
                        : aberta
                          ? "border-marca bg-superficie"
                          : "border-borda bg-marca"
                    }`}
                  >
                    <span aria-hidden="true">{aberta ? carta.emoji : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </MolduraJogo>
  );
}
