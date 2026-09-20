"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";

import CampoSenha from "@/components/CampoSenha";
import { clientAuth } from "@/lib/firebase/client";

export default function LoginCurador() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await signInWithEmailAndPassword(clientAuth(), email.trim(), senha);
    } catch {
      setErro("E-mail ou senha não conferem.");
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <form
        onSubmit={entrar}
        className="w-full max-w-md rounded-3xl border border-borda bg-superficie p-8 shadow-sm"
      >
        <h1 className="text-3xl font-bold text-marca">Área do curador</h1>
        <p className="mt-2 text-tinta-suave">
          Acesso restrito à equipe. O PIN do residente não entra aqui.
        </p>

        <label className="mt-8 flex flex-col gap-2 font-semibold">
          E-mail
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border-2 border-borda px-4 py-3 text-lg outline-none focus:border-marca"
          />
        </label>
        <div className="mt-4">
          <CampoSenha rotulo="Senha" valor={senha} aoMudar={setSenha} />
        </div>

        {erro && (
          <p role="alert" className="mt-4 font-semibold text-alerta">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !email || !senha}
          className="mt-8 min-h-14 w-full rounded-2xl bg-marca text-xl font-bold text-white disabled:opacity-40"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>

        {/* Sem isto, quem abre /curador por engano fica sem saída. */}
        <Link
          href="/"
          className="mt-3 flex min-h-14 items-center justify-center rounded-2xl border-2 border-borda text-lg font-semibold"
        >
          ← Voltar ao início
        </Link>
      </form>
    </main>
  );
}
