import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { consolidar } from "@/lib/conversa";
import { registrarAcesso } from "@/lib/logs";

export const maxDuration = 300;

/** Gera o consolidado diário ou semanal de um idoso. */
export async function POST(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const { idosoId, tipo } = await req.json();

    if (tipo !== "diario" && tipo !== "semanal") {
      return Response.json({ erro: "Tipo deve ser diario ou semanal." }, { status: 400 });
    }
    await idosoDoCurador(curador, idosoId);

    const fim = new Date();
    const inicio = new Date(fim);
    if (tipo === "diario") inicio.setHours(0, 0, 0, 0);
    else inicio.setDate(inicio.getDate() - 7);

    const relatorio = await consolidar({
      instituicaoId: curador.instituicaoId,
      idosoId,
      tipo,
      periodoInicio: inicio.toISOString(),
      periodoFim: fim.toISOString(),
    });

    await registrarAcesso({
      instituicaoId: curador.instituicaoId,
      curadorId: curador.id,
      idosoId,
      acao: "gerou_relatorio",
      detalhe: `${tipo}: ${relatorio.id}`,
    });

    return Response.json({ id: relatorio.id, tipo, qtdIndicios: relatorio.indiciosIncluidos.length });
  } catch (e) {
    return respostaErro(e);
  }
}
