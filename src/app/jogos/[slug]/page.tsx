import { notFound } from "next/navigation";

import AssociacaoPalavras from "@/components/jogos/AssociacaoPalavras";
import MemoriaCartas from "@/components/jogos/MemoriaCartas";
import SequenciaNumerica from "@/components/jogos/SequenciaNumerica";

export default async function PaginaJogo({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  switch (slug) {
    case "memoria-cartas":
      return <MemoriaCartas slug={slug} />;
    case "sequencia-numerica":
      return <SequenciaNumerica slug={slug} />;
    case "associacao-palavras":
      return <AssociacaoPalavras slug={slug} />;
    default:
      notFound();
  }
}
