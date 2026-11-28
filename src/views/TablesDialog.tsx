import { createPortal } from 'react-dom'
import { Modal } from '../ui/Modal'
import { RandomTables } from './rpg/DiceTab'

/**
 * As tabelas de sorteio (nomes de taverna, rumores, encontros) no Mundo: as mesmas da Mesa. Uma linha pode sortear do mundo
 * ({lugar}, {personagem}) ou chamar outra tabela pelo nome ({Taverna}); nomes de fichas no texto viram ligações em "Virar pista".
 */
export function TablesDialog({ onClose }: { onClose: () => void }) {
  // Sai do desenho da lista e vai para o corpo da página (como a janela da árvore).
  return createPortal(
    <Modal title="Tabelas de sorteio" size="md" onClose={onClose} about="Listas que você rola com um clique: nomes de taverna, rumores, encontros. As mesmas da Mesa e de “Rolar no mundo”.">
      <RandomTables />
    </Modal>,
    document.body,
  )
}
