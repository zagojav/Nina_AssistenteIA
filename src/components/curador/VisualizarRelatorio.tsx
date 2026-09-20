"use client";

import { useCallback, useEffect, useState } from "react";

import Cabecalho from "@/components/curador/Cabecalho";
import LoginCurador from "@/components/curador/LoginCurador";
import { apiCurador, baixarPdf, dataHora, useCurador } from "@/components/curador/api";
import { CATEGORIA_LABEL } from "@/lib/types";
import type { Indicio, Relatorio } from "@/lib/types";

/** Tira ênfase markdown: o relatório é exibido como texto corrido. */
function semEnfase(texto: string): string {
  return texto.replace(/[*`]/g, "").replace(/\s{2,}/g, " ").trim();
}

/** Renderiza o markdown simples produzido pelo modelo (títulos, listas, texto). */
function Conteudo({ texto }: { texto: string }) {
  const blocos = texto.split("\n");
  return (
    <article className="flex flex-col gap-3 rounded-3xl border border-borda bg-superficie p-6 leading-relaxed">
      {blocos.map((linha, i) => {
        const conteudo = linha.trim();
        if (!conteudo) return null;
        if (conteudo.startsWith("## ")) {
          return (
            <h2 key={i} className="mt-4 text-xl font-bold text-marca">
              {conteudo.slice(3)}
            </h2>
          );
        }
        if (conteudo.startsWith("# ")) {
          return (
            <h2 key={i} className="mt-4 text-2xl font-bold text-marca">
              {conteudo.slice(2)}
            </h2>
          );
        }
        if (/^[-*]\s/.test(conteudo)) {
          return (
            <p key={i} className="pl-5 -indent-4">
              • {semEnfase(conteudo.slice(2))}
            </p>
          );
        }
        return <p key={i}>{semEnfase(conteudo)}</p>;
      })}
    </article>
  );
}

export default function VisualizarRelatorio({ relatorioId }: { relatorioId: string }) {
  const { usuario, carregando } = useCurador();
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [indicios, setIndicios] = useState<Indicio[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [metodo, setMetodo] = useState<"email" | "whatsapp">("email");
  const [destino, setDestino] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const dados = await apiCurador<{ relatorio: Relatorio; indicios: Indicio[] }>(
        `/api/admin/relatorios/${relatorioId}`,
      );
      setRelatorio(dados.relatorio);
      setIndicios(dados.indicios);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    }
  }, [relatorioId]);

  useEffect(() => {
    if (usuario) void carregar();
  }, [usuario, carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    setAviso("");
    try {
      const resultado = await apiCurador<{ linkWhatsapp?: string }>(
        `/api/admin/relatorios/${relatorioId}/enviar`,
        { method: "POST", body: JSON.stringify({ metodo, destino }) },
      );
      if (resultado.linkWhatsapp) {
        window.open(resultado.linkWhatsapp, "_blank", "noopener");
        setAviso("WhatsApp aberto com o link temporário (válido por 30 minutos).");
      } else {
        setAviso("Relatório enviado por e-mail.");
      }
      setDestino("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setEnviando(false);
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

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecalho
        titulo="Relatório"
        subtitulo={
          relatorio
            ? `${relatorio.tipo.replace("_", " ")} · ${dataHora(relatorio.periodoInicio)} a ${dataHora(relatorio.periodoFim)}`
            : undefined
        }
        voltarPara={relatorio ? `/curador/idosos/${relatorio.idosoId}` : "/curador"}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        {erro && (
          <p role="alert" className="mb-6 rounded-2xl bg-alerta/10 p-4 font-semibold text-alerta">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="mb-6 rounded-2xl bg-marca-clara p-4 font-semibold text-marca">
            {aviso}
          </p>
        )}

        {relatorio && (
          <>
            <Conteudo texto={relatorio.conteudoFormatado} />

            {indicios.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Indícios incluídos</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {indicios.map((i) => (
                    <li key={i.id} className="rounded-2xl border border-borda bg-superficie p-5">
                      <p className="font-bold">{i.tipo.replace(/_/g, " ")}</p>
                      <p className="mt-1">{i.descricao}</p>
                      <p className="mt-2 text-sm text-tinta-suave">
                        {CATEGORIA_LABEL[i.categoriaRelacionada]} · sinal {i.severidadeSinal}
                      </p>
                      <p className="mt-1 text-sm text-tinta-suave">Fonte: {i.fonteReferencia}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8 rounded-3xl border-2 border-borda bg-superficie p-6">
              <h2 className="text-xl font-bold">Entregar o relatório</h2>

              <button
                type="button"
                onClick={() =>
                  baixarPdf(relatorioId, `relatorio-${relatorioId}.pdf`).catch((e) =>
                    setErro(e instanceof Error ? e.message : "Falha no download."),
                  )
                }
                className="mt-4 min-h-14 w-full rounded-2xl bg-marca text-lg font-bold text-white sm:w-auto sm:px-10"
              >
                Baixar PDF
              </button>

              <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
                <div className="flex gap-2" role="group" aria-label="Forma de envio">
                  {(["email", "whatsapp"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodo(m)}
                      aria-pressed={metodo === m}
                      className={`min-h-12 flex-1 rounded-2xl border-2 font-semibold transition ${
                        metodo === m ? "border-marca bg-marca text-white" : "border-borda"
                      }`}
                    >
                      {m === "email" ? "E-mail" : "WhatsApp"}
                    </button>
                  ))}
                </div>

                <label className="flex flex-col gap-2 font-semibold">
                  {metodo === "email" ? "E-mail do destinatário" : "WhatsApp com DDI e DDD"}
                  <input
                    required
                    type={metodo === "email" ? "email" : "tel"}
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    placeholder={metodo === "email" ? "familia@exemplo.com" : "5511999998888"}
                    className="rounded-2xl border-2 border-borda px-4 py-3 outline-none focus:border-marca"
                  />
                </label>

                <p className="text-sm text-tinta-suave">
                  {metodo === "email"
                    ? "O PDF vai como anexo."
                    : "O WhatsApp não aceita anexo por link: a mensagem leva um link assinado que expira em 30 minutos."}
                </p>

                <button
                  type="submit"
                  disabled={enviando || !destino}
                  className="min-h-14 rounded-2xl border-2 border-marca text-lg font-bold text-marca disabled:opacity-40"
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
