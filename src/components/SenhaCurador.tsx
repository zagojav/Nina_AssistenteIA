"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

import CampoSenha from "@/components/CampoSenha";
import { clientAuth } from "@/lib/firebase/client";

/**
 * Confirmação por credencial de curador.
 *
 * Usada nas duas portas de saída do tablet do residente: destravar o app
 * depois de perder o foco, e encerrar a sessão. Em nenhuma delas vale o PIN do
 * próprio idoso, se valesse, ele destrancaria a própria trava.
 *
 * A sessão do curador é encerrada no mesmo instante em que a senha confere: o
 * tablet do residente nunca fica com um curador logado.
 */
export default function SenhaCurador({
  titulo,
  descricao,
  rotuloConfirmar,
  aoConfirmar,
  aoCancelar,
}: {
  titulo: string;
  descricao: string;
  rotuloConfirmar: string;
  aoConfirmar: () => void | Promise<void>;
  aoCancelar?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setVerificando(true);
    setErro("");
    try {
      const auth = clientAuth();
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      await signOut(auth);
      await aoConfirmar();
    } catch {
      setErro("E-mail ou senha do curador não conferem.");
      setVerificando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-senha-curador"
      className="fixed inset-0 z-50 flex items-center justify-center bg-marca-escura/95 px-6"
    >
      <form
        onSubmit={confirmar}
        className="w-full max-w-md rounded-3xl bg-superficie p-8 shadow-xl"
      >
        <h2 id="titulo-senha-curador" className="text-2xl font-bold">
          {titulo}
        </h2>
        <p className="mt-2 text-lg text-tinta-suave">{descricao}</p>

        <label className="mt-6 flex flex-col gap-2 font-semibold">
          E-mail do curador
          <input
            autoFocus
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border-2 border-borda px-4 py-3 text-lg outline-none focus:border-marca"
          />
        </label>
        <div className="mt-4">
          <CampoSenha
            rotulo="Senha"
            valor={senha}
            aoMudar={setSenha}
            autoComplete="off"
          />
        </div>

        {erro && (
          <p role="alert" className="mt-3 font-semibold text-alerta">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={verificando || !email || !senha}
          className="mt-6 min-h-14 w-full rounded-2xl bg-marca text-xl font-bold text-white disabled:opacity-40"
        >
          {verificando ? "Verificando…" : rotuloConfirmar}
        </button>

        {aoCancelar && (
          <button
            type="button"
            onClick={aoCancelar}
            disabled={verificando}
            className="mt-3 min-h-14 w-full rounded-2xl border-2 border-borda text-lg font-semibold disabled:opacity-40"
          >
            Voltar para a conversa
          </button>
        )}
      </form>
    </div>
  );
}
