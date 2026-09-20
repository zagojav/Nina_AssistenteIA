import Link from "next/link";

import CatalogoJogos from "@/components/CatalogoJogos";

export default function PaginaJogos() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-borda bg-superficie px-5 py-4">
        <h1 className="text-2xl font-bold text-marca">Jogos</h1>
        <Link
          href="/conversa"
          className="min-h-12 rounded-2xl border-2 border-borda px-5 py-2 text-lg font-semibold"
        >
          Voltar
        </Link>
      </header>
      <CatalogoJogos />
    </div>
  );
}
