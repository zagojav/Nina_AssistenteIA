import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 56;
const LARGURA_UTIL = A4[0] - MARGEM * 2;

const CORPO = 10.5;
const TITULO = 17;
const SECAO = 12.5;

/**
 * As fontes padrão do PDF usam WinAnsi (CP1252), que cobre o português mas não
 * cobre sinais tipográficos como travessão longo ou aspas curvas exóticas.
 * Trocamos por equivalentes ASCII antes de desenhar — sem isso o pdf-lib lança
 * erro no meio da geração e o relatório inteiro se perde.
 */
function sanitizar(texto: string): string {
  return texto
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/[\u00A0\u2007\u202F\u2009\u200A]/g, " ")
    .replace(/\u200B/g, "")
    .replace(/[^\x00-\xFF]/g, "?");
}

/** Tira ênfase markdown: o renderizador é de texto corrido, não formata. */
function semEnfase(texto: string): string {
  // O marcador de lista já foi consumido antes de chegar aqui, então todo
  // asterisco restante é ênfase — e ênfase vira lixo visível no PDF.
  return texto.replace(/[*`]/g, "").replace(/\s{2,}/g, " ").trim();
}

function quebrar(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  largura: number,
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
        atual = tentativa;
      } else {
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    linhas.push(atual);
  }
  return linhas;
}

export interface DadosPdf {
  tituloDocumento: string;
  instituicao: string;
  idoso: string;
  periodo: string;
  geradoEm: string;
  /** Markdown simples: `## seção`, `- item`, parágrafos. */
  conteudo: string;
}

export async function gerarPdf(dados: DadosPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(dados.tituloDocumento);
  pdf.setProducer("Nina — Assistente de Curadores");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italico = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const paginas: ReturnType<typeof pdf.addPage>[] = [];
  let pagina = pdf.addPage(A4);
  paginas.push(pagina);
  let y = A4[1] - MARGEM;

  const novaPagina = () => {
    pagina = pdf.addPage(A4);
    paginas.push(pagina);
    y = A4[1] - MARGEM;
  };

  const escrever = (
    texto: string,
    fonte: PDFFont,
    tamanho: number,
    espacoAntes = 0,
    cor = rgb(0.1, 0.1, 0.12),
  ) => {
    y -= espacoAntes;
    for (const linha of quebrar(sanitizar(texto), fonte, tamanho, LARGURA_UTIL)) {
      if (y < MARGEM + 40) novaPagina();
      pagina.drawText(linha, { x: MARGEM, y, size: tamanho, font: fonte, color: cor });
      y -= tamanho * 1.45;
    }
  };

  // Cabeçalho
  escrever(dados.tituloDocumento, negrito, TITULO);
  y -= 2;
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: A4[0] - MARGEM, y },
    thickness: 1,
    color: rgb(0.78, 0.8, 0.84),
  });
  y -= 16;

  const cinza = rgb(0.35, 0.36, 0.4);
  escrever(`Instituição: ${dados.instituicao}`, regular, CORPO, 0, cinza);
  escrever(`Residente: ${dados.idoso}`, regular, CORPO, 0, cinza);
  escrever(`Período: ${dados.periodo}`, regular, CORPO, 0, cinza);
  escrever(`Emitido em: ${dados.geradoEm}`, regular, CORPO, 0, cinza);
  y -= 10;

  // Corpo
  for (const bloco of dados.conteudo.split("\n")) {
    const linha = bloco.trimEnd();
    if (!linha.trim()) {
      y -= 6;
    } else if (linha.startsWith("## ")) {
      escrever(linha.slice(3), negrito, SECAO, 12);
      y -= 3;
    } else if (linha.startsWith("# ")) {
      escrever(linha.slice(2), negrito, SECAO + 1.5, 12);
      y -= 3;
    } else if (/^[-*]\s/.test(linha)) {
      escrever(`-  ${semEnfase(linha.slice(2))}`, regular, CORPO);
    } else if (/^\d+[.)]\s/.test(linha)) {
      escrever(semEnfase(linha), regular, CORPO);
    } else {
      escrever(semEnfase(linha), regular, CORPO, 2);
    }
  }

  // Rodapé com paginação e aviso de confidencialidade
  const aviso =
    "Documento confidencial - dado pessoal sensivel de saude (LGPD, Lei 13.709/2018). " +
    "Uso restrito a equipe de curadoria e responsaveis autorizados.";
  paginas.forEach((p, i) => {
    p.drawText(sanitizar(aviso), {
      x: MARGEM,
      y: 34,
      size: 7,
      font: italico,
      color: rgb(0.45, 0.46, 0.5),
      maxWidth: LARGURA_UTIL,
    });
    p.drawText(`${i + 1} / ${paginas.length}`, {
      x: A4[0] - MARGEM - 30,
      y: 20,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.46, 0.5),
    });
  });

  return pdf.save();
}
