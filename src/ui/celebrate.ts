let fire: (() => void) | null = null

/** Comemora (uma chuva de confete), se o `Confetti` estiver na tela. */
export function celebrate() {
  fire?.()
}

/** Quem desenha o confete diz aqui o que fazer ao comemorar; devolve como desligar. */
export function onCelebrate(handler: () => void): () => void {
  fire = handler
  return () => {
    fire = null
  }
}
