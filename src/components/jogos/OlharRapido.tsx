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
 * Velocidade de processamento, paradigma Useful Field of View (UFOV), o
 * treino do braço de "speed of processing" do ACTIVE.
 *
 * Duas tarefas ao mesmo tempo, que é o que faz o exercício valer: identificar
 * a figura do centro E localizar o alvo periférico. O tempo de exibição
 * encurta a cada acerto e alarga a cada erro, então o exercício se ajusta
 * sozinho ao ritmo da pessoa em vez de ter "níveis" fixos.
 */

const CENTRAIS = [
  { chave: "carro", emoji: "🚗", nome: "carro" },
  { chave: "caminhao", emoji: "🚚", nome: "caminhão" },
] as const;

const POSICOES = [
  { chave: "cima", nome: "em cima", angulo: -90 },
  { chave: "cima-direita", nome: "em cima à direita", angulo: -45 },
  { chave: "direita", nome: "à direita", angulo: 0 },
  { chave: "baixo-direita", nome: "embaixo à direita", angulo: 45 },
  { chave: "baixo", nome: "embaixo", angulo: 90 },
  { chave: "baixo-esquerda", nome: "embaixo à esquerda", angulo: 135 },
  { chave: "esquerda", nome: "à esquerda", angulo: 180 },
  { chave: "cima-esquerda", nome: "em cima à esquerda", angulo: 225 },
] as const;

const RODADAS = 8;
const TEMPO_INICIAL = 1000;
const TEMPO_MINIMO = 120;

type Fase = "pronto" | "mostrando" | "pergunta-centro" | "pergunta-lugar" | "resultado" | "fim";

function dificuldadePor(ms: number): Dificuldade {
  if (ms > 700) return "facil";
  if (ms > 350) return "medio";
  return "dificil";
}

export default function OlharRapido({ slug }: { slug: string }) {
  const { jogo, carregando } = useJogo(slug);
  const cronometro = useCronometro();

  const [fase, setFase] = useState<Fase>("pronto");
  const [rodada, setRodada] = useState(1);
  const [tempo, setTempo] = useState(TEMPO_INICIAL);
  const [central, setCentral] = useState<(typeof CENTRAIS)[number]>(CENTRAIS[0]);
  const [posicao, setPosicao] = useState<(typeof POSICOES)[number]>(POSICOES[0]);
  const [respostaCentro, setRespostaCentro] = useState<string | null>(null);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [melhorTempo, setMelhorTempo] = useState(TEMPO_INICIAL);
  const [ultimoAcerto, setUltimoAcerto] = useState(false);

  const inicio = useRef(new Date().toISOString());
  const salvou = useRef(false);

  const mostrar = useCallback(() => {
    setCentral(CENTRAIS[Math.floor(Math.random() * CENTRAIS.length)]);
    setPosicao(POSICOES[Math.floor(Math.random() * POSICOES.length)]);
    setRespostaCentro(null);
    setFase("mostrando");
  }, []);

  // O estímulo aparece por `tempo` e some. É o sumiço que força a percepção
  // rápida, então o timer é parte da mecânica, não um detalhe de animação.
  useEffect(() => {
    if (fase !== "mostrando") return;
    const t = setTimeout(() => {
      setFase("pergunta-centro");
      cronometro.reiniciar();
    }, tempo);
    return () => clearTimeout(t);
  }, [fase, tempo, cronometro]);

  function responderCentro(chave: string) {
    setRespostaCentro(chave);
    setFase("pergunta-lugar");
  }

  function responderLugar(chave: string) {
    cronometro.marcar();
    const certo = respostaCentro === central.chave && chave === posicao.chave;

    if (certo) {
      setAcertos((a) => a + 1);
      // Acertou: encurta o tempo (fica mais difícil). Errou: alarga.
      setTempo((t) => {
        const novo = Math.max(TEMPO_MINIMO, Math.round(t * 0.75));
        setMelhorTempo((m) => Math.min(m, novo));
        return novo;
      });
    } else {
      setErros((e) => e + 1);
      setTempo((t) => Math.min(TEMPO_INICIAL, Math.round(t * 1.4)));
    }

    setUltimoAcerto(certo);
    setFase("resultado");
  }

  function proxima() {
    if (rodada >= RODADAS) {
      setFase("fim");
      return;
    }
    setRodada((r) => r + 1);
    mostrar();
  }

  const reiniciar = useCallback(() => {
    setRodada(1);
    setTempo(TEMPO_INICIAL);
    setMelhorTempo(TEMPO_INICIAL);
    setAcertos(0);
    setErros(0);
    setFase("pronto");
    inicio.current = new Date().toISOString();
    salvou.current = false;
  }, []);

  const pontuacao = acertos * 10 + Math.round((TEMPO_INICIAL - melhorTempo) / 10);

  useEffect(() => {
    if (fase !== "fim" || salvou.current || !jogo) return;
    salvou.current = true;
    void salvarSessao(jogo.id, {
      pontuacao,
      acertos,
      erros,
      tempoMedioResposta: cronometro.media(),
      dificuldade: dificuldadePor(melhorTempo),
      iniciadaEm: inicio.current,
    });
  }, [fase, acertos, erros, jogo, melhorTempo, pontuacao, cronometro]);

  const instrucao = {
    pronto: "Olhe para o centro da tela e toque em Começar.",
    mostrando: "Atenção!",
    "pergunta-centro": "O que apareceu no meio?",
    "pergunta-lugar": "E onde apareceu a estrela?",
    resultado: ultimoAcerto ? "Acertou!" : "Quase!",
    fim: "",
  }[fase];

  if (carregando) {
    return (
      <MolduraJogo titulo="Olhar rápido" instrucao="Carregando…" voltarPara="/jogos">
        <p className="text-xl text-tinta-suave">Um instante…</p>
      </MolduraJogo>
    );
  }

  return (
    <MolduraJogo
      titulo="Olhar rápido"
      instrucao="Veja as duas figuras num piscar e diga o que eram."
      voltarPara="/jogos"
    >
      {fase === "fim" ? (
        <TelaFinal
          acertos={acertos}
          erros={erros}
          pontuacao={pontuacao}
          destaque={`Seu olhar mais rápido: ${melhorTempo} milésimos de segundo`}
          aoJogarDeNovo={reiniciar}
        />
      ) : (
        <div className="flex w-full max-w-xl flex-col items-center gap-6">
          <Progresso atual={rodada} total={RODADAS} />
          <Instrucao>{instrucao}</Instrucao>

          <Palco
            mostrando={fase === "mostrando"}
            central={central}
            posicao={posicao}
          />

          {fase === "pronto" && (
            <BotaoGrande onClick={mostrar} dica="As figuras aparecem bem rápido">
              Começar
            </BotaoGrande>
          )}

          {fase === "pergunta-centro" && (
            <div className="grid w-full grid-cols-2 gap-4">
              {CENTRAIS.map((c) => (
                <BotaoGrande
                  key={c.chave}
                  variante="secundario"
                  onClick={() => responderCentro(c.chave)}
                >
                  {/* A figura faz parte do jogo, não é enfeite: é ela que a
                      pessoa tenta reconhecer. */}
                  <span aria-hidden="true" className="mr-3 text-3xl">
                    {c.emoji}
                  </span>
                  {c.nome}
                </BotaoGrande>
              ))}
            </div>
          )}

          {fase === "pergunta-lugar" && (
            <ul className="grid w-full grid-cols-3 gap-3">
              {[
                "cima-esquerda", "cima", "cima-direita",
                "esquerda", null, "direita",
                "baixo-esquerda", "baixo", "baixo-direita",
              ].map((chave, i) =>
                chave === null ? (
                  <li key={i} aria-hidden="true" className="flex items-center justify-center text-4xl">
                    {central.emoji}
                  </li>
                ) : (
                  <li key={chave}>
                    <button
                      type="button"
                      onClick={() => responderLugar(chave)}
                      aria-label={POSICOES.find((p) => p.chave === chave)!.nome}
                      className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-borda bg-superficie text-3xl transition hover:border-marca active:bg-marca-clara"
                    >
                      <span aria-hidden="true">⭐</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}

          {fase === "resultado" && (
            <div className="flex w-full flex-col gap-4">
              <p className="text-center text-xl">
                Era <strong>{central.nome}</strong> no meio e a estrela{" "}
                <strong>{posicao.nome}</strong>.
              </p>
              <BotaoGrande onClick={proxima}>
                {rodada >= RODADAS ? "Ver resultado" : "Próxima"}
              </BotaoGrande>
            </div>
          )}
        </div>
      )}
    </MolduraJogo>
  );
}

/** Área do estímulo: figura no centro e alvo periférico num círculo ao redor. */
function Palco({
  mostrando,
  central,
  posicao,
}: {
  mostrando: boolean;
  central: (typeof CENTRAIS)[number];
  posicao: (typeof POSICOES)[number];
}) {
  const raio = 42; // em % do lado do palco
  const rad = (posicao.angulo * Math.PI) / 180;
  const x = 50 + raio * Math.cos(rad);
  const y = 50 + raio * Math.sin(rad);

  return (
    <div className="relative aspect-square w-full max-w-sm rounded-full border-4 border-borda bg-superficie">
      {/* Fora do estímulo fica só o ponto de fixação, que é onde a pessoa
          precisa manter o olhar entre uma rodada e outra. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl text-tinta-suave"
      >
        {mostrando ? central.emoji : "+"}
      </span>

      {mostrando && (
        <span
          aria-hidden="true"
          className="absolute -translate-x-1/2 -translate-y-1/2 text-4xl"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          ⭐
        </span>
      )}
    </div>
  );
}
