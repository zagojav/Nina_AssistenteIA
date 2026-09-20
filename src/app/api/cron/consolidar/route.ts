import { cronAutorizado } from "@/lib/cron";
import { consolidar, finalizarConversa } from "@/lib/conversa";
import { db, paths } from "@/lib/firebase/admin";
import { instituicaoPadrao } from "@/lib/instituicao";
import type { Idoso } from "@/lib/types";

export const maxDuration = 800;

/**
 * Consolidado diário ou semanal de todos os residentes ativos.
 * Roda sem curador na frente, então não gera log de acesso — ninguém leu nada.
 */
export async function GET(req: Request) {
  if (!cronAutorizado(req)) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const tipo = new URL(req.url).searchParams.get("tipo") === "semanal" ? "semanal" : "diario";
  const instituicaoId = instituicaoPadrao();

  const fim = new Date();
  const inicio = new Date(fim);
  if (tipo === "diario") inicio.setHours(0, 0, 0, 0);
  else inicio.setDate(inicio.getDate() - 7);

  // Rede de segurança: se o tablet foi fechado antes da despedida, a conversa
  // ficou "em_andamento" e nunca gerou relatório. Fecha o que já esfriou antes
  // de consolidar, senão esses indícios ficariam de fora da janela.
  const corte = new Date(Date.now() - 60 * 60_000).toISOString();
  const pendentes = await db()
    .collection(paths.conversas(instituicaoId))
    .where("status", "==", "em_andamento")
    .where("iniciadaEm", "<", corte)
    .limit(50)
    .get();

  let finalizadas = 0;
  for (const doc of pendentes.docs) {
    try {
      await finalizarConversa({ instituicaoId, conversaId: doc.id });
      finalizadas++;
    } catch (e) {
      console.error("[cron/consolidar] conversa pendente falhou", doc.id, e);
    }
  }

  const ativos = await db()
    .collection(paths.idosos(instituicaoId))
    .where("ativo", "==", true)
    .get();

  const gerados: string[] = [];
  const falhas: string[] = [];

  for (const doc of ativos.docs) {
    const idoso = doc.data() as Idoso;
    try {
      // Sem conversa na janela não há o que consolidar — evita relatório vazio.
      const conversas = await db()
        .collection(paths.conversas(instituicaoId))
        .where("idosoId", "==", doc.id)
        .where("iniciadaEm", ">=", inicio.toISOString())
        .limit(1)
        .get();
      if (conversas.empty) continue;

      const relatorio = await consolidar({
        instituicaoId,
        idosoId: doc.id,
        tipo,
        periodoInicio: inicio.toISOString(),
        periodoFim: fim.toISOString(),
      });
      gerados.push(relatorio.id);
    } catch (e) {
      console.error("[cron/consolidar] falhou", { idoso: idoso.nome, id: doc.id }, e);
      falhas.push(doc.id);
    }
  }

  return Response.json({ tipo, finalizadas, gerados: gerados.length, falhas });
}
