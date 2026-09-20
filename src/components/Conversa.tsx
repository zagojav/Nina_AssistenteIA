"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import GuardaKiosk from "@/components/GuardaKiosk";
import SenhaCurador from "@/components/SenhaCurador";
import { LinkGrande } from "@/components/ui";
import { esquecerDispositivo } from "@/lib/dispositivo";
import { calarBoca, criarReconhecimento, falar, vozDisponivel } from "@/lib/voz";
import type { ModoEntrada } from "@/lib/types";

interface Fala {
  autor: "ia" | "idoso";
  texto: string;
}

interface Perfil {
  id: string;
  nome: string;
  sobrenome: string;
  modoPreferido: ModoEntrada;
  kioskAtivo: boolean;
}

export default function Conversa() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoEntrada>("texto");
  const [rascunho, setRascunho] = useState("");
  const [pensando, setPensando] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [encerrada, setEncerrada] = useState(false);
  const [erro, setErro] = useState("");
  const [temVoz, setTemVoz] = useState(false);
  const [pedindoSaida, setPedindoSaida] = useState(false);

  const fimDaLista = useRef<HTMLDivElement>(null);
  const iniciou = useRef(false);
  const reconhecimento = useRef<ReturnType<typeof criarReconhecimento>>(null);

  // Carrega o perfil e abre a conversa (uma vez só).
  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    setTemVoz(vozDisponivel());

    (async () => {
      const meu = await fetch("/api/idoso/me");
      if (!meu.ok) {
        router.replace("/");
        return;
      }
      const dados: Perfil = await meu.json();
      setPerfil(dados);
      const modoInicial = dados.modoPreferido ?? "texto";
      setModo(modoInicial);

      setPensando(true);
      const resposta = await fetch("/api/conversa/iniciar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modoEntrada: modoInicial }),
      });
      const conversa = await resposta.json();
      setPensando(false);

      if (!resposta.ok) {
        setErro(conversa.erro ?? "Não consegui começar a conversa.");
        return;
      }
      setConversaId(conversa.conversaId);
      setFalas([{ autor: "ia", texto: conversa.texto }]);
      if (modoInicial === "voz") falar(conversa.texto);
    })();
  }, [router]);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [falas, pensando]);

  const enviar = useCallback(
    async (texto: string) => {
      const limpo = texto.trim();
      if (!limpo || !conversaId || pensando || encerrada) return;

      calarBoca();
      setRascunho("");
      setFalas((atual) => [...atual, { autor: "idoso", texto: limpo }]);
      setPensando(true);
      setErro("");

      try {
        const resposta = await fetch("/api/conversa/mensagem", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversaId, texto: limpo }),
        });
        const dados = await resposta.json();
        setPensando(false);

        if (!resposta.ok) {
          setErro(dados.erro ?? "A Nina não respondeu. Tente de novo.");
          return;
        }

        setFalas((atual) => [...atual, { autor: "ia", texto: dados.texto }]);
        if (modo === "voz") falar(dados.texto);

        if (dados.encerrada) {
          setEncerrada(true);
          // Análise, indícios e relatório rodam no servidor; a tela não espera.
          void fetch("/api/conversa/finalizar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ conversaId }),
          });
        }
      } catch {
        setPensando(false);
        setErro("Sem conexão. Chame um cuidador.");
      }
    },
    [conversaId, pensando, encerrada, modo],
  );

  function alternarMicrofone() {
    if (ouvindo) {
      reconhecimento.current?.stop();
      setOuvindo(false);
      return;
    }

    calarBoca();
    const r = criarReconhecimento();
    if (!r) {
      setErro("Este aparelho não reconhece voz. Use o teclado.");
      return;
    }
    reconhecimento.current = r;

    let capturado = "";
    r.onresult = (e) => {
      capturado = "";
      for (let i = 0; i < e.results.length; i++) {
        capturado += e.results[i][0].transcript;
      }
      setRascunho(capturado);
    };
    r.onerror = () => {
      setOuvindo(false);
      setErro("Não consegui ouvir. Tente de novo ou use o teclado.");
    };
    r.onend = () => {
      setOuvindo(false);
      if (capturado.trim()) void enviar(capturado);
    };

    setErro("");
    setOuvindo(true);
    r.start();
  }

  async function trocarModo(novo: ModoEntrada) {
    calarBoca();
    reconhecimento.current?.abort();
    setOuvindo(false);
    setModo(novo);
    await fetch("/api/idoso/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ modoPreferido: novo }),
    }).catch(() => {});
  }

  /**
   * Saída do tablet, só depois de a senha do curador conferir.
   *
   * Desfaz o vínculo do aparelho junto com a sessão. Sem isso a tela inicial
   * reconheceria o dispositivo e entraria de novo na mesma conta na hora,
   * e "sair" não sairia de nada. O residente volta a entrar com nome e PIN,
   * o que revincula o tablet.
   */
  async function sairDeVez() {
    calarBoca();
    reconhecimento.current?.abort();
    esquecerDispositivo();
    await fetch("/api/idoso/me", { method: "DELETE" }).catch(() => {});
    router.replace("/");
  }

  return (
    <>
      <GuardaKiosk ativo={Boolean(perfil?.kioskAtivo)} />

      {pedindoSaida && (
        <SenhaCurador
          titulo="Sair desta conta"
          descricao={
            perfil
              ? `Isso encerra a sessão de ${perfil.nome} e volta para a tela inicial. Só um curador pode fazer isso.`
              : "Isso encerra a sessão e volta para a tela inicial. Só um curador pode fazer isso."
          }
          rotuloConfirmar="Sair da conta"
          aoConfirmar={sairDeVez}
          aoCancelar={() => setPedindoSaida(false)}
        />
      )}

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-borda bg-superficie px-5 py-4">
          <div>
            <h1 className="text-2xl font-bold text-marca">Nina</h1>
            {perfil && (
              <p className="text-base text-tinta-suave">
                Conversando com {perfil.nome}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/jogos"
              className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-borda bg-fundo px-4 text-lg font-bold text-tinta transition hover:border-marca"
            >
              Jogos
            </Link>

          {temVoz && (
            <div
              className="flex rounded-2xl border-2 border-borda bg-fundo p-1"
              role="group"
              aria-label="Modo de conversa"
            >
              {(["texto", "voz"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => trocarModo(m)}
                  aria-pressed={modo === m}
                  className={`min-h-12 rounded-xl px-5 text-lg font-semibold transition ${
                    modo === m ? "bg-marca text-white" : "text-tinta-suave"
                  }`}
                >
                  {m === "texto" ? "Escrever" : "Falar"}
                </button>
              ))}
            </div>
          )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6">
          <ul className="mx-auto flex max-w-2xl flex-col gap-4">
            {falas.map((fala, i) => (
              <li
                key={i}
                className={fala.autor === "ia" ? "self-start" : "self-end"}
              >
                <p
                  className={`max-w-[85vw] rounded-3xl px-6 py-4 text-xl leading-relaxed sm:max-w-lg ${
                    fala.autor === "ia"
                      ? "bg-marca-clara text-tinta"
                      : "bg-marca text-white"
                  }`}
                >
                  <span className="sr-only">
                    {fala.autor === "ia" ? "Nina disse: " : "Você disse: "}
                  </span>
                  {fala.texto}
                </p>
              </li>
            ))}

            {pensando && (
              <li className="self-start" aria-live="polite">
                <p className="rounded-3xl bg-marca-clara px-6 py-4 text-xl text-tinta-suave">
                  Nina está escrevendo…
                </p>
              </li>
            )}
          </ul>
          <div ref={fimDaLista} />
        </main>

        {erro && (
          <p role="alert" className="px-5 pb-2 text-center text-lg font-semibold text-alerta">
            {erro}
          </p>
        )}

        {/* Barra fixa: os botões ficam sempre alcançáveis no tablet. */}
        <footer className="sticky bottom-0 border-t border-borda bg-superficie px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            {encerrada ? (
              <>
                <p className="text-center text-2xl font-semibold">
                  Conversa encerrada. Até logo!
                </p>
                <LinkGrande
                  href="/jogos"
                  dica="Exercícios curtos para a cabeça"
                >
                  Ir para os jogos
                </LinkGrande>
              </>
            ) : modo === "voz" ? (
              <>
                <p className="min-h-8 text-center text-lg text-tinta-suave" aria-live="polite">
                  {ouvindo ? "Estou ouvindo…" : rascunho || "Toque no botão e fale comigo"}
                </p>
                <button
                  type="button"
                  onClick={alternarMicrofone}
                  disabled={pensando || !conversaId}
                  className={`flex min-h-22 w-full flex-col items-center justify-center gap-1 rounded-3xl border-2 text-2xl font-bold text-white transition disabled:opacity-40 ${
                    ouvindo
                      ? "border-destaque bg-destaque"
                      : "border-marca bg-marca hover:bg-marca-escura"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {ouvindo ? "Terminei de falar" : "Falar com a Nina"}
                  </span>
                  <span className="text-base font-normal opacity-90">
                    {ouvindo ? "Toque quando terminar" : "Toque e fale no seu tempo"}
                  </span>
                </button>
              </>
            ) : (
              <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void enviar(rascunho);
                }}
              >
                <label htmlFor="mensagem" className="sr-only">
                  Escreva sua resposta
                </label>
                <input
                  id="mensagem"
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  placeholder="Escreva aqui…"
                  disabled={pensando || !conversaId}
                  className="min-h-18 flex-1 rounded-2xl border-2 border-borda bg-fundo px-5 text-xl outline-none focus:border-marca"
                />
                <button
                  type="submit"
                  disabled={pensando || !rascunho.trim() || !conversaId}
                  className="flex min-h-18 items-center justify-center gap-2 rounded-2xl bg-marca px-8 text-xl font-bold text-white transition hover:bg-marca-escura disabled:opacity-40"
                >
                  Enviar
                </button>
              </form>
            )}

            {/*
              Única porta de saída do app, sempre alcançável e sempre atrás da
              senha do curador. Discreta de propósito: o residente não deve ser
              convidado a sair, mas a equipe precisa conseguir sem reinstalar
              nada quando o tablet abre na conta errada.
            */}
            <button
              type="button"
              onClick={() => setPedindoSaida(true)}
              className="mx-auto mt-1 flex min-h-14 items-center gap-2 rounded-2xl px-5 text-base font-semibold text-tinta-suave transition hover:bg-marca-clara hover:text-marca"
            >
              Sair desta conta (precisa da senha do curador)
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}
