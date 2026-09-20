import "server-only";

/**
 * Freio simples para tentativa de PIN por força bruta.
 *
 * Limitação conhecida: o contador vive na memória da instância, então em
 * deploy com várias instâncias o limite é por instância. Para produção com
 * escala horizontal, trocar por um contador no Firestore ou Redis.
 */
const tentativas = new Map<string, { contador: number; ate: number }>();

const LIMITE = 5;
const JANELA_MS = 10 * 60_000;

export function bloqueado(chave: string): boolean {
  const reg = tentativas.get(chave);
  if (!reg) return false;
  if (Date.now() > reg.ate) {
    tentativas.delete(chave);
    return false;
  }
  return reg.contador >= LIMITE;
}

export function registrarFalha(chave: string) {
  const reg = tentativas.get(chave);
  if (!reg || Date.now() > reg.ate) {
    tentativas.set(chave, { contador: 1, ate: Date.now() + JANELA_MS });
    return;
  }
  reg.contador += 1;
}

export function limparTentativas(chave: string) {
  tentativas.delete(chave);
}
