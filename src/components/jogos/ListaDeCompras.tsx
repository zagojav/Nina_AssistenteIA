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

/*
 * Memória episódica verbal, o braço de "memory" do ACTIVE.
 *
 * O detalhe que faz diferença no ensaio: a estratégia era ENSINADA, não só
 * treinada. Aqui a lista já vem agrupada por tipo e a dica de agrupar aparece
 * escrita, porque organizar por categoria é justamente o que se quer que a
 * pessoa leve para a vida (a lista do mercado, os remédios do dia).
 *
 * O reconhecimento (escolher numa lista maior) é mais gentil que a evocação
 * livre e não pune quem tem dificuldade de nomear, o que importa aqui é
 * exercitar, não medir.
 */

interface Grupo {
  categoria: string;
  itens: string[];
}

const BANCO: Grupo[][] = [
  [
    { categoria: "Frutas", itens: ["banana", "laranja", "mamão"] },
    { categoria: "Padaria", itens: ["pão", "bolo", "biscoito"] },
    { categoria: "Limpeza", itens: ["sabão", "vassoura", "esponja"] },
  ],
  [
    { categoria: "Verduras", itens: ["alface", "cenoura", "tomate"] },
    { categoria: "Bebidas", itens: ["café", "suco", "leite"] },
    { categoria: "Roupas", itens: ["camisa", "meia", "casaco"] },
  ],
  [
    { categoria: "Cozinha", itens: ["panela", "colher", "prato"] },
    { categoria: "Remédios", itens: ["xarope", "pomada", "vitamina"] },
    { categoria: "Flores", itens: ["rosa", "margarida", "violeta"] },
  ],
];

const DISTRATORES = [
  "abacaxi", "queijo", "toalha", "chinelo", "manteiga", "caderno",
  "espelho", "guarda-chuva", "travesseiro", "chaveiro", "relógio", "sabonete",
];

const RODADAS = 3;
const SEGUNDOS_PARA_DECORAR = 20;

type Fase = "decorar" | "lembrar" | "resultado" | "fim";

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function montarRodada(indice: number) {
  const grupos = BANCO[indice % BANCO.length];
  const certas = grupos.flatMap((g) => g.itens);
  const erradas = embaralhar(DISTRATORES).slice(0, 6);
  return { grupos, certas, opcoes: embaralhar([...certas, ...erradas]) };
}

export default function ListaDeCompras({ slug }: { slug: string }) {
  const { jogo, carregando } = useJogo(slug);
  const cronometro = useCronometro();

  const [rodada, setRodada] = useState(0);
  const [dados, setDados] = useState(() => montarRodada(0));
  const [fase, setFase] = useState<Fase>("decorar");
  const [restante, setRestante] = useState(SEGUNDOS_PARA_DECORAR);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);

  const inicio = useRef(new Date().toISOString());
  const salvou = useRef(false);

  // Contagem regressiva da memorização. A pessoa pode adiantar quando quiser:
  // esperar o relógio zerar sem precisar é tempo perdido e gera ansiedade.
  useEffect(() => {
    if (fase !== "decorar") return;
    if (restante <= 0) {
      setFase("lembrar");
      cronometro.reiniciar();
      return;
    }
    const t = setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [fase, restante, cronometro]);

  function alternar(palavra: string) {
    setMarcadas((atual) =>
      atual.includes(palavra)
        ? atual.filter((p) => p !== palavra)
        : [...atual, palavra],
    );
  }

  function conferir() {
    cronometro.marcar();
    const certos = marcadas.filter((p) => dados.certas.includes(p)).length;
    const enganos =
      marcadas.filter((p) => !dados.certas.includes(p)).length +
      (dados.certas.length - certos);

    setAcertos((a) => a + certos);
    setErros((e) => e + enganos);
    setFase("resultado");
  }

  function proxima() {
    const seguinte = rodada + 1;
    if (seguinte >= RODADAS) {
      setFase("fim");
      return;
    }
    setRodada(seguinte);
    setDados(montarRodada(seguinte));
    setMarcadas([]);
    setRestante(SEGUNDOS_PARA_DECORAR);
    setFase("decorar");
  }

  const reiniciar = useCallback(() => {
    setRodada(0);
    setDados(montarRodada(0));
    setMarcadas([]);
    setRestante(SEGUNDOS_PARA_DECORAR);
    setAcertos(0);
    setErros(0);
    setFase("decorar");
    inicio.current = new Date().toISOString();
    salvou.current = false;
  }, []);

  const pontuacao = Math.max(0, acertos * 10 - erros * 5);

  useEffect(() => {
    if (fase !== "fim" || salvou.current || !jogo) return;
    salvou.current = true;
    void salvarSessao(jogo.id, {
      pontuacao,
      acertos,
      erros,
      tempoMedioResposta: cronometro.media(),
      dificuldade: "medio",
      iniciadaEm: inicio.current,
    });
  }, [fase, acertos, erros, jogo, pontuacao, cronometro]);

  if (carregando) {
    return (
      <MolduraJogo titulo="Lista de compras" instrucao="Carregando…" voltarPara="/jogos">
        <p className="text-xl text-tinta-suave">Um instante…</p>
      </MolduraJogo>
    );
  }

  return (
    <MolduraJogo
      titulo="Lista de compras"
      instrucao="Guarde a lista e depois reconheça o que estava nela."
      voltarPara="/jogos"
    >
      {fase === "fim" ? (
        <TelaFinal
          acertos={acertos}
          erros={erros}
          pontuacao={pontuacao}
          destaque="Agrupar por tipo é a mesma dica que serve no mercado e na farmácia."
          aoJogarDeNovo={reiniciar}
        />
      ) : (
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <Progresso atual={rodada + 1} total={RODADAS} rotulo="Lista" />

          {fase === "decorar" && (
            <>
              <Instrucao>
                Guarde estas 9 coisas. Faltam {restante} segundos.
              </Instrucao>
              <p className="rounded-2xl bg-superficie px-5 py-3 text-center text-lg text-tinta-suave">
                <strong>Dica:</strong> guarde por grupos. Lembrar “três frutas,
                três da padaria, três de limpeza” é bem mais fácil que lembrar
                nove coisas soltas.
              </p>

              <ul className="grid w-full gap-4 sm:grid-cols-3">
                {dados.grupos.map((g) => (
                  <li
                    key={g.categoria}
                    className="rounded-3xl border-2 border-borda bg-superficie p-5"
                  >
                    <p className="text-lg font-bold text-marca">{g.categoria}</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {g.itens.map((item) => (
                        <li key={item} className="text-2xl font-semibold">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              <BotaoGrande
                onClick={() => {
                  setFase("lembrar");
                  cronometro.reiniciar();
                }}
                dica="Sem pressa, só toque quando tiver guardado"
              >
                Já guardei
              </BotaoGrande>
            </>
          )}

          {fase === "lembrar" && (
            <>
              <Instrucao>Toque no que estava na lista.</Instrucao>
              <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                {dados.opcoes.map((palavra) => {
                  const marcada = marcadas.includes(palavra);
                  return (
                    <li key={palavra}>
                      <button
                        type="button"
                        onClick={() => alternar(palavra)}
                        aria-pressed={marcada}
                        className={`min-h-18 w-full rounded-2xl border-2 px-3 text-xl font-semibold transition ${
                          marcada
                            ? "border-marca bg-marca text-white"
                            : "border-borda bg-superficie text-tinta hover:border-marca"
                        }`}
                      >
                        {palavra}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <BotaoGrande
                onClick={conferir}
                disabled={!marcadas.length}
                dica={`${marcadas.length} marcada(s)`}
              >
                Conferir
              </BotaoGrande>
            </>
          )}

          {fase === "resultado" && (
            <>
              <Instrucao>Veja como você foi</Instrucao>
              <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
                {dados.opcoes.map((palavra) => {
                  const eraDaLista = dados.certas.includes(palavra);
                  const marcada = marcadas.includes(palavra);
                  if (!eraDaLista && !marcada) return null;
                  return (
                    <li
                      key={palavra}
                      className={`min-h-18 rounded-2xl border-2 px-3 py-4 text-center text-xl font-semibold ${
                        eraDaLista && marcada
                          ? "border-marca bg-marca-clara text-marca"
                          : eraDaLista
                            ? "border-borda bg-superficie text-tinta-suave"
                            : "border-destaque bg-superficie text-destaque"
                      }`}
                    >
                      {palavra}
                      <span className="mt-1 block text-sm font-normal">
                        {eraDaLista && marcada
                          ? "você lembrou"
                          : eraDaLista
                            ? "estava na lista"
                            : "não estava na lista"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <BotaoGrande onClick={proxima}>
                {rodada + 1 >= RODADAS ? "Ver resultado" : "Próxima lista"}
              </BotaoGrande>
            </>
          )}
        </div>
      )}
    </MolduraJogo>
  );
}
