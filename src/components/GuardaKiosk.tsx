"use client";

import { useCallback, useEffect, useState } from "react";

import SenhaCurador from "@/components/SenhaCurador";

/**
 * Modo quiosque.
 *
 * O que dá pra travar no navegador está aqui: tela cheia, gesto de voltar
 * interceptado, e bloqueio ao perder o foco. Se o app sair para segundo plano,
 * ao voltar só a senha de um CURADOR destrava — nunca o PIN do próprio idoso,
 * senão a trava não serviria de nada.
 *
 * Limite conhecido (avisar a instituição): no iOS o swipe de sair do app não é
 * bloqueável — o Safari não expõe isso. A tela de senha ao voltar é a
 * contenção possível. No Android, com o PWA instalado e definido como app
 * padrão (ou fixado na tela via Fixação de Tela), o comportamento chega perto
 * de um quiosque real.
 */
export default function GuardaKiosk({ ativo }: { ativo: boolean }) {
  const [bloqueado, setBloqueado] = useState(false);

  const entrarTelaCheia = useCallback(async () => {
    if (!ativo || document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Sem gesto do usuário ou sem suporte (iOS): segue sem tela cheia.
    }
  }, [ativo]);

  useEffect(() => {
    if (!ativo) {
      document.body.dataset.kiosk = "false";
      return;
    }
    document.body.dataset.kiosk = "true";

    // Tela cheia precisa de gesto: engata no primeiro toque.
    const aoTocar = () => void entrarTelaCheia();
    document.addEventListener("pointerdown", aoTocar, { once: true });

    // Gesto/botão "voltar": reempilha o estado e ignora a saída.
    history.pushState({ nina: true }, "");
    const aoVoltar = () => history.pushState({ nina: true }, "");
    window.addEventListener("popstate", aoVoltar);

    // Perdeu o foco: ao voltar, exige senha do curador. `visibilitychange`
    // é disparado no document — escutar no window depende de propagação.
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") setBloqueado(true);
    };
    const aoPerderFoco = () => {
      // `hasFocus` evita travar o tablet quando o próprio teclado virtual ou
      // um seletor nativo rouba o foco por um instante.
      if (!document.hasFocus()) setBloqueado(true);
    };
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("blur", aoPerderFoco);

    // Duplo toque para dar zoom.
    const semZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchstart", semZoom, { passive: false });

    // Menu de contexto por long-press.
    const semMenu = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", semMenu);

    return () => {
      document.body.dataset.kiosk = "false";
      document.removeEventListener("pointerdown", aoTocar);
      window.removeEventListener("popstate", aoVoltar);
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("blur", aoPerderFoco);
      document.removeEventListener("touchstart", semZoom);
      document.removeEventListener("contextmenu", semMenu);
    };
  }, [ativo, entrarTelaCheia]);

  if (!ativo || !bloqueado) return null;

  return (
    <SenhaCurador
      titulo="Aplicativo bloqueado"
      descricao="Um curador precisa liberar o tablet para continuar."
      rotuloConfirmar="Liberar"
      aoConfirmar={() => {
        setBloqueado(false);
        void entrarTelaCheia();
      }}
    />
  );
}
