import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">Esta página não existe</h1>
      <p className="max-w-md text-lg text-tinta-suave">
        O endereço pode ter mudado. Volte para o início e tente de novo. Se
        precisar, chame um cuidador.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="rounded-2xl bg-marca px-8 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-marca-escura"
        >
          Voltar ao início
        </Link>
        <Link
          href="/curador"
          className="rounded-2xl border-2 border-borda bg-superficie px-8 py-4 text-lg font-semibold text-tinta transition hover:border-marca"
        >
          Área do curador
        </Link>
      </div>
    </main>
  );
}
