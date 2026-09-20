import { carregarIdoso } from "@/lib/conversa";
import { encerrarSessaoIdoso, lerSessaoIdoso } from "@/lib/session";

export async function GET() {
  const sessao = await lerSessaoIdoso();
  if (!sessao) return Response.json({ erro: "Sem sessão." }, { status: 401 });

  const idoso = await carregarIdoso(sessao.instituicaoId, sessao.idosoId);
  if (!idoso.ativo) {
    await encerrarSessaoIdoso();
    return Response.json({ erro: "Cadastro inativo." }, { status: 403 });
  }

  return Response.json({
    id: idoso.id,
    nome: idoso.nome,
    sobrenome: idoso.sobrenome,
    modoPreferido: idoso.modoPreferido,
    kioskAtivo: idoso.kioskAtivo,
  });
}

export async function DELETE() {
  await encerrarSessaoIdoso();
  return Response.json({ ok: true });
}

/** Salva a preferência de modo (voz/texto) escolhida na própria conversa. */
export async function PATCH(req: Request) {
  const sessao = await lerSessaoIdoso();
  if (!sessao) return Response.json({ erro: "Sem sessão." }, { status: 401 });

  const { modoPreferido } = await req.json();
  if (modoPreferido !== "voz" && modoPreferido !== "texto") {
    return Response.json({ erro: "Modo inválido." }, { status: 400 });
  }

  const { db, paths } = await import("@/lib/firebase/admin");
  await db()
    .doc(paths.idoso(sessao.instituicaoId, sessao.idosoId))
    .update({ modoPreferido });

  return Response.json({ ok: true });
}
