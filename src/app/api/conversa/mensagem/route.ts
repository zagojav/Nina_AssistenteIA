import { db, paths } from "@/lib/firebase/admin";
import { lerSessaoIdoso } from "@/lib/session";
import {
  MAX_TROCAS,
  carregarIdoso,
  carregarMensagens,
  escolherCategoria,
  falaDaNina,
} from "@/lib/conversa";
import type { Conversa } from "@/lib/types";

export const maxDuration = 60;

/**
 * Uma troca da conversa: grava a fala do idoso, escolhe a categoria da vez e
 * devolve a resposta da Nina. Ao chegar em MAX_TROCAS a resposta já vem como
 * despedida e a conversa é marcada para encerrar.
 */
export async function POST(req: Request) {
  const sessao = await lerSessaoIdoso();
  if (!sessao) return Response.json({ erro: "Sem sessão." }, { status: 401 });

  try {
    const { conversaId, texto } = await req.json();
    if (typeof conversaId !== "string" || typeof texto !== "string" || !texto.trim()) {
      return Response.json({ erro: "Mensagem vazia." }, { status: 400 });
    }

    const { instituicaoId, idosoId } = sessao;
    const conversaRef = db().doc(paths.conversa(instituicaoId, conversaId));
    const snap = await conversaRef.get();
    if (!snap.exists) {
      return Response.json({ erro: "Conversa não encontrada." }, { status: 404 });
    }

    const conversa = snap.data() as Conversa;
    if (conversa.idosoId !== idosoId) {
      return Response.json({ erro: "Conversa de outra pessoa." }, { status: 403 });
    }
    if (conversa.status === "concluida") {
      return Response.json({ erro: "Conversa já encerrada.", encerrada: true }, { status: 409 });
    }

    const mensagens = await carregarMensagens(instituicaoId, conversaId);
    const cobertas = conversa.categoriasCobertas ?? [];
    const categoriaAtual = cobertas.at(-1) ?? "humor";

    const mensagensRef = db().collection(paths.mensagens(instituicaoId, conversaId));
    await mensagensRef.add({
      autor: "idoso",
      texto: texto.trim().slice(0, 2000),
      timestamp: new Date().toISOString(),
      categoriaPergunta: categoriaAtual,
    });

    const historico = [
      ...mensagens,
      {
        id: "pendente",
        autor: "idoso" as const,
        texto: texto.trim(),
        timestamp: new Date().toISOString(),
        categoriaPergunta: categoriaAtual,
      },
    ];

    const trocas = historico.filter((m) => m.autor === "idoso").length;
    const encerrando = trocas >= MAX_TROCAS;

    // Resposta curta ou vaga: puxa a próxima categoria, como manda o roteiro.
    /*
     * Rodízio de categoria, conforme o roteiro da Nina:
     * resposta curta ou vaga -> passa para a próxima categoria;
     * resposta rica -> UMA pergunta de acompanhamento e depois muda.
     *
     * Sem o segundo critério, um residente falante travava a conversa inteira
     * numa categoria só, e a análise saía cobrindo um domínio apenas.
     */
    const vaga = texto.trim().split(/\s+/).length <= 4;
    const perguntasNaCategoria = historico.filter(
      (m) => m.autor === "ia" && m.categoriaPergunta === categoriaAtual,
    ).length;
    const jaAprofundou = perguntasNaCategoria >= 2;

    const categoriaAlvo =
      encerrando || !(vaga || jaAprofundou)
        ? categoriaAtual
        : await escolherCategoria(instituicaoId, idosoId, cobertas);

    const idoso = await carregarIdoso(instituicaoId, idosoId);
    const resposta = await falaDaNina({
      idoso,
      mensagens: historico,
      categoriaAlvo,
      encerrando,
    });

    await mensagensRef.add({
      autor: "ia",
      texto: resposta,
      timestamp: new Date().toISOString(),
      categoriaPergunta: categoriaAlvo,
    });

    if (categoriaAlvo !== categoriaAtual) {
      await conversaRef.update({ categoriasCobertas: [...cobertas, categoriaAlvo] });
    }

    return Response.json({ texto: resposta, encerrada: encerrando, categoria: categoriaAlvo });
  } catch (e) {
    console.error(e);
    return Response.json(
      { erro: "A Nina não conseguiu responder agora." },
      { status: 500 },
    );
  }
}
