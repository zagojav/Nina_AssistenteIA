import { db, paths } from "@/lib/firebase/admin";
import { lerSessaoIdoso } from "@/lib/session";
import type { Jogo } from "@/lib/types";

/** Catálogo global de jogos ativos. */
export async function GET() {
  if (!(await lerSessaoIdoso())) {
    return Response.json({ erro: "Sem sessão." }, { status: 401 });
  }
  const snap = await db().collection(paths.jogos()).where("ativo", "==", true).get();
  return Response.json({
    jogos: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Jogo, "id">) })),
  });
}
