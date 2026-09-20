import bcrypt from "bcryptjs";

import { curadorAutenticado, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { registrarAcesso } from "@/lib/logs";
import type { Idoso } from "@/lib/types";

/** Lista os idosos da instituição do curador. Nunca devolve pinHash. */
export async function GET(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const snap = await db()
      .collection(paths.idosos(curador.instituicaoId))
      .orderBy("nome")
      .get();

    const idosos = snap.docs.map((d) => {
      const { pinHash: _omitido, ...resto } = d.data() as Omit<Idoso, "id">;
      return { id: d.id, ...resto, dispositivoVinculado: Boolean(resto.dispositivoVinculadoId) };
    });

    return Response.json({ idosos });
  } catch (e) {
    return respostaErro(e);
  }
}

export async function POST(req: Request) {
  try {
    const curador = await curadorAutenticado(req);
    const corpo = await req.json();

    const { nome, sobrenome, pin } = corpo;
    if (!nome?.trim() || !sobrenome?.trim() || !/^\d{4}$/.test(pin ?? "")) {
      return Response.json(
        { erro: "Nome, sobrenome e PIN de 4 dígitos são obrigatórios." },
        { status: 400 },
      );
    }

    const novo: Omit<Idoso, "id"> = {
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      dataNascimento: corpo.dataNascimento ?? "",
      quartoNumero: corpo.quartoNumero ?? "",
      curadorResponsavelId: corpo.curadorResponsavelId || curador.id,
      pinHash: await bcrypt.hash(pin, 12),
      dispositivoVinculadoId: null,
      condicoesConhecidas: Array.isArray(corpo.condicoesConhecidas)
        ? corpo.condicoesConhecidas
        : [],
      modoPreferido: corpo.modoPreferido === "voz" ? "voz" : "texto",
      kioskAtivo: corpo.kioskAtivo !== false,
      ativo: true,
      consentimentoAssinado: Boolean(corpo.consentimentoAssinado),
      resumoHistorico: "",
      categoriasRecentes: [],
      criadoEm: new Date().toISOString(),
    };

    const ref = await db().collection(paths.idosos(curador.instituicaoId)).add(novo);
    await registrarAcesso({
      instituicaoId: curador.instituicaoId,
      curadorId: curador.id,
      idosoId: ref.id,
      acao: "editou_idoso",
      detalhe: "cadastro criado",
    });

    const { pinHash: _omitido, ...semHash } = novo;
    return Response.json({ id: ref.id, ...semHash }, { status: 201 });
  } catch (e) {
    return respostaErro(e);
  }
}
