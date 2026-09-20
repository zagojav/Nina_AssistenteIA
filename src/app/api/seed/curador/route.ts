import { adminAuth, db, paths } from "@/lib/firebase/admin";
import { instituicaoPadrao } from "@/lib/instituicao";

/**
 * Cria (ou atualiza) um curador da instituição deste deploy.
 *
 * Separado do seed completo porque adicionar gente à equipe é uma operação
 * recorrente, enquanto o seed é de provisionamento. Protegido por SEED_SECRET:
 * cria usuário no Firebase Auth.
 *
 * curl -X POST http://localhost:3000/api/seed/curador \
 *   -H "x-seed-secret: $SEED_SECRET" -H "content-type: application/json" \
 *   -d '{"nome":"...","email":"...","senha":"...","cargo":"..."}'
 */
export async function POST(req: Request) {
  const segredo = process.env.SEED_SECRET;
  if (!segredo || req.headers.get("x-seed-secret") !== segredo) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { nome, email, senha, cargo } = await req.json();
  if (typeof email !== "string" || typeof senha !== "string" || senha.length < 6) {
    return Response.json(
      { erro: "Informe email e senha (mínimo 6 caracteres)." },
      { status: 400 },
    );
  }

  const instituicaoId = instituicaoPadrao();

  try {
    // Reaproveita a conta se o e-mail já existir, e alinha a senha com a
    // informada — assim rodar de novo conserta senha esquecida.
    const usuario = await adminAuth()
      .createUser({ email, password: senha, displayName: nome })
      .catch(async (e) => {
        if (e.code !== "auth/email-already-exists") throw e;
        const existente = await adminAuth().getUserByEmail(email);
        return adminAuth().updateUser(existente.uid, { password: senha, displayName: nome });
      });

    // Id do doc = uid do Auth: é o que as Firestore Rules e o
    // `curadorAutenticado` usam para resolver a permissão com um get direto.
    const ref = db().collection(paths.curadores(instituicaoId)).doc(usuario.uid);
    const jaExistia = (await ref.get()).exists;

    await ref.set(
      {
        nome: nome || email,
        email,
        authUid: usuario.uid,
        instituicaoId,
        cargo: cargo || "Curador",
        ...(jaExistia ? {} : { criadoEm: new Date().toISOString() }),
      },
      { merge: true },
    );

    // Residentes sem responsável definido passam a apontar para este curador.
    const semResponsavel = await db()
      .collection(paths.idosos(instituicaoId))
      .where("curadorResponsavelId", "==", "")
      .get();
    await Promise.all(
      semResponsavel.docs.map((d) => d.ref.update({ curadorResponsavelId: ref.id })),
    );

    return Response.json({
      ok: true,
      curadorId: ref.id,
      email,
      instituicaoId,
      residentesVinculados: semResponsavel.size,
      atualizado: jaExistia,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const authDesligado =
      msg.includes("CONFIGURATION_NOT_FOUND") ||
      msg.includes("There is no configuration corresponding");

    console.error("[seed/curador]", e);
    return Response.json(
      {
        erro: msg,
        ...(authDesligado
          ? {
              comoResolver:
                "Ative o Authentication no Console do Firebase " +
                "(Authentication > Começar > E-mail/senha) e rode de novo.",
            }
          : {}),
      },
      { status: 500 },
    );
  }
}
