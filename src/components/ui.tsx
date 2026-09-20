"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Peças de interface das telas do residente.
 *
 * Três decisões que valem para todas elas:
 *  - alvo de toque nunca menor que 64px de altura (mão trêmula, dedo grosso,
 *    tablet apoiado na mesa);
 *  - o que o botão faz vem escrito, não só desenhado. Ícone é reforço,
 *    nunca a única pista;
 *  - contraste alto e nenhuma dependência de cor para entender o estado.
 */

type Variante = "principal" | "secundario" | "perigo" | "suave";

const ESTILO: Record<Variante, string> = {
  principal:
    "bg-marca text-white border-marca hover:bg-marca-escura active:bg-marca-escura",
  secundario:
    "bg-superficie text-tinta border-borda hover:border-marca active:bg-marca-clara",
  perigo: "bg-superficie text-alerta border-alerta/50 hover:border-alerta",
  suave: "bg-marca-clara text-marca border-marca-clara hover:border-marca",
};

const BASE =
  "flex min-h-18 w-full items-center justify-center gap-3 rounded-3xl border-2 px-6 py-4 text-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-40";

export function BotaoGrande({
  children,
  dica,
  variante = "principal",
  ...props
}: {
  children: ReactNode;
  dica?: string;
  variante?: Variante;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    // `type` antes do spread: o padrão é "button", e quem precisa de submit
    // sobrescreve. Sem isso, um botão dentro de formulário enviaria sem querer.
    <button type="button" {...props} className={`${BASE} ${ESTILO[variante]} flex-col gap-1`}>
      <span>{children}</span>
      {dica && <span className="text-base font-normal opacity-80">{dica}</span>}
    </button>
  );
}

export function LinkGrande({
  children,
  href,
  dica,
  variante = "principal",
}: {
  children: ReactNode;
  href: string;
  dica?: string;
  variante?: Variante;
}) {
  return (
    <Link href={href} className={`${BASE} ${ESTILO[variante]} flex-col gap-1`}>
      <span>{children}</span>
      {dica && <span className="text-base font-normal opacity-80">{dica}</span>}
    </Link>
  );
}

/** Botão de voltar, mesma forma e mesma posição em todas as telas. */
export function Voltar({ href, rotulo = "Voltar" }: { href: string; rotulo?: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 shrink-0 items-center gap-2 rounded-2xl border-2 border-borda bg-superficie px-5 text-lg font-bold text-tinta transition hover:border-marca"
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        ←
      </span>
      {rotulo}
    </Link>
  );
}

/** Faixa de instrução: o que fazer agora, em uma frase, sempre no mesmo lugar. */
export function Instrucao({ children }: { children: ReactNode }) {
  return (
    <p
      aria-live="polite"
      className="rounded-3xl bg-marca-clara px-6 py-5 text-center text-2xl font-semibold leading-snug text-marca"
    >
      {children}
    </p>
  );
}

/** Progresso em palavras, não só em barra: "Rodada 2 de 5". */
export function Progresso({ atual, total, rotulo = "Rodada" }: {
  atual: number;
  total: number;
  rotulo?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center text-lg font-semibold text-tinta-suave">
        {rotulo} {atual} de {total}
      </p>
      <div
        role="progressbar"
        aria-valuenow={atual}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${rotulo} ${atual} de ${total}`}
        className="h-3 w-full overflow-hidden rounded-full bg-borda"
      >
        <div
          className="h-full rounded-full bg-marca transition-all duration-300"
          style={{ width: `${Math.round((atual / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}
