"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Cabecalho from "@/components/curador/Cabecalho";
import LoginCurador from "@/components/curador/LoginCurador";
import { apiCurador, dataHora, useCurador } from "@/components/curador/api";
import type { IdosoPublico } from "@/lib/types";

type IdosoLista = IdosoPublico & { dispositivoVinculado: boolean };

interface RelatorioResumo {
  id: string;
  idosoId: string;
  tipo: string;
  qtdIndicios: number;
  criadoEm: string;
  status: string;
}

type Aba = "residentes" | "cadastrar" | "relatorios";

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "residentes", rotulo: "Residentes" },
  { chave: "cadastrar", rotulo: "Cadastrar residente" },
  { chave: "relatorios", rotulo: "Relatórios" },
];

export default function Painel() {
  const { usuario, carregando } = useCurador();
  const [aba, setAba] = useState<Aba>("residentes");
  const [dados, setDados] = useState<{ curador: { nome: string }; instituicao: { nome: string } } | null>(null);
  const [idosos, setIdosos] = useState<IdosoLista[]>([]);
  const [relatorios, setRelatorios] = useState<RelatorioResumo[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [me, listaIdosos, listaRelatorios] = await Promise.all([
        apiCurador<{ curador: { nome: string }; instituicao: { nome: string } }>("/api/admin/me"),
        apiCurador<{ idosos: IdosoLista[] }>("/api/admin/idosos"),
        apiCurador<{ relatorios: RelatorioResumo[] }>("/api/admin/relatorios"),
      ]);
      setDados(me);
      setIdosos(listaIdosos.idosos);
      setRelatorios(listaRelatorios.relatorios.slice(0, 8));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    }
  }, []);

  useEffect(() => {
    if (usuario) void carregar();
  }, [usuario, carregar]);

  if (carregando) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-xl text-tinta-suave">Carregando…</p>
      </main>
    );
  }
  if (!usuario) return <LoginCurador />;

  const nomePor = (id: string) => {
    const i = idosos.find((x) => x.id === id);
    return i ? `${i.nome} ${i.sobrenome}` : "—";
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho
        titulo={dados?.instituicao.nome ?? "Painel"}
        subtitulo={dados ? `Curador: ${dados.curador.nome}` : undefined}
      />

      <nav
        className="flex gap-1 overflow-x-auto border-b border-borda bg-superficie px-5"
        aria-label="Seções do painel"
      >
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            aria-current={aba === a.chave ? "page" : undefined}
            className={`min-h-12 whitespace-nowrap px-4 font-semibold transition ${
              aba === a.chave ? "border-b-4 border-marca text-marca" : "text-tinta-suave"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
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

        {aba === "residentes" && (
          <section aria-labelledby="titulo-residentes">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="titulo-residentes" className="text-xl font-bold">
                Residentes ({idosos.length})
              </h2>
              <button
                type="button"
                onClick={() => setAba("cadastrar")}
                className="min-h-12 rounded-2xl bg-marca px-5 font-semibold text-white"
              >
                Cadastrar residente
              </button>
            </div>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {idosos.map((idoso) => (
                <li key={idoso.id}>
                  <Link
                    href={`/curador/idosos/${idoso.id}`}
                    className="flex flex-col gap-1 rounded-2xl border-2 border-borda bg-superficie p-5 transition hover:border-marca"
                  >
                    <span className="text-xl font-bold">
                      {idoso.nome} {idoso.sobrenome}
                    </span>
                    <span className="text-base text-tinta-suave">
                      Quarto {idoso.quartoNumero || "—"} ·{" "}
                      {idoso.dispositivoVinculado
                        ? "tablet vinculado"
                        : "aguardando 1º acesso"}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-2 text-sm">
                      {!idoso.consentimentoAssinado && (
                        <em className="rounded-full bg-destaque/15 px-3 py-1 font-semibold not-italic text-destaque">
                          sem consentimento registrado
                        </em>
                      )}
                      {!idoso.ativo && (
                        <em className="rounded-full bg-borda px-3 py-1 font-semibold not-italic text-tinta-suave">
                          inativo
                        </em>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
              {!idosos.length && (
                <li className="text-lg text-tinta-suave">
                  Nenhum residente cadastrado ainda. Use a aba{" "}
                  <strong>Cadastrar residente</strong>.
                </li>
              )}
            </ul>
          </section>
        )}

        {aba === "cadastrar" && (
          <section aria-labelledby="titulo-cadastro">
            <h2 id="titulo-cadastro" className="text-xl font-bold">
              Novo residente
            </h2>
            <p className="mt-1 text-tinta-suave">
              O PIN de 4 dígitos é o que o residente digita no tablet no
              primeiro acesso. Depois disso o aparelho fica vinculado e ele
              entra direto.
            </p>
            <FormularioNovoIdoso
              aoCriar={(nome) => {
                setAviso(`${nome} cadastrado.`);
                setAba("residentes");
                void carregar();
              }}
            />
          </section>
        )}

        {aba === "relatorios" && (
          <section aria-labelledby="titulo-relatorios">
            <h2 id="titulo-relatorios" className="text-xl font-bold">
              Relatórios ({relatorios.length})
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {relatorios.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/curador/relatorios/${r.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-borda bg-superficie px-5 py-4 transition hover:border-marca"
                  >
                    <span className="font-semibold">{nomePor(r.idosoId)}</span>
                    <span className="text-base text-tinta-suave">
                      {r.tipo.replace("_", " ")} · {r.qtdIndicios} indício(s) ·{" "}
                      {dataHora(r.criadoEm)}
                    </span>
                  </Link>
                </li>
              ))}
              {!relatorios.length && (
                <li className="text-lg text-tinta-suave">
                  Nenhum relatório ainda. Eles aparecem ao fim de cada conversa.
                </li>
              )}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function FormularioNovoIdoso({ aoCriar }: { aoCriar: (nome: string) => void }) {
  const [form, setForm] = useState({
    nome: "",
    sobrenome: "",
    pin: "",
    dataNascimento: "",
    quartoNumero: "",
    condicoes: "",
    consentimentoAssinado: false,
  });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await apiCurador("/api/admin/idosos", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          condicoesConhecidas: form.condicoes
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        }),
      });
      aoCriar(`${form.nome} ${form.sobrenome}`.trim());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao cadastrar.");
      setEnviando(false);
    }
  }

  const campo = "rounded-2xl border-2 border-borda px-4 py-3 outline-none focus:border-marca";

  return (
    <form onSubmit={criar} className="mt-4 rounded-3xl border-2 border-borda bg-superficie p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 font-semibold">
          Nome
          <input
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-2 font-semibold">
          Sobrenome
          <input
            required
            value={form.sobrenome}
            onChange={(e) => setForm({ ...form, sobrenome: e.target.value })}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-2 font-semibold">
          PIN (4 dígitos)
          <input
            required
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
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
        <label className="flex flex-col gap-2 font-semibold">
          Quarto
          <input
            value={form.quartoNumero}
            onChange={(e) => setForm({ ...form, quartoNumero: e.target.value })}
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-2 font-semibold">
          Condições conhecidas (separadas por vírgula)
          <input
            value={form.condicoes}
            onChange={(e) => setForm({ ...form, condicoes: e.target.value })}
            className={campo}
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-3 font-semibold">
        <input
          type="checkbox"
          checked={form.consentimentoAssinado}
          onChange={(e) => setForm({ ...form, consentimentoAssinado: e.target.checked })}
          className="h-6 w-6 accent-[var(--color-marca)]"
        />
        Termo de consentimento assinado pela família
      </label>

      {erro && (
        <p role="alert" className="mt-4 font-semibold text-alerta">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 min-h-14 w-full rounded-2xl bg-marca text-lg font-bold text-white disabled:opacity-40 sm:w-auto sm:px-10"
      >
        {enviando ? "Salvando…" : "Cadastrar"}
      </button>
    </form>
  );
}
