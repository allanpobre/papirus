/*
 * Atalhos de teclado (auditoria 26, Duda: “tudo pelo teclado, menos quase tudo”). As teclas de uma letra só valem
 * fora de campos de texto e sem janela aberta, para nunca atrapalhar quem escreve.
 */

/** Está escrevendo (campo, área de texto, editor) ou com uma janela aberta? Então as teclas soltas não valem. */
export function typingOrDialog(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return true
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]'))
}

/** Uma tecla solta (sem Ctrl, Cmd nem Alt). */
export const plain = (e: KeyboardEvent, key: string) => !e.ctrlKey && !e.metaKey && !e.altKey && e.key === key

/** A lista que aparece no “?” e no Guia. */
export const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ['Ctrl', 'K'], what: 'Buscar em tudo (e fazer ações: “nova cena”, “tema escuro”…)' },
  { keys: ['Ctrl', 'Shift', 'I'], what: 'Anotar uma ideia, de qualquer lugar' },
  { keys: ['Alt', '1…9'], what: 'Ir para as áreas, na ordem do menu' },
  { keys: ['['], what: 'Parte anterior da área (Fichas, Ligações, Mapas…)' },
  { keys: [']'], what: 'Próxima parte da área' },
  { keys: ['J'], what: 'Na lista de fichas: a próxima ficha' },
  { keys: ['K'], what: 'Na lista de fichas: a ficha anterior' },
  { keys: ['E'], what: 'Na ficha: alternar entre ler e editar' },
  { keys: ['Ctrl', 'F'], what: 'No Escrever: procurar no livro' },
  { keys: ['Ctrl', 'S'], what: 'Salvar agora (o Papirus já salva sozinho)' },
  { keys: ['?'], what: 'Ver estes atalhos' },
]
