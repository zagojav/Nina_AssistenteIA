import bcrypt from "bcryptjs";

import { adminAuth, db, paths } from "@/lib/firebase/admin";
import { PADROES_SEMENTE } from "@/lib/padroesReferencia";
import { JOGOS_SEMENTE } from "@/lib/jogos";

/**
 * Provisionamento inicial de uma instituição.
 *
 * Protegido por SEED_SECRET porque cria usuário do Firebase Auth. Rode uma vez
 * por instituição e depois remova a variável do ambiente, ou apague esta rota.
 *
 * curl -X POST http://localhost:3000/api/seed \
 *   -H "x-seed-secret: $SEED_SECRET" -H "content-type: application/json" \
 *   -d '{"instituicao":{"nome":"Casa Bem Viver"},
 *        "curador":{"nome":"Ana","email":"ana@casa.com","senha":"...","cargo":"Enfermeira"},
 *        "idosoDemo":{"nome":"Joao","sobrenome":"Souza","pin":"1234"}}'
 */
export async function POST(req: Request) {
  const segredo = process.env.SEED_SECRET;
  if (!segredo || req.headers.get("x-seed-secret") !== segredo) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const corpo = await req.json();
    const firestore = db();
    const agora = new Date().toISOString();
    const resultado: Record<string, unknown> = {};

    // 1. Base científica global (idempotente por `tipo`)
    const padroesRef = firestore.collection(paths.padroesReferencia());
    let padroesCriados = 0;
    for (const padrao of PADROES_SEMENTE) {
      const existe = await padroesRef.where("tipo", "==", padrao.tipo).limit(1).get();
      if (existe.empty) {
        await padroesRef.add(padrao);
        padroesCriados++;
      }
    }
    resultado.padroesCriados = padroesCriados;

    // 2. Catálogo global de jogos
    const jogosRef = firestore.collection(paths.jogos());
    let jogosCriados = 0;
    for (const jogo of JOGOS_SEMENTE) {
      const existe = await jogosRef.where("nome", "==", jogo.nome).limit(1).get();
      if (existe.empty) {
        await jogosRef.add(jogo);
        jogosCriados++;
      }
    }
    resultado.jogosCriados = jogosCriados;

    // 3. Instituição, reaproveita a de mesmo nome se já existir, para que
    // rodar o seed de novo (depois de corrigir Auth, por exemplo) não crie
    // uma segunda casa de repouso com os mesmos dados.
    if (!corpo.instituicao?.nome) {
      return Response.json({ ...resultado, aviso: "Sem instituição no corpo; só o catálogo global foi semeado." });
    }
    const existente = await firestore
      .collection("instituicoes")
      .where("nome", "==", corpo.instituicao.nome)
      .limit(1)
      .get();

    const instRef = existente.empty
      ? await firestore.collection("instituicoes").add({
          nome: corpo.instituicao.nome,
          endereco: corpo.instituicao.endereco ?? "",
          plano: corpo.instituicao.plano ?? "piloto",
          criadoEm: agora,
        })
      : existente.docs[0].ref;

    resultado.instituicaoId = instRef.id;
    resultado.instituicaoReaproveitada = !existente.empty;

    /*
     * 4. Residente de demonstração.
     *
     * Vem ANTES do curador de propósito: o residente entra por PIN e não
     * depende do Firebase Auth. Criar o curador primeiro fazia uma falha de
     * Auth derrubar o seed inteiro e deixar o tablet sem ninguém para logar.
     * Idempotente por nome + sobrenome.
     */
    let idosoRef: FirebaseFirestore.DocumentReference | null = null;

    if (corpo.idosoDemo?.nome && corpo.idosoDemo?.pin) {
      const jaExiste = await firestore
        .collection(paths.idosos(instRef.id))
        .where("nome", "==", corpo.idosoDemo.nome)
        .where("sobrenome", "==", corpo.idosoDemo.sobrenome ?? "")
        .limit(1)
        .get();

      if (jaExiste.empty) {
        idosoRef = await firestore.collection(paths.idosos(instRef.id)).add({
          nome: corpo.idosoDemo.nome,
          sobrenome: corpo.idosoDemo.sobrenome ?? "",
          dataNascimento: corpo.idosoDemo.dataNascimento ?? "",
          quartoNumero: corpo.idosoDemo.quartoNumero ?? "",
          // Preenchido logo abaixo, quando houver curador.
          curadorResponsavelId: "",
          pinHash: await bcrypt.hash(corpo.idosoDemo.pin, 12),
          dispositivoVinculadoId: null,
          condicoesConhecidas: corpo.idosoDemo.condicoesConhecidas ?? [],
          modoPreferido: "texto",
          kioskAtivo: true,
          ativo: true,
          consentimentoAssinado: false,
          resumoHistorico: "",
          categoriasRecentes: [],
          criadoEm: agora,
        });
      } else {
        idosoRef = jaExiste.docs[0].ref;
        resultado.idosoReaproveitado = true;
      }
      resultado.idosoId = idosoRef.id;
    }

    // 5. Curador (Firebase Auth + doc)
    if (corpo.curador?.email && corpo.curador?.senha) {
      try {
        const usuario = await adminAuth()
          .createUser({
            email: corpo.curador.email,
            password: corpo.curador.senha,
            displayName: corpo.curador.nome,
          })
          .catch(async (e) => {
            if (e.code === "auth/email-already-exists") {
              return adminAuth().getUserByEmail(corpo.curador.email);
            }
            throw e;
          });

        // O doc do curador usa o próprio uid do Auth como id: é isso que deixa
        // as Firestore Rules resolverem a permissão com um get() direto.
        const curadorRef = firestore
          .collection(paths.curadores(instRef.id))
          .doc(usuario.uid);
        await curadorRef.set({
          nome: corpo.curador.nome ?? corpo.curador.email,
          email: corpo.curador.email,
          authUid: usuario.uid,
          instituicaoId: instRef.id,
          cargo: corpo.curador.cargo ?? "Curador",
          criadoEm: agora,
        });
        resultado.curadorId = curadorRef.id;

        // Amarra o residente ao curador (inclusive num residente já existente,
        // criado numa rodada anterior em que o Auth ainda estava desligado).
        if (idosoRef) {
          const atual = await idosoRef.get();
          if (!atual.data()?.curadorResponsavelId) {
            await idosoRef.update({ curadorResponsavelId: curadorRef.id });
            resultado.idosoVinculadoAoCurador = true;
          }
        }
      } catch (e) {
        // Auth não inicializado no projeto é o caso comum aqui. O resto do
        // seed já rodou, então não derruba tudo: reporta e segue.
        const msg = e instanceof Error ? e.message : String(e);
        const authDesligado =
          msg.includes("CONFIGURATION_NOT_FOUND") ||
          msg.includes("There is no configuration corresponding");

        console.error("[seed] curador não criado", e);
        resultado.curadorId = null;
        resultado.avisoCurador = authDesligado
          ? "Curador NÃO criado: o Authentication do projeto ainda não foi " +
            "inicializado. Ative em Console do Firebase > Authentication > " +
            "Começar > E-mail/senha e rode este seed de novo, o residente já " +
            "está criado e será vinculado ao curador automaticamente."
          : `Curador não criado: ${msg}`;
      }
    }

    return Response.json({
      ...resultado,
      proximoPasso: `Defina INSTITUICAO_ID=${instRef.id} no .env.local e reinicie o servidor.`,
    });
  } catch (e) {
    console.error(e);
    const mensagem = e instanceof Error ? e.message : "Falha no seed.";

    // Erro clássico de projeto novo: o serviço de Authentication ainda não foi
    // inicializado no Console, então createUser falha antes de qualquer coisa.
    const authDesligado =
      mensagem.includes("CONFIGURATION_NOT_FOUND") ||
      mensagem.includes("There is no configuration corresponding");

    return Response.json(
      {
        erro: mensagem,
        ...(authDesligado
          ? {
              comoResolver:
                "Ative o Authentication no Console do Firebase (Criar > Authentication > " +
                "Começar > provedor E-mail/senha) e rode este seed de novo. Ele é " +
                "repetível: não duplica instituição, curador nem residente.",
            }
          : {}),
      },
      { status: 500 },
    );
  }
}
