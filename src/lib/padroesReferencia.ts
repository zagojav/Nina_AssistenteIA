import type { PadraoReferencia } from "@/lib/types";

/**
 * Base de referência inicial (semente da coleção global `padroesReferencia`).
 *
 * Esta lista NÃO é gerada por IA e não deve ser ampliada pelo modelo: é o
 * catálogo fechado contra o qual a transcrição é comparada. Cada item aponta a
 * fonte que descreve o padrão comportamental, nenhum deles é critério
 * diagnóstico e nenhum, isoladamente, significa doença.
 *
 * Revise com a equipe clínica da instituição antes de usar em produção:
 * é aqui que se define o que o sistema é capaz de observar.
 */
export const PADROES_SEMENTE: Omit<PadraoReferencia, "id">[] = [
  {
    tipo: "repeticao_curta",
    descricaoPadrao:
      "A pessoa repete a mesma pergunta, história ou informação dentro da mesma conversa, sem indicar reconhecer que já havia dito.",
    fonteReferencia:
      "Alzheimer's Association, 10 Early Signs and Symptoms of Alzheimer's, sinal 2 (asking the same questions over and over). https://www.alz.org/alzheimers-dementia/10_signs",
    categoriaRelacionada: "memoria_recente",
    ativo: true,
  },
  {
    tipo: "esquecimento_evento_recente",
    descricaoPadrao:
      "A pessoa não recorda evento recente e concreto do próprio dia (refeição feita, visita recebida, atividade realizada) quando perguntada de forma aberta.",
    fonteReferencia:
      "American Psychiatric Association, DSM-5-TR, domínio de aprendizagem e memória nos Transtornos Neurocognitivos (2022).",
    categoriaRelacionada: "memoria_recente",
    ativo: true,
  },
  {
    tipo: "desorientacao_temporal",
    descricaoPadrao:
      "A pessoa erra ou não sabe informar dia da semana, período do dia, mês ou época do ano, ou confunde datas próximas.",
    fonteReferencia:
      "Folstein MF, Folstein SE, McHugh PR. Mini-Mental State Examination, itens de orientação temporal. J Psychiatr Res, 1975;12(3):189-198.",
    categoriaRelacionada: "orientacao_tempo",
    ativo: true,
  },
  {
    tipo: "desorientacao_espacial",
    descricaoPadrao:
      "A pessoa demonstra dúvida sobre onde está, confunde cômodos ou locais da instituição, ou relata ter se perdido em trajeto conhecido.",
    fonteReferencia:
      "Folstein MF et al. Mini-Mental State Examination, itens de orientação espacial. J Psychiatr Res, 1975;12(3):189-198.",
    categoriaRelacionada: "orientacao_espaco",
    ativo: true,
  },
  {
    tipo: "dificuldade_encontrar_palavra",
    descricaoPadrao:
      "A pessoa interrompe a fala procurando palavra comum, substitui por termo genérico ('aquela coisa', 'o negócio') ou troca o nome de objeto conhecido.",
    fonteReferencia:
      "Alzheimer's Association, 10 Early Signs and Symptoms of Alzheimer's, sinal 7 (new problems with words in speaking or writing). https://www.alz.org/alzheimers-dementia/10_signs",
    categoriaRelacionada: "memoria_recente",
    ativo: true,
  },
  {
    tipo: "narrativa_desorganizada",
    descricaoPadrao:
      "O relato perde encadeamento: a pessoa muda de assunto no meio da frase, mistura épocas diferentes ou não conclui a ideia iniciada.",
    fonteReferencia:
      "American Psychiatric Association, DSM-5-TR, domínio de linguagem e função executiva nos Transtornos Neurocognitivos (2022).",
    categoriaRelacionada: "memoria_recente",
    ativo: true,
  },
  {
    tipo: "relato_humor_deprimido",
    descricaoPadrao:
      "A pessoa relata tristeza persistente, desânimo, choro ou sensação de vazio ao falar de como está se sentindo.",
    fonteReferencia:
      "Alexopoulos GS et al. Cornell Scale for Depression in Dementia, itens de humor. Biol Psychiatry, 1988;23(3):271-284.",
    categoriaRelacionada: "humor",
    ativo: true,
  },
  {
    tipo: "perda_de_interesse",
    descricaoPadrao:
      "A pessoa relata ter deixado de gostar ou de participar de atividades, visitas ou convivências que antes a agradavam.",
    fonteReferencia:
      "Alexopoulos GS et al. Cornell Scale for Depression in Dementia, item de perda de interesse. Biol Psychiatry, 1988;23(3):271-284.",
    categoriaRelacionada: "humor",
    ativo: true,
  },
  {
    tipo: "relato_ansiedade_agitacao",
    descricaoPadrao:
      "A pessoa relata inquietação, preocupação recorrente, medo sem objeto definido ou vontade de 'ir embora' de forma repetida.",
    fonteReferencia:
      "Alexopoulos GS et al. Cornell Scale for Depression in Dementia, itens de ansiedade e agitação. Biol Psychiatry, 1988;23(3):271-284.",
    categoriaRelacionada: "humor",
    ativo: true,
  },
  {
    tipo: "sono_fragmentado",
    descricaoPadrao:
      "A pessoa relata acordar várias vezes durante a noite, dificuldade para voltar a dormir ou despertar muito antes do horário habitual.",
    fonteReferencia:
      "Buysse DJ et al. The Pittsburgh Sleep Quality Index, componentes de latência e distúrbios do sono. Psychiatry Res, 1989;28(2):193-213.",
    categoriaRelacionada: "sono",
    ativo: true,
  },
  {
    tipo: "inversao_ciclo_sono",
    descricaoPadrao:
      "A pessoa relata dormir durante boa parte do dia e ficar acordada à noite, ou confunde noite e dia ao descrever a rotina.",
    fonteReferencia:
      "Buysse DJ et al. The Pittsburgh Sleep Quality Index, componente de disfunção diurna. Psychiatry Res, 1989;28(2):193-213.",
    categoriaRelacionada: "sono",
    ativo: true,
  },
  {
    tipo: "reducao_ingesta",
    descricaoPadrao:
      "A pessoa relata ter comido pouco, pulado refeições, perdido o apetite ou não sentir gosto na comida.",
    fonteReferencia:
      "Guigoz Y, Vellas B, Garry PJ. Mini Nutritional Assessment (MNA), itens de ingestão alimentar e perda de apetite. Nutr Rev, 1996;54(1 Pt 2):S59-S65.",
    categoriaRelacionada: "alimentacao",
    ativo: true,
  },
  {
    tipo: "dificuldade_mastigacao_degluticao",
    descricaoPadrao:
      "A pessoa relata dor, dificuldade ou engasgo ao mastigar ou engolir, ou evita alimentos por esse motivo.",
    fonteReferencia:
      "Guigoz Y, Vellas B, Garry PJ. Mini Nutritional Assessment (MNA), item de problemas de mastigação/deglutição. Nutr Rev, 1996;54(1 Pt 2):S59-S65.",
    categoriaRelacionada: "alimentacao",
    ativo: true,
  },
  {
    tipo: "reducao_autonomia_relatada",
    descricaoPadrao:
      "A pessoa relata precisar de ajuda nova para atividade que antes fazia sozinha (vestir-se, banho, caminhar até um local da casa).",
    fonteReferencia:
      "Katz S et al. Index of Independence in Activities of Daily Living (ADL). JAMA, 1963;185(12):914-919.",
    categoriaRelacionada: "orientacao_espaco",
    ativo: true,
  },
  {
    tipo: "isolamento_social_relatado",
    descricaoPadrao:
      "A pessoa relata não receber visitas, evitar convívio com outros residentes ou passar o dia sozinha no quarto.",
    fonteReferencia:
      "World Health Organization, Social isolation and loneliness among older people: advocacy brief. Geneva: WHO, 2021.",
    categoriaRelacionada: "humor",
    ativo: true,
  },
];
