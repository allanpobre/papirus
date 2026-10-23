import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { View } from '../state/workspace'
import { modKey } from '../ui/keys'

/** Um passo do tour: o que destacar (seletor) e o que dizer. Sem alvo, o balão fica no centro. */
interface Step {
  target?: string
  view?: View
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    title: 'Bem-vindo ao Papirus',
    body: 'Um passeio rápido pelas partes da tela, em menos de um minuto. Pode pular agora e refazer depois, pelo Início ou pelos Ajustes.',
  },
  { target: '[data-tour="menu"]', title: 'O menu', body: 'Cada área do seu mundo fica aqui. Não usa alguma? Esconda em Ajustes → Áreas do menu. Nada é apagado.' },
  { target: '[data-tour="universos"]', title: 'Seus universos', body: 'Clique aqui para voltar à lista de universos: criar outro, abrir o exemplo ou trocar de mundo.' },
  { target: '[data-tour="busca"]', title: 'Buscar em tudo', body: `Procura em fichas, cenas, fatos, eventos e sessões. Atalho: ${modKey} K, de qualquer lugar.` },
  { target: '[data-tour="continuar"]', view: 'inicio', title: 'Início', body: 'Onde você parou, as palavras do dia e o que pede atenção. Cada universo abre aqui.' },
  {
    target: '[data-tour="editor"]',
    view: 'escrever',
    title: 'Escrever',
    body: 'Escreva aqui. Nomes de fichas ficam sublinhados. Selecione um trecho e aparece uma barra para criar ficha, guardar um fato ou comentar. Nada vira ficha sozinho.',
  },
  { target: '[data-tour="margem"]', view: 'escrever', title: 'A margem', body: 'Mostra quem aparece no parágrafo, nomes novos que talvez mereçam ficha e perguntas de continuidade. Dá para fechar.' },
  { target: '[data-tour="nav-fichas"]', title: 'Fichas', body: 'Personagens, lugares, facções, objetos e o que mais você inventar. Com segredos, campos livres e relações.' },
  { target: '[data-tour="nav-timeline"]', title: 'Relações, Timeline e Atlas', body: 'O mundo desenhado a partir do que você registra: o grafo de relações, a linha do tempo com calendário próprio e os mapas.' },
  { target: '[data-tour="nav-rpg"]', title: 'Mesa de RPG', body: 'Sessões, fichas de jogo, iniciativa, dados e o Codex: o que os jogadores já descobriram, ao vivo no celular deles.' },
  { target: '[data-tour="nav-inbox"]', title: 'Inbox', body: `Ideias rápidas esperam aqui até você decidir o que fazer. Anote de qualquer lugar com ${modKey} Shift I.` },
  { target: '[data-tour="nav-config"]', title: 'Ajustes e dados', body: 'Separados por categoria: aparência (tema, cor, fonte), universo e calendário, escrita, menu, backup, livros e conta. Tem busca: escreva “tema” ou “backup”.' },
  { target: '[data-tour="tema"]', title: 'Claro ou escuro', body: 'Troca o tema na hora. A cor de destaque fica em Ajustes → Aparência.' },
  { target: '[data-tour="conta"]', title: 'Conta (opcional)', body: 'Sem conta, tudo fica neste navegador. Com conta, seus universos aparecem em todos os seus aparelhos.' },
  { target: '[data-tour="salvo"]', title: 'Salvo sozinho', body: 'Cada mudança é salva na hora. Daqui a uma semana, o Papirus lembra você de fazer um backup.' },
  { title: 'Pronto!', body: 'É isso. Comece por “Continuar escrevendo” no Início. O tour pode ser refeito quando quiser.' },
]

const GAP = 12
const CARD_W = 330

function findTarget(step: Step): HTMLElement | null {
  if (!step.target) return null
  const el = document.querySelector<HTMLElement>(step.target)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

export function Tour({ onGo, onClose }: { onGo: (v: View) => void; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(200)
  const dir = useRef<1 | -1>(1)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const step = STEPS[index]

  const finish = useCallback(() => {
    onGo('inicio')
    onClose()
  }, [onGo, onClose])

  const move = useCallback(
    (d: 1 | -1) => {
      dir.current = d
      setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + d)))
    },
    [],
  )

  // Vai para a área do passo, espera desenhar e mede o alvo; sem alvo (área escondida ou vazia), pula.
  useEffect(() => {
    if (step.view) onGo(step.view)
    let tries = 0
    let frame = 0
    const locate = () => {
      const el = findTarget(step)
      if (!el && step.target) {
        if (tries++ < 20) {
          frame = window.setTimeout(locate, 50)
          return
        }
        const next = index + dir.current
        if (next >= 0 && next < STEPS.length) setIndex(next)
        else setRect(null)
        return
      }
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      setRect(el ? el.getBoundingClientRect() : null)
    }
    locate()
    return () => clearTimeout(frame)
  }, [index, step, onGo])

  useEffect(() => {
    const onResize = () => {
      const el = findTarget(step)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    addEventListener('resize', onResize)
    return () => removeEventListener('resize', onResize)
  }, [step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
    nextRef.current?.focus()
  }, [index, rect])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight') {
        if (index === STEPS.length - 1) finish()
        else move(1)
      }
      else if (e.key === 'ArrowLeft') move(-1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [index, move, finish])

  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(CARD_W, vw - 24)
  let pos: { left: number; top: number }
  if (!rect) {
    pos = { left: (vw - w) / 2, top: Math.max(12, (vh - cardH) / 2) }
  } else if (rect.right + GAP + w < vw - 12 && rect.width < vw / 2) {
    pos = { left: rect.right + GAP, top: rect.top + rect.height / 2 - cardH / 2 }
  } else if (rect.bottom + GAP + cardH < vh - 12) {
    pos = { left: rect.left + rect.width / 2 - w / 2, top: rect.bottom + GAP }
  } else if (rect.top - GAP - cardH > 12) {
    pos = { left: rect.left + rect.width / 2 - w / 2, top: rect.top - GAP - cardH }
  } else {
    pos = { left: (vw - w) / 2, top: Math.max(12, vh - cardH - 12) }
  }
  pos = { left: Math.max(12, Math.min(pos.left, vw - w - 12)), top: Math.max(12, Math.min(pos.top, vh - cardH - 12)) }

  const last = index === STEPS.length - 1
  const pad = 6

  return (
    <div className="tour" role="presentation">
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div
          className="tour-spot"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}
      <div ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ left: pos.left, top: pos.top, width: w }}>
        <div className="tour-head">
          <span className="tour-count tabular">
            {index + 1} de {STEPS.length}
          </span>
          <button type="button" className="btn-icon btn-sm" aria-label="Fechar o tour" onClick={finish}>
            <X size={14} />
          </button>
        </div>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          {index === 0 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={finish}>
              Pular o tour
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(-1)}>
              <ArrowLeft size={14} /> Voltar
            </button>
          )}
          <button ref={nextRef} type="button" className="btn btn-primary btn-sm" onClick={() => (last ? finish() : move(1))}>
            {last ? 'Começar' : index === 0 ? 'Mostrar' : 'Próximo'} {!last && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
