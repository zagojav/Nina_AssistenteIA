import bcrypt from "bcryptjs";

import { curadorAutenticado, idosoDoCurador, respostaErro } from "@/lib/auth";
import { db, paths } from "@/lib/firebase/admin";
import { registrarAcesso } from "@/lib/logs";
import type { Idoso } from "@/lib/types";

type Ctx = { params: Promise<{ idosoId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const curador = await curadorAutenticado(req);
    const { idosoId } = await params;
    const { dados } = await idosoDoCurador(curador, idosoId);
    const { pinHash: _omitido, ...resto } = dados as Omit<Idoso, "id">;
    return Response.json({
      id: idosoId,
      ...resto,
      dispositivoVinculado: Boolean(resto.dispositivoVinculadoId),
    });
  } catch (e) {
    return respostaErro(e);
  }
}

/**
 * Edição do cadastro. Trocar o PIN ou resetar o vínculo de dispositivo são as
 * duas operações que devolvem o idoso à tela de PIN (caso de troca de tablet).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const curador = await curadorAutenticado(req);
    const { idosoId } = await params;
    const { ref } = await idosoDoCurador(curador, idosoId);
    const corpo = await req.json();

    const mudancas: Record<string, unknown> = {};
    const alteradas: string[] = [];

    for (const campo of [
      "nome",
      "sobrenome",
      "dataNascimento",
      "quartoNumero",
      "curadorResponsavelId",
    ] as const) {
      if (typeof corpo[campo] === "string") {
        mudancas[campo] = corpo[campo].trim();
        alteradas.push(campo);
      }
    }
    if (Array.isArray(corpo.condicoesConhecidas)) {
      mudancas.condicoesConhecidas = corpo.condicoesConhecidas;
      alteradas.push("condicoesConhecidas");
    }
    for (const flag of ["kioskAtivo", "ativo", "consentimentoAssinado"] as const) {
      if (typeof corpo[flag] === "boolean") {
        mudancas[flag] = corpo[flag];
        alteradas.push(flag);
      }
    }
    if (corpo.modoPreferido === "voz" || corpo.modoPreferido === "texto") {
      mudancas.modoPreferido = corpo.modoPreferido;
      alteradas.push("modoPreferido");
    }
    if (typeof corpo.pin === "string" && corpo.pin.length) {
      if (!/^\d{4}$/.test(corpo.pin)) {
        return Response.json({ erro: "O PIN precisa ter 4 dígitos." }, { status: 400 });
      }
      mudancas.pinHash = await bcrypt.hash(corpo.pin, 12);
      // PIN novo invalida o vínculo: o próximo acesso passa pela tela de PIN.
      mudancas.dispositivoVinculadoId = null;
      alteradas.push("pin");
    }
    if (corpo.resetarDispositivo === true) {
      mudancas.dispositivoVinculadoId = null;
      alteradas.push("dispositivoVinculadoId");
    }

    if (!alteradas.length) {
      return Response.json({ erro: "Nada para alterar." }, { status: 400 });
    }

    await ref.update(mudancas);
    await registrarAcesso({
      instituicaoId: curador.instituicaoId,
      curadorId: curador.id,
      idosoId,
      acao: alteradas.includes("dispositivoVinculadoId") && alteradas.length === 1
        ? "resetou_dispositivo"
        : "editou_idoso",
      detalhe: alteradas.join(", "),
    });

    return Response.json({ ok: true, alteradas });
  } catch (e) {
    return respostaErro(e);
  }
}

/**
 * Exclusão a pedido da família (LGPD, art. 18): apaga conversas, mensagens,
 * indícios, relatórios, PDFs e o cadastro. O log de acesso da exclusão fica —
 * ele é o registro de que o pedido foi atendido, e não contém dado de saúde.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const curador = await curadorAutenticado(req);
    const { idosoId } = await params;
    const { ref } = await idosoDoCurador(curador, idosoId);
    const firestore = db();
    const inst = curador.instituicaoId;

    const conversas = await firestore
      .collection(paths.conversas(inst))
      .where("idosoId", "==", idosoId)
      .get();
    for (const conversa of conversas.docs) {
      await firestore.recursiveDelete(conversa.ref);
    }

    for (const colecao of [paths.indicios(inst), paths.relatorios(inst)]) {
      const docs = await firestore
        .collection(colecao)
        .where("idosoId", "==", idosoId)
        .get();
      await Promise.all(docs.docs.map((d) => d.ref.delete()));
    }

    const { bucket } = await import("@/lib/firebase/admin");
    await bucket()
      .deleteFiles({ prefix: `relatorios/${inst}/${idosoId}/` })
      .catch((e) => console.error("[exclusao] falha ao apagar PDFs", e));

    await firestore.recursiveDelete(ref);

    await registrarAcesso({
      instituicaoId: inst,
      curadorId: curador.id,
      idosoId,
      acao: "excluiu_dado",
      detalhe: "exclusão integral a pedido do responsável",
    });

    return Response.json({ ok: true });
  } catch (e) {
    return respostaErro(e);
  }
}
