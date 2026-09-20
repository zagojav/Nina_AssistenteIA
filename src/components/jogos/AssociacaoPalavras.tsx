"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MolduraJogo,
  TelaFinal,
  useCronometro,
  useJogo,
  salvarSessao,
} from "@/components/jogos/comum";

interface Questao {
  palavra: string;
  certa: string;
  erradas: [string, string];
}

/** Questão já com as alternativas embaralhadas fora do render. */
interface QuestaoSorteada extends Questao {
  alternativas: string[];
}

const BANCO: Questao[] = [
  { palavra: "Café", certa: "Xícara", erradas: ["Martelo", "Bicicleta"] },
  { palavra: "Chuva", certa: "Guarda-chuva", erradas: ["Frigideira", "Meia"] },
  { palavra: "Agulha", certa: "Linha", erradas: ["Panela", "Rádio"] },
  { palavra: "Sapato", certa: "Pé", erradas: ["Colher", "Janela"] },
  { palavra: "Pão", certa: "Manteiga", erradas: ["Tesoura", "Cadeira"] },
  { palavra: "Chave", certa: "Porta", erradas: ["Travesseiro", "Laranja"] },
  { palavra: "Lápis", certa: "Papel", erradas: ["Sabão", "Cortina"] },
  { palavra: "Escova", certa: "Cabelo", erradas: ["Garfo", "Tijolo"] },
];

const RODADAS = 6;

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * O sorteio acontece fora do render (estado inicial e ao reiniciar). Embaralhar
 * durante o render faria as alternativas trocarem de lugar a cada re-render,
 * bem na hora em que a pessoa está decidindo onde tocar.
 */
function sortear(): QuestaoSorteada[] {
  return embaralhar(BANCO)
    .slice(0, RODADAS)
    .map((q) => ({ ...q, alternativas: embaralhar([q.certa, ...q.erradas]) }));
}

export default function AssociacaoPalavras({ slug }: { slug: string }) {
  const { jogo, carregando } = useJogo(slug);
  const cronometro = useCronometro();

  const [questoes, setQuestoes] = useState<QuestaoSorteada[]>(sortear);
  const [indice, setIndice] = useState(0);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [fim, setFim] = useState(false);
  const inicio = useRef(new Date().toISOString());
  const salvou = useRef(false);

  const atual = questoes[indice];

  function responder(opcao: string) {
    if (escolhida) return;
    cronometro.marcar();
    setEscolhida(opcao);

    if (opcao === atual.certa) setAcertos((a) => a + 1);
    else setErros((e) => e + 1);

    setTimeout(() => {
      setEscolhida(null);
      if (indice + 1 >= questoes.length) setFim(true);
      else setIndice((i) => i + 1);
    }, 1100);
  }

  const reiniciar = useCallback(() => {
    setQuestoes(sortear());
    setIndice(0);
    setAcertos(0);
    setErros(0);
    setEscolhida(null);
    setFim(false);
    inicio.current = new Date().toISOString();
    salvou.current = false;
    cronometro.reiniciar();
  }, [cronometro]);

  useEffect(() => {
    if (!fim || salvou.current || !jogo) return;
    salvou.current = true;
    void salvarSessao(jogo.id, {
      pontuacao: acertos * 20,
      acertos,
      erros,
      tempoMedioResposta: cronometro.media(),
      dificuldade: "facil",
      iniciadaEm: inicio.current,
    });
  }, [fim, acertos, erros, jogo, cronometro]);

  if (carregando) {
    return (
      <MolduraJogo titulo="Associação de palavras" instrucao="Carregando…">
        <p className="text-xl text-tinta-suave">Um instante…</p>
      </MolduraJogo>
    );
  }

  return (
    <MolduraJogo
      titulo="Associação de palavras"
      instrucao="Escolha a palavra que combina com a de cima."
    >
      {fim ? (
        <TelaFinal
          acertos={acertos}
          erros={erros}
          pontuacao={acertos * 20}
          aoJogarDeNovo={reiniciar}
        />
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <p className="text-lg text-tinta-suave" aria-live="polite">
            Pergunta {indice + 1} de {questoes.length}
          </p>

          <p className="rounded-3xl bg-marca-clara px-10 py-8 text-4xl font-bold text-marca">
            {atual.palavra}
          </p>

          <ul className="flex w-full flex-col gap-3">
            {atual.alternativas.map((opcao) => {
              const revelada = escolhida !== null;
              const certa = opcao === atual.certa;
              return (
                <li key={opcao}>
                  <button
                    type="button"
                    onClick={() => responder(opcao)}
                    disabled={revelada}
                    className={`min-h-16 w-full rounded-2xl border-2 px-6 text-2xl font-semibold transition ${
                      revelada && certa
                        ? "border-marca bg-marca text-white"
                        : revelada && opcao === escolhida
                          ? "border-destaque bg-superficie text-destaque"
                          : "border-borda bg-superficie"
                    }`}
                  >
                    {opcao}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </MolduraJogo>
  );
}
