import { db, paths } from "@/lib/firebase/admin";
import { lerSessaoIdoso } from "@/lib/session";
import { carregarIdoso, escolherCategoria, falaDaNina } from "@/lib/conversa";
import type { Conversa, ModoEntrada } from "@/lib/types";

export const maxDuration = 60;

/** Abre a conversa e devolve a primeira fala da Nina. */
export async function POST(req: Request) {
  const sessao = await lerSessaoIdoso();
  if (!sessao) return Response.json({ erro: "Sem sessão." }, { status: 401 });

  try {
    const { modoEntrada } = (await req.json().catch(() => ({}))) as {
      modoEntrada?: ModoEntrada;
    };
    const { instituicaoId, idosoId } = sessao;
    const idoso = await carregarIdoso(instituicaoId, idosoId);
    const modo: ModoEntrada = modoEntrada ?? idoso.modoPreferido ?? "texto";

    const categoria = await escolherCategoria(instituicaoId, idosoId, []);
    const agora = new Date().toISOString();

    const conversa: Omit<Conversa, "id"> = {
      idosoId,
      modoEntrada: modo,
      iniciadaEm: agora,
      finalizadaEm: null,
      status: "em_andamento",
      categoriasCobertas: [categoria],
    };

    const ref = await db().collection(paths.conversas(instituicaoId)).add(conversa);

    const texto = await falaDaNina({
      idoso,
      mensagens: [],
      categoriaAlvo: categoria,
      encerrando: false,
    });

    await db()
      .collection(paths.mensagens(instituicaoId, ref.id))
      .add({
        autor: "ia",
        texto,
        timestamp: new Date().toISOString(),
        categoriaPergunta: categoria,
      });

    if (modo !== idoso.modoPreferido) {
      await db().doc(paths.idoso(instituicaoId, idosoId)).update({ modoPreferido: modo });
    }

    return Response.json({ conversaId: ref.id, texto, categoria });
  } catch (e) {
    console.error(e);
    return Response.json(
      { erro: "A Nina não conseguiu começar a conversa agora." },
      { status: 500 },
    );
  }
}
