"use client";

import { useId, useState } from "react";

/**
 * Campo de senha com alternância mostrar/esconder.
 *
 * Começa escondido (o padrão seguro) e o botão do olho anuncia o estado por
 * `aria-pressed` e por rótulo escrito, não só pelo desenho, em tablet de
 * casa de repouso o ícone sozinho não comunica.
 */
export default function CampoSenha({
  rotulo,
  valor,
  aoMudar,
  autoComplete = "current-password",
  autoFocus = false,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [visivel, setVisivel] = useState(false);
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold">
        {rotulo}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="w-full rounded-2xl border-2 border-borda bg-superficie py-3 pl-4 pr-16 text-lg outline-none focus:border-marca"
        />

        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-pressed={visivel}
          aria-label={visivel ? "Esconder a senha" : "Mostrar a senha"}
          title={visivel ? "Esconder a senha" : "Mostrar a senha"}
          className="absolute inset-y-1 right-1 flex w-14 items-center justify-center rounded-xl text-tinta-suave transition hover:bg-marca-clara hover:text-marca"
        >
          {visivel ? <OlhoFechado /> : <OlhoAberto />}
        </button>
      </div>
    </div>
  );
}

function OlhoAberto() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OlhoFechado() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 4" />
      <path d="M6.3 6.4A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.2-1.4" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
