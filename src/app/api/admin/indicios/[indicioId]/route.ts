import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";

type Ctx = { params: Promise<{ indicioId: string }> };

/** Marca o indício como revisado pelo curador. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const curador = await curadorAutenticado(req);
    const { indicioId } = await params;
    const { revisadoPeloCurador } = await req.json();

    const ref = db().doc(`${paths.indicios(curador.instituicaoId)}/${indicioId}`);
    if (!(await ref.get()).exists) {
      return Response.json({ erro: "Indício não encontrado." }, { status: 404 });
    }

    await ref.update({ revisadoPeloCurador: revisadoPeloCurador !== false });
    return Response.json({ ok: true });
  } catch (e) {
    return respostaErro(e);
  }
}
