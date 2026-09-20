/**
 * Modelo de dados do Firestore.
 *
 * Caminhos:
 *   instituicoes/{instituicaoId}
 *   instituicoes/{instituicaoId}/idosos/{idosoId}
 *   instituicoes/{instituicaoId}/idosos/{idosoId}/sessoesJogo/{sessaoId}
 *   instituicoes/{instituicaoId}/curadores/{curadorId}
 *   instituicoes/{instituicaoId}/conversas/{conversaId}
 *   instituicoes/{instituicaoId}/conversas/{conversaId}/mensagens/{mensagemId}
 *   instituicoes/{instituicaoId}/indicios/{indicioId}
 *   instituicoes/{instituicaoId}/relatorios/{relatorioId}
 *   instituicoes/{instituicaoId}/logsAcesso/{logId}
 *   jogos/{jogoId}                  (catálogo global)
 *   padroesReferencia/{padraoId}    (base científica fixa, global)
 */

export type CategoriaPergunta =
  | "alimentacao"
  | "sono"
  | "memoria_recente"
  | "orientacao_tempo"
  | "orientacao_espaco"
  | "humor";

export const CATEGORIAS: CategoriaPergunta[] = [
  "alimentacao",
  "sono",
  "memoria_recente",
  "orientacao_tempo",
  "orientacao_espaco",
  "humor",
];

export const CATEGORIA_LABEL: Record<CategoriaPergunta, string> = {
  alimentacao: "Alimentação",
  sono: "Sono",
  memoria_recente: "Memória recente",
  orientacao_tempo: "Orientação no tempo",
  orientacao_espaco: "Orientação no espaço",
  humor: "Humor",
};

export type ModoEntrada = "voz" | "texto";
export type SeveridadeSinal = "baixo" | "medio" | "alto";
export type Dificuldade = "facil" | "medio" | "dificil";

export interface Instituicao {
  id: string;
  nome: string;
  endereco: string;
  plano: string;
  criadoEm: string;
}

export interface Idoso {
  id: string;
  nome: string;
  sobrenome: string;
  dataNascimento: string;
  quartoNumero: string;
  curadorResponsavelId: string;
  /** bcrypt, nunca o PIN em texto puro. Nunca sai do servidor. */
  pinHash: string;
  /** UUID gravado no 1º login; enquanto bater com o localStorage do device, pula o PIN. */
  dispositivoVinculadoId: string | null;
  condicoesConhecidas: string[];
  modoPreferido: ModoEntrada;
  kioskAtivo: boolean;
  ativo: boolean;
  consentimentoAssinado: boolean;
  /** Resumo das últimas conversas, usado só como CONTEXTO da próxima conversa. */
  resumoHistorico: string;
  /** Categorias das últimas conversas, da mais recente para a mais antiga. */
  categoriasRecentes: CategoriaPergunta[];
  criadoEm: string;
}

/** O que pode ser exposto ao client. Sem pinHash. */
export type IdosoPublico = Omit<Idoso, "pinHash">;

export interface Curador {
  id: string;
  nome: string;
  email: string;
  authUid: string;
  instituicaoId: string;
  cargo: string;
  criadoEm: string;
}

export interface Conversa {
  id: string;
  idosoId: string;
  modoEntrada: ModoEntrada;
  iniciadaEm: string;
  finalizadaEm: string | null;
  status: "em_andamento" | "concluida";
  /** Categorias já cobertas nesta conversa, na ordem. */
  categoriasCobertas: CategoriaPergunta[];
}

export interface Mensagem {
  id: string;
  autor: "ia" | "idoso";
  texto: string;
  timestamp: string;
  categoriaPergunta: CategoriaPergunta;
}

export interface SessaoJogo {
  id: string;
  jogoId: string;
  iniciadaEm: string;
  finalizadaEm: string | null;
  pontuacao: number;
  acertos: number;
  erros: number;
  tempoMedioResposta: number;
  dificuldade: Dificuldade;
}

export interface Jogo {
  id: string;
  /** Identificador estável usado na rota /jogos/[slug]. */
  slug: string;
  nome: string;
  tipo: "memoria" | "atencao" | "raciocinio" | "linguagem";
  descricao: string;
  ativo: boolean;
}

export interface PadraoReferencia {
  id: string;
  tipo: string;
  descricaoPadrao: string;
  fonteReferencia: string;
  categoriaRelacionada: CategoriaPergunta;
  ativo: boolean;
}

export interface Indicio {
  id: string;
  idosoId: string;
  conversaId: string;
  tipo: string;
  /** Fato objetivo observado, sem interpretação e sem diagnóstico. */
  descricao: string;
  categoriaRelacionada: CategoriaPergunta;
  fonteReferencia: string;
  severidadeSinal: SeveridadeSinal;
  detectadoEm: string;
  revisadoPeloCurador: boolean;
}

export interface Relatorio {
  id: string;
  idosoId: string;
  curadorId: string;
  tipo: "por_conversa" | "diario" | "semanal";
  conversaId: string | null;
  periodoInicio: string;
  periodoFim: string;
  conteudoFormatado: string;
  indiciosIncluidos: string[];
  pdfUrl: string | null;
  metodoEnvio: "email" | "whatsapp" | "download_manual" | null;
  enviadoEm: string | null;
  enviadoPara: string | null;
  status: "gerado" | "enviado" | "arquivado";
  criadoEm: string;
}

export type AcaoLog =
  | "visualizou_relatorio"
  | "baixou_pdf"
  | "editou_idoso"
  | "excluiu_dado"
  | "gerou_relatorio"
  | "enviou_relatorio"
  | "resetou_dispositivo";

export interface LogAcesso {
  id: string;
  curadorId: string;
  idosoId: string;
  acao: AcaoLog;
  detalhe?: string;
  timestamp: string;
}
