import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";

export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const inst = await db().doc(paths.instituicao(curador.instituicaoId)).get();
    return Response.json({
      curador: { id: curador.id, nome: curador.nome, email: curador.email, cargo: curador.cargo },
      instituicao: { id: inst.id, nome: inst.data()?.nome ?? "" },
    });
  } catch (e) {
    return respostaErro(e);
  }
}
