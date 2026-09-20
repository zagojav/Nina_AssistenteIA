import "server-only";

import { adminAuth, db, paths } from "@/lib/firebase/admin";
import { instituicaoPadrao } from "@/lib/instituicao";
import type { Curador } from "@/lib/types";

export class ErroAutorizacao extends Error {
  constructor(
    message: string,
    readonly status: number = 401,
  ) {
    super(message);
  }
}

/**
 * Valida o ID token do Firebase Auth enviado pelo curador e devolve o doc dele.
 * Toda rota da área admin passa por aqui, é o que amarra o curador à
 * instituicaoId dele, base de toda a checagem de escopo (LGPD).
 */
export async function curadorAutenticado(req: Request): Promise<Curador> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ErroAutorizacao("Token ausente.");

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    throw new ErroAutorizacao("Token inválido ou expirado.");
  }

  // O doc do curador é gravado com o próprio uid como id, então isto é um get
  // direto, sem consulta de grupo de coleção, que exigiria índice e
  // quebraria o login num projeto recém-criado. Cada deploy atende uma
  // instituição, que vem de INSTITUICAO_ID.
  const doc = await db().doc(`${paths.curadores(instituicaoPadrao())}/${uid}`).get();

  if (!doc.exists) {
    throw new ErroAutorizacao(
      "Usuário autenticado mas sem cadastro de curador nesta instituição.",
      403,
    );
  }
  return { id: doc.id, ...(doc.data() as Omit<Curador, "id">) };
}

/**
 * Garante que o idoso pertence à instituição do curador.
 * Sem isso, um curador poderia ler dado de saúde de outra casa de repouso.
 */
export async function idosoDoCurador(curador: Curador, idosoId: string) {
  const ref = db().doc(paths.idoso(curador.instituicaoId, idosoId));
  const snap = await ref.get();
  if (!snap.exists) {
    throw new ErroAutorizacao("Idoso não encontrado nesta instituição.", 404);
  }
  return { ref, dados: snap.data()! };
}

export function respostaErro(e: unknown) {
  if (e instanceof ErroAutorizacao) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  console.error(e);
  const msg = e instanceof Error ? e.message : "Erro inesperado.";

  /*
   * Índice composto faltando vira um 500 sem pista nenhuma na tela. O
   * Firestore já devolve o link de criação dentro da mensagem, repassamos
   * ele para o curador em vez de esconder num log de servidor.
   */
  if (msg.includes("FAILED_PRECONDITION") && msg.includes("requires an index")) {
    const link = msg.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0];
    return Response.json(
      {
        erro: "Esta consulta precisa de um índice do Firestore que ainda não existe.",
        comoResolver: link
          ? `Abra ${link} e confirme a criação (leva alguns minutos), ou rode 'firebase deploy --only firestore:indexes'.`
          : "Rode 'firebase deploy --only firestore:indexes'.",
      },
      { status: 503 },
    );
  }

  return Response.json({ erro: msg }, { status: 500 });
}
