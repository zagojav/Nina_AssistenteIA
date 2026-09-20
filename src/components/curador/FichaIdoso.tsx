"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Cabecalho from "@/components/curador/Cabecalho";
import LoginCurador from "@/components/curador/LoginCurador";
import { apiCurador, dataHora, useCurador } from "@/components/curador/api";
import { CATEGORIA_LABEL } from "@/lib/types";
import type { IdosoPublico, Indicio, LogAcesso, SessaoJogo } from "@/lib/types";

interface RelatorioResumo {
  id: string;
  tipo: string;
  qtdIndicios: number;
  criadoEm: string;
  status: string;
  enviadoEm: string | null;
}

type Aba = "cadastro" | "relatorios" | "indicios" | "jogos" | "auditoria";

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "cadastro", rotulo: "Cadastro" },
  { chave: "relatorios", rotulo: "Relatórios" },
  { chave: "indicios", rotulo: "Indícios" },
  { chave: "jogos", rotulo: "Jogos" },
  { chave: "auditoria", rotulo: "Auditoria" },
];

export default function FichaIdoso({ idosoId }: { idosoId: string }) {
  const { usuario, carregando } = useCurador();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("cadastro");
  const [idoso, setIdoso] = useState<(IdosoPublico & { dispositivoVinculado: boolean }) | null>(null);
  const [relatorios, setRelatorios] = useState<RelatorioResumo[]>([]);
  const [indicios, setIndicios] = useState<Indicio[]>([]);
  const [sessoes, setSessoes] = useState<SessaoJogo[]>([]);
  const [logs, setLogs] = useState<LogAcesso[]>([]);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [ficha, rel, ind, ses, lg] = await Promise.all([
        apiCurador<IdosoPublico & { dispositivoVinculado: boolean }>(`/api/admin/idosos/${idosoId}`),
        apiCurador<{ relatorios: RelatorioResumo[] }>(`/api/admin/relatorios?idosoId=${idosoId}`),
        apiCurador<{ indicios: Indicio[] }>(`/api/admin/indicios?idosoId=${idosoId}`),
        apiCurador<{ sessoes: SessaoJogo[] }>(`/api/admin/sessoes?idosoId=${idosoId}`),
        apiCurador<{ logs: LogAcesso[] }>(`/api/admin/logs?idosoId=${idosoId}`),
      ]);
      setIdoso(ficha);
      setRelatorios(rel.relatorios);
      setIndicios(ind.indicios);
      setSessoes(ses.sessoes);
      setLogs(lg.logs);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    }
  }, [idosoId]);

  useEffect(() => {
    if (usuario) void carregar();
  }, [usuario, carregar]);

  async function acao(fn: () => Promise<unknown>, mensagem: string) {
    setErro("");
    setAviso("");
    try {
      await fn();
      setAviso(mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na operação.");
    }
  }

  if (carregando) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-xl text-tinta-suave">Carregando…</p>
      </main>
    );
  }
  if (!usuario) return <LoginCurador />;
  if (!idoso) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-xl text-tinta-suave">{erro || "Carregando ficha…"}</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho
        titulo={`${idoso.nome} ${idoso.sobrenome}`}
        subtitulo={`Quarto ${idoso.quartoNumero || "—"}`}
        voltarPara="/curador"
      />

      <nav className="flex gap-1 overflow-x-auto border-b border-borda bg-superficie px-5" aria-label="Seções da ficha">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            aria-current={aba === a.chave ? "page" : undefined}
            className={`min-h-12 whitespace-nowrap px-4 font-semibold transition ${
              aba === a.chave
                ? "border-b-4 border-marca text-marca"
                : "text-tinta-suave"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        {aviso && (
          <p role="status" className="mb-6 rounded-2xl bg-marca-clara p-4 font-semibold text-marca">
            {aviso}
          </p>
        )}
        {erro && (
          <p role="alert" className="mb-6 rounded-2xl bg-alerta/10 p-4 font-semibold text-alerta">
            {erro}
          </p>
        )}

        {aba === "cadastro" && (
          <Cadastro
            idoso={idoso}
            aoSalvar={(corpo, mensagem) =>
              acao(
                () =>
                  apiCurador(`/api/admin/idosos/${idosoId}`, {
                    method: "PATCH",
                    body: JSON.stringify(corpo),
                  }),
                mensagem,
              )
            }
            aoExcluir={async () => {
              if (
                !confirm(
                  "Excluir TODOS os dados deste residente (conversas, indícios, relatórios e PDFs)? Esta ação não tem volta.",
                )
              )
                return;
              await acao(
                () => apiCurador(`/api/admin/idosos/${idosoId}`, { method: "DELETE" }),
                "Dados excluídos.",
              );
              router.replace("/curador");
            }}
          />
        )}

        {aba === "relatorios" && (
          <section>
            <div className="flex flex-wrap gap-3">
              {(["diario", "semanal"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() =>
                    acao(
                      () =>
                        apiCurador("/api/admin/consolidar", {
                          method: "POST",
                          body: JSON.stringify({ idosoId, tipo }),
                        }),
                      `Consolidado ${tipo} gerado.`,
                    )
                  }
                  className="min-h-12 rounded-2xl bg-marca px-5 font-semibold text-white"
                >
                  Gerar consolidado {tipo}
                </button>
              ))}
            </div>

            <ul className="mt-6 flex flex-col gap-2">
              {relatorios.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/curador/relatorios/${r.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-borda bg-superficie px-5 py-4 transition hover:border-marca"
                  >
                    <span className="font-semibold capitalize">{r.tipo.replace("_", " ")}</span>
                    <span className="text-base text-tinta-suave">
                      {r.qtdIndicios} indício(s) · {dataHora(r.criadoEm)}
                      {r.enviadoEm ? ` · enviado ${dataHora(r.enviadoEm)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
              {!relatorios.length && (
                <li className="text-lg text-tinta-suave">Nenhum relatório ainda.</li>
              )}
            </ul>
          </section>
        )}

        {aba === "indicios" && (
          <ul className="flex flex-col gap-3">
            {indicios.map((i) => (
              <li
                key={i.id}
                className="rounded-2xl border border-borda bg-superficie p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{i.tipo.replace(/_/g, " ")}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      i.severidadeSinal === "alto"
                        ? "bg-alerta/15 text-alerta"
                        : i.severidadeSinal === "medio"
                          ? "bg-destaque/15 text-destaque"
                          : "bg-marca-clara text-marca"
                    }`}
                  >
                    sinal {i.severidadeSinal}
                  </span>
                </div>
                <p className="mt-2 text-lg">{i.descricao}</p>
                <p className="mt-2 text-sm text-tinta-suave">
                  {CATEGORIA_LABEL[i.categoriaRelacionada]} · {dataHora(i.detectadoEm)}
                </p>
                <p className="mt-1 text-sm text-tinta-suave">Fonte: {i.fonteReferencia}</p>
                <label className="mt-3 flex items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={i.revisadoPeloCurador}
                    onChange={(e) =>
                      acao(
                        () =>
                          apiCurador(`/api/admin/indicios/${i.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ revisadoPeloCurador: e.target.checked }),
                          }),
                        "Indício atualizado.",
                      )
                    }
                    className="h-6 w-6 accent-[var(--color-marca)]"
                  />
                  Revisado por mim
                </label>
              </li>
            ))}
            {!indicios.length && (
              <li className="text-lg text-tinta-suave">
                Nenhum indício registrado. Isso é o esperado quando as conversas
                não apresentam correspondência com a base de referência.
              </li>
            )}
          </ul>
        )}

        {aba === "jogos" && (
          <ul className="flex flex-col gap-2">
            {sessoes.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-borda bg-superficie px-5 py-4"
              >
                <span className="font-semibold">{dataHora(s.iniciadaEm)}</span>
                <span className="text-base text-tinta-suave">
                  {s.acertos} acertos · {s.erros} erros · {s.pontuacao} pontos ·{" "}
                  {s.tempoMedioResposta}s por jogada · {s.dificuldade}
                </span>
              </li>
            ))}
            {!sessoes.length && (
              <li className="text-lg text-tinta-suave">Nenhuma partida registrada.</li>
            )}
          </ul>
        )}

        {aba === "auditoria" && (
          <>
            <p className="mb-4 text-tinta-suave">
              Registro de acesso a dado sensível, exigido pela LGPD.
            </p>
            <ul className="flex flex-col gap-2">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap justify-between gap-2 rounded-2xl border border-borda bg-superficie px-5 py-3"
                >
                  <span className="font-semibold">{l.acao.replace(/_/g, " ")}</span>
                  <span className="text-base text-tinta-suave">
                    {dataHora(l.timestamp)}
                    {l.detalhe ? ` · ${l.detalhe}` : ""}
                  </span>
                </li>
              ))}
              {!logs.length && <li className="text-lg text-tinta-suave">Sem registros.</li>}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function Cadastro({
  idoso,
  aoSalvar,
  aoExcluir,
}: {
  idoso: IdosoPublico & { dispositivoVinculado: boolean };
  aoSalvar: (corpo: Record<string, unknown>, mensagem: string) => Promise<void>;
  aoExcluir: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    nome: idoso.nome,
    sobrenome: idoso.sobrenome,
    quartoNumero: idoso.quartoNumero,
    dataNascimento: idoso.dataNascimento,
    condicoes: (idoso.condicoesConhecidas ?? []).join(", "),
    pin: "",
  });

  const campo = "rounded-2xl border-2 border-borda px-4 py-3 outline-none focus:border-marca";

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const corpo: Record<string, unknown> = {
            nome: form.nome,
            sobrenome: form.sobrenome,
            quartoNumero: form.quartoNumero,
            dataNascimento: form.dataNascimento,
            condicoesConhecidas: form.condicoes
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
          };
          if (form.pin) corpo.pin = form.pin;
          void aoSalvar(
            corpo,
            form.pin
              ? "Dados salvos. O PIN mudou: o próximo acesso vai pedir o número novo."
              : "Dados salvos.",
          );
          setForm({ ...form, pin: "" });
        }}
        className="rounded-3xl border-2 border-borda bg-superficie p-6"
      >
        <h2 className="text-xl font-bold">Dados do residente</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 font-semibold">
            Nome
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} />
          </label>
          <label className="flex flex-col gap-2 font-semibold">
            Sobrenome
            <input
              value={form.sobrenome}
              onChange={(e) => setForm({ ...form, sobrenome: e.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-2 font-semibold">
            Quarto
            <input
              value={form.quartoNumero}
              onChange={(e) => setForm({ ...form, quartoNumero: e.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-2 font-semibold">
            Data de nascimento
            <input
              type="date"
              value={form.dataNascimento}
              onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-2 font-semibold sm:col-span-2">
            Condições conhecidas (separadas por vírgula)
            <input
              value={form.condicoes}
              onChange={(e) => setForm({ ...form, condicoes: e.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-2 font-semibold">
            Novo PIN (deixe vazio para manter)
            <input
              inputMode="numeric"
              maxLength={4}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
              className={campo}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-6 min-h-14 rounded-2xl bg-marca px-10 text-lg font-bold text-white"
        >
          Salvar
        </button>
      </form>

      <section className="rounded-3xl border-2 border-borda bg-superficie p-6">
        <h2 className="text-xl font-bold">Tablet e quiosque</h2>
        <p className="mt-2 text-tinta-suave">
          {idoso.dispositivoVinculado
            ? "Um tablet está vinculado: o residente entra sem digitar o PIN."
            : "Nenhum tablet vinculado. O próximo acesso vai pedir nome e PIN."}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => aoSalvar({ resetarDispositivo: true }, "Vínculo do tablet removido.")}
            disabled={!idoso.dispositivoVinculado}
            className="min-h-12 rounded-2xl border-2 border-borda px-5 font-semibold disabled:opacity-40"
          >
            Desvincular tablet
          </button>
          <button
            type="button"
            onClick={() =>
              aoSalvar(
                { kioskAtivo: !idoso.kioskAtivo },
                idoso.kioskAtivo ? "Quiosque desligado." : "Quiosque ligado.",
              )
            }
            className="min-h-12 rounded-2xl border-2 border-borda px-5 font-semibold"
          >
            {idoso.kioskAtivo ? "Desligar modo quiosque" : "Ligar modo quiosque"}
          </button>
          <button
            type="button"
            onClick={() =>
              aoSalvar({ ativo: !idoso.ativo }, idoso.ativo ? "Cadastro inativado." : "Cadastro reativado.")
            }
            className="min-h-12 rounded-2xl border-2 border-borda px-5 font-semibold"
          >
            {idoso.ativo ? "Inativar cadastro" : "Reativar cadastro"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-borda bg-superficie p-6">
        <h2 className="text-xl font-bold">Consentimento</h2>
        <label className="mt-3 flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={idoso.consentimentoAssinado}
            onChange={(e) =>
              aoSalvar(
                { consentimentoAssinado: e.target.checked },
                "Consentimento atualizado.",
              )
            }
            className="h-6 w-6 accent-[var(--color-marca)]"
          />
          Termo assinado pela família está arquivado na instituição
        </label>
        <p className="mt-2 text-sm text-tinta-suave">
          O termo físico ou digital fica fora do sistema; aqui registramos apenas
          que ele existe.
        </p>
      </section>

      <section className="rounded-3xl border-2 border-alerta/40 bg-superficie p-6">
        <h2 className="text-xl font-bold text-alerta">Exclusão de dados (LGPD)</h2>
        <p className="mt-2 text-tinta-suave">
          Atende ao pedido de eliminação do titular ou do responsável legal.
          Apaga conversas, mensagens, indícios, relatórios e PDFs. O registro de
          auditoria da exclusão permanece.
        </p>
        <button
          type="button"
          onClick={aoExcluir}
          className="mt-4 min-h-12 rounded-2xl bg-alerta px-6 font-semibold text-white"
        >
          Excluir todos os dados deste residente
        </button>
      </section>
    </div>
  );
}
