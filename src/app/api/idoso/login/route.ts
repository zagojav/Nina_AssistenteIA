import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { db, paths } from "@/lib/firebase/admin";
import { instituicaoPadrao } from "@/lib/instituicao";
import { criarSessaoIdoso } from "@/lib/session";
import { bloqueado, limparTentativas, registrarFalha } from "@/lib/throttle";
import type { Idoso } from "@/lib/types";

const GENERICO = "Nome, sobrenome ou PIN não conferem.";

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Login do idoso.
 *
 * - Com `dispositivoId` que bate com o vínculo salvo no doc: entra direto.
 * - Sem vínculo: exige nome + sobrenome + PIN, e no sucesso cria o vínculo.
 *
 * O PIN volta a ser exigido só quando o curador reseta o vínculo (troca de
 * tablet), o que zera `dispositivoVinculadoId`.
 */
export async function POST(req: Request) {
  try {
    const { nome, sobrenome, pin, dispositivoId } = await req.json();
    const instituicaoId = instituicaoPadrao();
    const colecao = db().collection(paths.idosos(instituicaoId));

    // Caminho rápido: dispositivo já vinculado, sem PIN.
    if (typeof dispositivoId === "string" && dispositivoId.length > 10) {
      const porDispositivo = await colecao
        .where("dispositivoVinculadoId", "==", dispositivoId)
        .where("ativo", "==", true)
        .limit(1)
        .get();

      if (!porDispositivo.empty) {
        const doc = porDispositivo.docs[0];
        const idoso = doc.data() as Idoso;
        await criarSessaoIdoso({
          instituicaoId,
          idosoId: doc.id,
          nome: idoso.nome,
          dispositivoId,
        });
        return Response.json({
          ok: true,
          idoso: {
            id: doc.id,
            nome: idoso.nome,
            sobrenome: idoso.sobrenome,
            modoPreferido: idoso.modoPreferido,
            kioskAtivo: idoso.kioskAtivo,
          },
          dispositivoId,
        });
      }
    }

    if (
      typeof nome !== "string" ||
      typeof sobrenome !== "string" ||
      typeof pin !== "string" ||
      !/^\d{4}$/.test(pin)
    ) {
      return Response.json({ erro: GENERICO }, { status: 400 });
    }

    const chave = `${instituicaoId}:${normalizar(nome)}:${normalizar(sobrenome)}`;
    if (bloqueado(chave)) {
      return Response.json(
        { erro: "Muitas tentativas. Chame um cuidador para ajudar." },
        { status: 429 },
      );
    }

    const candidatos = await colecao.where("ativo", "==", true).get();
    const doc = candidatos.docs.find((d) => {
      const i = d.data() as Idoso;
      return (
        normalizar(i.nome) === normalizar(nome) &&
        normalizar(i.sobrenome) === normalizar(sobrenome)
      );
    });

    // Compara o hash mesmo quando o nome não existe, para não vazar por tempo
    // de resposta quais nomes estão cadastrados.
    const hash =
      (doc?.data() as Idoso | undefined)?.pinHash ??
      "$2b$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalido";
    const confere = await bcrypt.compare(pin, hash);

    if (!doc || !confere) {
      registrarFalha(chave);
      return Response.json({ erro: GENERICO }, { status: 401 });
    }

    limparTentativas(chave);
    const idoso = doc.data() as Idoso;
    const novoDispositivo =
      typeof dispositivoId === "string" && dispositivoId.length > 10
        ? dispositivoId
        : randomUUID();

    await doc.ref.update({ dispositivoVinculadoId: novoDispositivo });
    await criarSessaoIdoso({
      instituicaoId,
      idosoId: doc.id,
      nome: idoso.nome,
      dispositivoId: novoDispositivo,
    });

    return Response.json({
      ok: true,
      idoso: {
        id: doc.id,
        nome: idoso.nome,
        sobrenome: idoso.sobrenome,
        modoPreferido: idoso.modoPreferido,
        kioskAtivo: idoso.kioskAtivo,
      },
      dispositivoId: novoDispositivo,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ erro: "Não consegui entrar agora." }, { status: 500 });
  }
}
