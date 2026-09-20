import { notFound } from "next/navigation";

import ListaDeCompras from "@/components/jogos/ListaDeCompras";
import OlharRapido from "@/components/jogos/OlharRapido";
import QualVemDepois from "@/components/jogos/QualVemDepois";

export default async function PaginaJogo({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  switch (slug) {
    case "olhar-rapido":
      return <OlharRapido slug={slug} />;
    case "lista-de-compras":
      return <ListaDeCompras slug={slug} />;
    case "qual-vem-depois":
      return <QualVemDepois slug={slug} />;
    default:
      notFound();
  }
}
