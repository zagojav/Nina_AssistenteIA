"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";

import { clientAuth } from "@/lib/firebase/client";

export default function Cabecalho({
  titulo,
  subtitulo,
  voltarPara,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-borda bg-superficie px-5 py-4">
      <div className="min-w-0">
        {voltarPara && (
          <Link href={voltarPara} className="text-base font-semibold text-marca underline">
            ← Voltar
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold">{titulo}</h1>
        {subtitulo && <p className="truncate text-base text-tinta-suave">{subtitulo}</p>}
      </div>
      <button
        type="button"
        onClick={() => signOut(clientAuth())}
        className="min-h-12 shrink-0 rounded-2xl border-2 border-borda px-5 font-semibold"
      >
        Sair
      </button>
    </header>
  );
}
