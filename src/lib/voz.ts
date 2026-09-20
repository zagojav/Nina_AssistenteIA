"use client";

/**
 * Voz pela Web Speech API nativa do navegador, reconhecimento e síntese.
 * Nada disso passa por API paga: roda no próprio aparelho.
 *
 * Suporte varia: Chrome/Edge (incluindo Android) reconhecem bem em pt-BR;
 * Safari tem suporte parcial e o Firefox não tem reconhecimento. Por isso o
 * modo texto continua sendo o padrão e o toggle só aparece quando há suporte.
 */

interface ResultadoFala {
  isFinal: boolean;
  0: { transcript: string };
}

interface EventoReconhecimento extends Event {
  results: { length: number; [i: number]: ResultadoFala };
  resultIndex: number;
}

interface Reconhecimento extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoReconhecimento) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}

type ConstrutorReconhecimento = new () => Reconhecimento;

function construtor(): ConstrutorReconhecimento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function vozDisponivel(): boolean {
  return Boolean(construtor()) && typeof window !== "undefined" && "speechSynthesis" in window;
}

export function criarReconhecimento(): Reconhecimento | null {
  const Ctor = construtor();
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "pt-BR";
  r.continuous = false;
  r.interimResults = true;
  return r;
}

/** Fala o texto da Nina em ritmo levemente mais lento que o padrão. */
export function falar(texto: string, aoTerminar?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    aoTerminar?.();
    return;
  }
  window.speechSynthesis.cancel();

  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 0.92;
  fala.pitch = 1;

  const vozPt = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("pt"));
  if (vozPt) fala.voice = vozPt;

  fala.onend = () => aoTerminar?.();
  fala.onerror = () => aoTerminar?.();
  window.speechSynthesis.speak(fala);
}

export function calarBoca() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
