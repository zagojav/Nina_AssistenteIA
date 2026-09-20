import CatalogoJogos from "@/components/CatalogoJogos";
import { Voltar } from "@/components/ui";

export default function PaginaJogos() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-borda bg-superficie px-5 py-4">
        <div>
          <h1 className="text-2xl font-bold text-marca">Jogos</h1>
          <p className="text-base text-tinta-suave">
            Exercícios curtos para manter a cabeça ativa
          </p>
        </div>
        <Voltar href="/conversa" rotulo="Conversa" />
      </header>
      <CatalogoJogos />
    </div>
  );
}
