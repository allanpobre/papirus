interface ImportMetaEnv {
  /** Projeto Supabase do Codex ao vivo, definido na publicação (opcional). */
  readonly VITE_PAPIRUS_SUPABASE_URL?: string
  readonly VITE_PAPIRUS_SUPABASE_KEY?: string
  /** Endereço público onde o Papirus está publicado (para os links dos jogadores). */
  readonly VITE_PAPIRUS_PUBLIC_URL?: string
}

/** Versão do Papirus (do package.json). */
declare const __APP_VERSION__: string
