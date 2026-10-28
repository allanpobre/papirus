import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useBackLayer } from '../ui/useBackLayer'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { View } from '../state/workspace'
import { modKey } from '../ui/keys'

/** Um passo do tour: o que destacar (seletor) e o que dizer. Sem alvo, o balão fica no centro. */
interface Step {
  target?: string
  view?: View
  title: string
  body: string
}

const INTRO: Step = {
  title: 'Bem-vindo ao Papirus',
  body: 'Quer um passeio rápido pelas partes da tela (1 minuto) ou o tour completo, que passa por cada área e mostra o que dá para fazer (uns 5 minutos)? Dá para refazer depois, pelo Início ou pelos Ajustes.',
}

const QUICK: Step[] = [
  { target: '[data-tour="menu"]', title: 'O menu', body: 'Cada área do seu mundo fica aqui. Não usa alguma? Esconda em Ajustes → Menu e ajuda. Nada é apagado.' },
  { target: '[data-tour="universos"]', title: 'Seus universos', body: 'Volta para a lista de universos: criar outro, abrir o exemplo ou trocar de mundo.' },
  { target: '[data-tour="busca"]', title: 'Buscar em tudo', body: `Procura em fichas, cenas, fatos, eventos e sessões, e faz ações: “nova cena”, “tema escuro”, “lixeira”. Atalho: ${modKey} K, de qualquer lugar.` },
  { target: '[data-tour="continuar"]', view: 'inicio', title: 'Início', body: 'Onde você parou, as palavras do dia e o que pede atenção. Cada universo abre aqui.' },
  {
    target: '[data-tour="editor"]',
    view: 'escrever',
    title: 'Escrever',
    body: 'Escreva aqui. Nomes de fichas ficam sublinhados. Selecione um trecho e aparece uma barra para criar ficha, guardar um fato ou comentar. Nada vira ficha sozinho.',
  },
  { target: '[data-tour="margem"]', view: 'escrever', title: 'A margem', body: 'Mostra quem aparece no parágrafo, nomes novos que talvez mereçam ficha e perguntas de continuidade. Dá para fechar.' },
  { target: '[data-tour="nav-fichas"]', title: 'Fichas', body: 'Personagens, lugares, facções, objetos e o que mais você inventar. Com retrato, segredos, campos livres e relações. Dá para ler como uma página de enciclopédia.' },
  { target: '[data-tour="nav-livro"]', title: 'Livro', body: 'Quando quiser ver o livro pronto: você escolhe a capa, o Papirus diagrama e gera o PDF. Também exporta Word e EPUB.' },
  { target: '[data-tour="nav-oficina"]', title: 'Oficina', body: 'Dicas de escrita por gênero, livros para estudar, curiosidades e exercícios que viram cena. Abre numa página à parte.' },
  { target: '[data-tour="conta"]', title: 'Conta (opcional)', body: 'Sem conta, tudo fica neste navegador. Com conta, seus universos aparecem em todos os seus aparelhos, e você ganha perfil, amigos e desafios.' },
  { target: '[data-tour="salvo"]', title: 'Salvo sozinho', body: 'Cada mudança é salva na hora. Daqui a uma semana, o Papirus lembra você de fazer um backup.' },
  { title: 'Pronto!', body: 'É isso. Comece por “Continuar escrevendo” no Início. Quando tiver um tempinho, faça o tour completo: ele mostra cada área.' },
]

/** O tour completo: passa por cada área. Melhor no exemplo, onde tudo já está preenchido. */
const DEEP: Step[] = [
  QUICK[0],
  QUICK[1],
  QUICK[2],
  QUICK[3],
  QUICK[4],
  {
    target: '.write-foot',
    view: 'escrever',
    title: 'Metas, sprint e versões',
    body: 'No rodapé: palavras da cena e do dia, e o sprint (10, 15 ou 25 minutos de escrita sem parar). Cada cena guarda sozinha uma versão por dia; volte a uma antiga pelos detalhes da cena.',
  },
  QUICK[5],
  {
    view: 'fichas',
    title: 'Fichas por dentro',
    body: 'Abra uma ficha: resumo, campos livres e segredos (só você vê). Trechos com “a partir de” só são revelados ao leitor depois daquela cena. Embaixo, o arco: em quais cenas a pessoa aparece, o que muda e quantos anos tem em cada uma.',
  },
  {
    view: 'relacoes',
    title: 'Relações',
    body: 'O mapa de quem se liga a quem, montado do que você registra. Arraste para mover, use a régua para ver como era em cada cena. Com relações de família (pai de, casado com…), aparece a Árvore da família.',
  },
  { view: 'timeline', title: 'Linha do tempo', body: 'Os eventos do mundo, com calendário próprio (meses e eras inventados). As cenas com data entram aqui, e o Papirus avisa datas impossíveis.' },
  { view: 'atlas', title: 'Atlas', body: 'Suba a imagem de um mapa e marque os lugares. Em “Caminho de”, escolha um personagem: o trajeto dele pelas cenas é desenhado sobre o mapa.' },
  { view: 'tramas', title: 'Pistas e mistérios', body: 'Pistas plantadas e onde elas se pagam. O Papirus lembra das que ainda estão abertas quando um personagem ligado a elas volta à cena.' },
  { view: 'conhecimento', title: 'Quem sabe o quê', body: 'Quem sabe o quê, e desde quando. Útil para não deixar um personagem saber algo antes da hora.' },
  { view: 'organizar', title: 'Estrutura', body: 'O quadro de cenas, como fichas de cortiça. Arraste pela alça para mudar a ordem ou passar uma cena para outra história.' },
  { view: 'livro', title: 'Livro', body: 'Escolha capa, fonte e estilo: o Papirus diagrama e gera PDF, Word ou EPUB. Daqui o livro também vai para a sua estante, para amigos ou para todo mundo.' },
  { view: 'rpg', title: 'Mesa de RPG', body: 'Sessões, fichas de jogo, iniciativa, dados e o Codex: o que os jogadores já descobriram, ao vivo no celular deles.' },
  { target: '[data-tour="nav-oficina"]', title: 'Oficina', body: 'Uma página à parte com dicas de escrita por gênero, livros para estudar, curiosidades e exercícios. Cada exercício vira uma cena para você praticar.' },
  { view: 'inbox', title: 'Ideias', body: `Ideias rápidas esperam aqui até você decidir o que fazer. Anote de qualquer lugar com ${modKey} Shift I.` },
  {
    target: '[data-tour="compartilhar"]',
    title: 'Compartilhar e leitores beta',
    body: 'Convide alguém para ver ou editar junto, ao vivo. Ou crie um link de leitura: quem lê seleciona um trecho e manda um comentário, que aparece na sua margem, na cena certa.',
  },
  QUICK[9],
  { target: '[data-tour="nav-config"]', title: 'Ajustes', body: 'Aparência (tema, cor, fonte de máquina de escrever, som ao digitar), calendário, metas, menu e backup. Tem busca: escreva “tema” ou “backup”.' },
  QUICK[10],
  { title: 'Pronto!', body: 'Agora você conhece tudo. Nada disso é obrigatório: use só o que ajudar a sua história.' },
]

export type TourMode = 'rapido' | 'completo'

const GAP = 12
const CARD_W = 330

function findTarget(step: Step): HTMLElement | null {
  if (!step.target) return null
  const el = document.querySelector<HTMLElement>(step.target)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

export function Tour({ onGo, onClose, hidden = [] }: { onGo: (v: View) => void; onClose: () => void; hidden?: View[] }) {
  const [mode, setMode] = useState<TourMode | null>(null)
  const STEPS = useMemo(() => [INTRO, ...(mode === 'completo' ? DEEP : QUICK).filter((s) => !s.view || !hidden.includes(s.view))], [mode, hidden])
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
  // O "voltar" do aparelho encerra o tour (como "Pular").
  useBackLayer(finish)

  const move = useCallback(
    (d: 1 | -1) => {
      dir.current = d
      setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + d)))
    },
    [STEPS.length],
  )
  const choose = useCallback((m: TourMode) => {
    dir.current = 1
    setMode(m)
    setIndex(1)
  }, [])

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
  }, [index, step, onGo, STEPS.length])

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
        if (index === 0 && !mode) choose('rapido')
        else if (index === STEPS.length - 1) finish()
        else move(1)
      }
      else if (e.key === 'ArrowLeft') move(-1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [index, move, finish, mode, choose, STEPS.length])

  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(CARD_W, vw - 24)
  let pos: { left: number; top: number }
  // Só a área (sem alvo): o balão fica embaixo, para a área aparecer atrás.
  const docked = !rect && Boolean(step.view)
  if (docked) {
    pos = { left: (vw - w) / 2, top: vh - cardH - 16 }
  } else if (!rect) {
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
        <div className={`tour-dim${docked ? ' tour-dim-light' : ''}`} aria-hidden="true" />
      )}
      <div ref={cardRef} className="tour-card" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ left: pos.left, top: pos.top, width: w }}>
        <div className="tour-head">
          <span className="tour-count tabular">{mode ? `${index} de ${STEPS.length - 1}` : 'Tour'}</span>
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
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={finish}>
                Pular o tour
              </button>
              <span className="tour-choices">
                <button type="button" className="btn btn-sm" onClick={() => choose('rapido')}>
                  Rápido
                </button>
                <button ref={nextRef} type="button" className="btn btn-primary btn-sm" onClick={() => choose('completo')}>
                  Completo <ArrowRight size={14} />
                </button>
              </span>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(-1)}>
                <ArrowLeft size={14} /> Voltar
              </button>
              <button ref={nextRef} type="button" className="btn btn-primary btn-sm" onClick={() => (last ? finish() : move(1))}>
                {last ? 'Começar' : 'Próximo'} {!last && <ArrowRight size={14} />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
