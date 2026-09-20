"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { dispositivoId } from "@/lib/dispositivo";

type Etapa = "verificando" | "identificacao" | "pin";

export default function LoginIdoso() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("verificando");
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const tentouAutomatico = useRef(false);

  // Tablet já vinculado entra direto, sem PIN.
  useEffect(() => {
    if (tentouAutomatico.current) return;
    tentouAutomatico.current = true;

    (async () => {
      try {
        const resposta = await fetch("/api/idoso/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dispositivoId: dispositivoId() }),
        });
        if (resposta.ok) {
          router.replace("/conversa");
          return;
        }
      } catch {
        // rede indisponível: cai na identificação manual
      }
      setEtapa("identificacao");
    })();
  }, [router]);

  // Recebe o PIN por parâmetro: quando o 4º dígito dispara o envio, o estado
  // ainda não chegou neste closure e um PIN de 3 dígitos iria para o servidor.
  async function entrar(valorPin: string) {
    setEnviando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/idoso/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome,
          sobrenome,
          pin: valorPin,
          dispositivoId: dispositivoId(),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui entrar.");
        setPin("");
        setEnviando(false);
        return;
      }
      router.replace("/conversa");
    } catch {
      setErro("Sem conexão. Chame um cuidador.");
      setEnviando(false);
    }
  }

  function digitar(algarismo: string) {
    if (enviando) return;
    setErro("");
    setPin((atual) => {
      const novo = (atual + algarismo).slice(0, 4);
      // Pequena pausa para o 4º ponto aparecer preenchido antes do envio.
      if (novo.length === 4) setTimeout(() => void entrar(novo), 150);
      return novo;
    });
  }

  if (etapa === "verificando") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-xl text-tinta-suave" aria-live="polite">
          Um instante…
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-marca">Olá! Eu sou a Nina</h1>
        <p className="mt-3 text-xl text-tinta-suave">
          {etapa === "identificacao"
            ? "Como você se chama?"
            : "Agora digite seu número de 4 dígitos"}
        </p>
      </header>

      {etapa === "identificacao" ? (
        <form
          className="flex w-full max-w-md flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim() && sobrenome.trim()) setEtapa("pin");
          }}
        >
          <label className="flex flex-col gap-2 text-lg font-semibold">
            Primeiro nome
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="given-name"
              className="rounded-2xl border-2 border-borda bg-superficie px-5 py-4 text-2xl outline-none focus:border-marca"
            />
          </label>
          <label className="flex flex-col gap-2 text-lg font-semibold">
            Sobrenome
            <input
              value={sobrenome}
              onChange={(e) => setSobrenome(e.target.value)}
              autoComplete="family-name"
              className="rounded-2xl border-2 border-borda bg-superficie px-5 py-4 text-2xl outline-none focus:border-marca"
            />
          </label>
          <button
            type="submit"
            disabled={!nome.trim() || !sobrenome.trim()}
            className="mt-2 min-h-16 rounded-2xl bg-marca text-2xl font-bold text-white shadow-sm transition hover:bg-marca-escura disabled:opacity-40"
          >
            Continuar
          </button>
        </form>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="flex gap-4" aria-label={`${pin.length} de 4 dígitos digitados`}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-6 w-6 rounded-full border-2 ${
                  pin.length > i ? "border-marca bg-marca" : "border-borda bg-superficie"
                }`}
              />
            ))}
          </div>

          <div className="grid w-full grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => digitar(d)}
                disabled={enviando}
                className="min-h-20 rounded-2xl border-2 border-borda bg-superficie text-3xl font-bold transition active:bg-marca-clara disabled:opacity-40"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin("");
                setErro("");
              }}
              className="min-h-20 rounded-2xl border-2 border-borda bg-superficie text-lg font-semibold text-tinta-suave"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => digitar("0")}
              disabled={enviando}
              className="min-h-20 rounded-2xl border-2 border-borda bg-superficie text-3xl font-bold transition active:bg-marca-clara disabled:opacity-40"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPin((p) => p.slice(0, -1))}
              className="min-h-20 rounded-2xl border-2 border-borda bg-superficie text-lg font-semibold text-tinta-suave"
            >
              Apagar
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEtapa("identificacao");
              setPin("");
              setErro("");
            }}
            className="text-lg font-semibold text-marca underline"
          >
            Voltar e corrigir meu nome
          </button>
        </div>
      )}

      <p role="alert" aria-live="assertive" className="min-h-8 text-center text-lg font-semibold text-alerta">
        {erro}
      </p>

      <Link href="/curador" className="text-base text-tinta-suave underline">
        Área do curador
      </Link>
    </main>
  );
}
