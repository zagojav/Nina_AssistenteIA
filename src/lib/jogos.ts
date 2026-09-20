import type { Jogo } from "@/lib/types";

/*
 * Catálogo global de jogos (coleção `jogos`).
 *
 * Os três replicam os três domínios treinados no ACTIVE (Advanced Cognitive
 * Training for Independent and Vital Elderly), o maior ensaio randomizado de
 * treino cognitivo em idosos, 2.832 participantes de 65 a 94 anos, com
 * acompanhamento de 20 anos. Cada braço treinou um domínio:
 *
 *   velocidade de processamento  -> paradigma Useful Field of View (UFOV):
 *       identificar uma figura central e localizar um alvo periférico, com o
 *       tempo de exibição encurtando conforme a pessoa acerta.
 *   memória episódica verbal     -> lembrar listas de palavras com estratégia
 *       de organização por categoria (a estratégia era ensinada, não só
 *       treinada às cegas).
 *   raciocínio indutivo          -> completar séries com padrão serial
 *       (letras, números, formas).
 *
 * Referências:
 * - Ball K, Berch DB, Helmers KF, et al. Effects of cognitive training
 *   interventions with older adults: the ACTIVE randomized controlled trial.
 *   JAMA. 2002;288(18):2271-2281.
 * - Rebok GW, Ball K, Guey LT, et al. Ten-year effects of the ACTIVE
 *   cognitive training trial. J Am Geriatr Soc. 2014;62(1):16-24.
 * - Edwards JD, Xu H, Clark DO, et al. Speed of processing training results in
 *   lower risk of dementia. Alzheimers Dement (N Y). 2017;3(4):603-611.
 * - Nguyen L, Murphy K, Andrews G. Immediate and long-term efficacy of
 *   executive functions cognitive training in older adults. Psychol Bull.
 *   2019;145(7):698-733.
 */
export const JOGOS_SEMENTE: Omit<Jogo, "id">[] = [
  {
    slug: "olhar-rapido",
    nome: "Olhar rápido",
    tipo: "atencao",
    descricao:
      "Duas figuras piscam na tela. Diga qual apareceu no meio e onde apareceu a estrela. Treina velocidade de percepção.",
    ativo: true,
  },
  {
    slug: "lista-de-compras",
    nome: "Lista de compras",
    tipo: "memoria",
    descricao:
      "Guarde a lista na cabeça agrupando por tipo e depois reconheça o que estava nela. Treina memória do dia a dia.",
    ativo: true,
  },
  {
    slug: "qual-vem-depois",
    nome: "Qual vem depois?",
    tipo: "raciocinio",
    descricao:
      "Descubra o padrão da sequência e escolha o que vem em seguida. Treina raciocínio.",
    ativo: true,
  },
];
