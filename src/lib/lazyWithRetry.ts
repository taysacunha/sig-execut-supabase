import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "app_chunk_reloaded_at";

/**
 * Carrega páginas sob demanda. Se o arquivo pedido não existir mais
 * (versão nova publicada enquanto a aba antiga estava aberta),
 * recarrega a página uma única vez para buscar a versão atual.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 15000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
