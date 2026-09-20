import type { Jogo } from "@/lib/types";

/** Catálogo inicial da coleção global `jogos`. */
export const JOGOS_SEMENTE: Omit<Jogo, "id">[] = [
  {
    slug: "memoria-cartas",
    nome: "Memória de cartas",
    tipo: "memoria",
    descricao: "Vire as cartas e encontre os pares iguais.",
    ativo: true,
  },
  {
    slug: "sequencia-numerica",
    nome: "Sequência numérica",
    tipo: "atencao",
    descricao: "Veja os números que acendem e repita na mesma ordem.",
    ativo: true,
  },
  {
    slug: "associacao-palavras",
    nome: "Associação de palavras",
    tipo: "linguagem",
    descricao: "Escolha a palavra que combina com a que apareceu.",
    ativo: true,
  },
];
