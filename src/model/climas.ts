/*
 * Os climas do mundo: com a "Nova cara" ligada, cada universo tem a sua cara (cores, letras, molduras e
 * texturas), como os temas da Mesa. "Caderno" é o Papirus de sempre.
 */
export type Clima = 'caderno' | 'fantasia' | 'ficcao' | 'terror'

export const CLIMAS: { id: Clima; name: string; hint: string; swatch: [string, string, string] }[] = [
  { id: 'caderno', name: 'Caderno', hint: 'O Papirus de sempre: papel, tinta e calma.', swatch: ['#e9ece7', '#f7f8f5', '#1d6b58'] },
  { id: 'fantasia', name: 'Fantasia', hint: 'Carvão quente, ouro e letras gravadas, como num RPG.', swatch: ['#1f1d1a', '#2d2b27', '#d9b45b'] },
  { id: 'ficcao', name: 'Ficção científica', hint: 'Painéis escuros, linhas finas e luz azul.', swatch: ['#0d1322', '#131b2e', '#38d3ff'] },
  { id: 'terror', name: 'Terror', hint: 'Cinza-vinho, papel velho e vermelho de sangue.', swatch: ['#1b1819', '#2a2627', '#d4434a'] },
]

/** O clima do universo (sem escolha: caderno). */
export const climaOf = (u: { settings: { clima?: Clima | null } }): Clima => u.settings.clima ?? 'caderno'
