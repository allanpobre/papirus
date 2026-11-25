import type { Editor } from '@tiptap/react'

/**
 * Marca a seleção como segredo: põe [segredo] antes e [/segredo] depois, as duas juntas (sem o risco de
 * esquecer de fechar). Só o autor vê; leitor, wiki, link e o livro que sai nunca levam.
 */
export function markSecret(editor: Editor) {
  const { from, to } = editor.state.selection
  if (from === to) return
  const open = '[segredo]'
  const close = '[/segredo]'
  // Primeiro o fim: assim a posição do começo continua valendo. Depois, o cursor vai para depois do fechamento,
  // para continuar escrevendo fora do segredo.
  editor
    .chain()
    .focus()
    .insertContentAt(to, close)
    .insertContentAt(from, open)
    .setTextSelection(to + open.length + close.length)
    .run()
}
