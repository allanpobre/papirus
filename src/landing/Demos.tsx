import { Check, Dices, Eye, Flame, GraduationCap, Heart, Lightbulb, Lock, PenLine, Radio, Search, Sparkles, Swords, Timer, Trophy, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Quem pede menos movimento vê cada demonstração parada no último passo. */
const calm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Um passo de cada vez, em ciclo: `durations[i]` é quanto o passo i fica na tela.
 * Só anda quando a demonstração está à vista (sem gastar bateria fora da tela).
 */
function useCycle(durations: number[], resetKey = '') {
  const ref = useRef<HTMLElement | null>(null)
  const [step, setStep] = useState(() => (calm() ? durations.length - 1 : 0))
  const [visible, setVisible] = useState(false)
  // Trocou a tela: o ciclo começa de novo.
  const [seenKey, setSeenKey] = useState(resetKey)
  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setStep(calm() ? durations.length - 1 : 0)
  }
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (calm() || !visible) return
    const t = setTimeout(() => setStep((s) => (s + 1) % durations.length), durations[step])
    return () => clearTimeout(t)
  }, [step, visible, durations])
  return { ref, step }
}

// ─── A mesa: o mestre rola, conta e revela; o Codex do jogador recebe ─────

const MESA_STEPS = [1800, 1400, 1700, 1600, 1600, 3400]
const ROLLING = [3, 11, 7, 18, 2, 14, 9]

/**
 * O lado do mestre (tablet) e o do jogador (celular), na mesma cena: a vez da Kaya, o dado
 * físico que ela rola, o goblin que cai, e a revelação que chega ao Codex em segundos.
 */
export function MesaDemo() {
  const { ref, step } = useCycle(MESA_STEPS)
  const rolled = step >= 1
  const hit = step >= 2
  const goblinDown = step >= 3
  const revealing = step === 4
  const revealed = step >= 5

  return (
    <figure ref={ref as React.RefObject<HTMLElement>} className="lp-duo" aria-label="Exemplo: o mestre no tablet e um jogador no celular, na mesma mesa">
      <div className="lp-tablet" aria-hidden="true">
        <div className="lp-tablet-top">
          <span className="lp-tablet-emblem">
            <Dices size={14} />
          </span>
          <span className="lp-tablet-title">Mesa de RPG</span>
          <span className="lp-tablet-sub">Mesa de sexta · Estilo Tormenta 20</span>
          <span className={`lp-live-pill${revealed ? ' is-on' : ''}`}>
            <span className="lp-live-dot" /> Sessão em andamento: A Torre
          </span>
        </div>
        <div className="lp-tablet-body">
          <div className="lp-init">
            <p className="lp-mini-h">
              <Swords size={12} /> Iniciativa · rodada 2
            </p>
            {[
              { name: 'Kaya', pv: 24, max: 31, turn: true },
              { name: 'Goblin', pv: goblinDown ? 0 : 7, max: 7, foe: true },
              { name: 'Taren', pv: 18, max: 22 },
            ].map((c) => (
              <div key={c.name} className={`lp-init-row${c.turn ? ' is-turn' : ''}${c.foe ? ' is-foe' : ''}${c.foe && goblinDown ? ' is-down' : ''}`}>
                <span className="lp-init-name">{c.name}</span>
                <span className="lp-pv">
                  <span style={{ width: `${(c.pv / c.max) * 100}%` }} />
                </span>
                <span className="lp-init-pv">
                  {c.foe && goblinDown ? 'derrotado' : `${c.pv}/${c.max}`}
                </span>
              </div>
            ))}
          </div>
          <div className={`lp-roll${rolled ? ' is-on' : ''}`}>
            <p className="lp-mini-h">Kaya · Espada longa</p>
            <p className="lp-roll-q">Quanto saiu no dado?</p>
            <div className="lp-roll-row">
              {rolled ? <RollingDie key={step === 1 ? 'rolando' : 'parado'} rolling={step === 1} final={15} /> : <span className="lp-d20">?</span>}
              <span className="lp-roll-math">
                1d20 <strong>+7</strong>
              </span>
              <span className={`lp-roll-total${hit ? ' is-on' : ''}`}>
                Total 22
              </span>
            </div>
            <p className={`lp-roll-dmg${hit ? ' is-on' : ''}`}>
              Dano 1d8+4 → <strong>9</strong>
            </p>
          </div>
          <div className={`lp-secret${revealing ? ' is-pressing' : ''}${revealed ? ' is-done' : ''}`}>
            <p className="lp-mini-h">
              <Eye size={12} /> Revelar fato
            </p>
            <p className="lp-secret-text">O símbolo na porta é da Ordem do Corvo.</p>
            <span className="lp-secret-btn">{revealed ? <Check size={12} /> : <Eye size={12} />} {revealed ? 'Revelado' : 'Revelar'}</span>
          </div>
        </div>
      </div>

      <div className="lp-phone lp-phone-codex" aria-hidden="true">
        <div className="lp-phone-screen">
          <div className="lp-phone-top">
            <span>A Queda de Valkaria</span>
            <span className="lp-live">
              <Radio size={11} /> ao vivo
            </span>
          </div>
          {revealed && <p className="lp-phone-toast">Novidades do mestre</p>}
          <p className="lp-phone-title">Codex</p>
          <p className="lp-phone-sub">Mesa de sexta</p>
          <p className="lp-phone-kind">Grupo</p>
          <div className="lp-phone-pc">
            <strong>Kaya</strong>
            <span className="lp-pv">
              <span style={{ width: `${(24 / 31) * 100}%` }} />
            </span>
            <span className="lp-phone-pv">PV 24/31</span>
          </div>
          <p className="lp-phone-kind">O que sabemos</p>
          {revealed && (
            <p className="lp-phone-entry lp-phone-new-entry">
              <span className="lp-new">novo</span> O símbolo na porta é da Ordem do Corvo.
            </p>
          )}
          <p className="lp-phone-entry">
            Vaelor tem olhos cinzentos <em>(segundo Mira)</em>
          </p>
          <p className="lp-phone-kind">Linha do tempo</p>
          <p className="lp-phone-entry">
            <strong>341 DC</strong> A Queda
          </p>
        </div>
      </div>
      <figcaption className="lp-duo-caption">
        <span className={step <= 2 ? 'is-on' : ''}>
          <Dices size={13} aria-hidden="true" /> A jogadora rola o dado de verdade; o app soma o bônus.
        </span>
        <span className={step === 3 ? 'is-on' : ''}>
          <Heart size={13} aria-hidden="true" /> O mestre desconta o dano na iniciativa.
        </span>
        <span className={step >= 4 ? 'is-on' : ''}>
          <Radio size={13} aria-hidden="true" /> O mestre revela, e o celular de cada um recebe.
        </span>
      </figcaption>
    </figure>
  )
}

/** O d20 da jogadora: gira alguns números e para no que saiu. */
function RollingDie({ rolling, final }: { rolling: boolean; final: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!rolling || calm()) return
    const t = setInterval(() => setI((n) => n + 1), 110)
    return () => clearInterval(t)
  }, [rolling])
  const spinning = rolling && i < 8
  return <span className={`lp-d20${spinning ? ' is-rolling' : ''}`}>{spinning ? ROLLING[i % ROLLING.length] : final}</span>
}

// ─── Por dentro: as telas de cada setor ───────────────────────────────────

type SectorId = 'escrita' | 'mesa' | 'oficina'

interface Screen {
  id: string
  label: string
  note: string
  render: (step: number) => React.ReactNode
}

const SECTORS: { id: SectorId; name: string; icon: typeof Dices; lede: string; screens: Screen[] }[] = [
  {
    id: 'escrita',
    name: 'Escrita',
    icon: PenLine,
    lede: 'Onde o livro e o mundo nascem.',
    screens: [
      { id: 'editor', label: 'Editor', note: 'Você escreve; os nomes que o mundo já conhece ficam sublinhados. Selecione um trecho para vincular, guardar como fato, criar ficha, comentar ou guardar em Ideias.', render: (s) => <EditorScreen step={s} /> },
      { id: 'ficha-mundo', label: 'Ficha do mundo', note: 'Cada ficha se lê como uma enciclopédia: retrato, quadro de resumo, segredos que só você vê e as cenas em que aparece.', render: (s) => <WorldSheetScreen step={s} /> },
      { id: 'treino', label: 'Treino', note: 'O treino de escrita: um sprint com relógio e um mínimo de palavras ou caracteres. Cada tentativa fica guardada para refazer.', render: (s) => <TreinoScreen step={s} /> },
      { id: 'placar', label: 'Placar', note: 'O placar dos treinos, entre amigos ou de todo mundo: pontos por minutos com o mínimo batido, até 60 por dia.', render: (s) => <PlacarScreen step={s} /> },
    ],
  },
  {
    id: 'mesa',
    name: 'Mesa de RPG',
    icon: Dices,
    lede: 'Outro setor, outro clima: o lado do mestre.',
    screens: [
      { id: 'painel', label: 'Painel do mestre', note: 'A próxima sessão com a preparação, o grupo com a vida de cada um e o que ainda não foi revelado.', render: (s) => <PainelScreen step={s} /> },
      { id: 'ficha-jogo', label: 'Ficha de jogo', note: 'A ficha abre pronta para jogar: PV e PM com um toque, ataques com dano e crítico, poderes que gastam PM, condições à vista.', render: (s) => <FichaScreen step={s} /> },
      { id: 'registro', label: 'Registro', note: 'Durante a sessão, cada rolagem (do dado de verdade ou do app) entra no registro com a hora.', render: (s) => <RegistroScreen step={s} /> },
    ],
  },
  {
    id: 'oficina',
    name: 'Oficina',
    icon: GraduationCap,
    lede: 'Para aprender um pouco por dia, escrevendo ou mestrando.',
    screens: [
      { id: 'guia', label: 'Guia', note: 'Cada guia traz o que o leitor espera, o que funciona, armadilhas, livros para estudar e curiosidades para virar.', render: (s) => <GuiaScreen step={s} /> },
      { id: 'ideias', label: 'Gerador de ideias', note: 'Sem ideia? Sorteie quem, o que quer, o que atrapalha e onde. Para a mesa, sorteie um gancho de aventura.', render: (s) => <IdeiasScreen step={s} /> },
      { id: 'exercicios', label: 'Exercícios', note: 'Exercícios que viram cena com um toque, marcados como feitos. A capa mostra o seu caminho.', render: (s) => <ExerciciosScreen step={s} /> },
    ],
  },
]

const ALL = SECTORS.flatMap((sec) => sec.screens.map((sc) => ({ sector: sec.id, screen: sc.id })))
const SHOW_STEPS = [500, 900, 900, 900, 900, 900, 900, 1400]
const TURN = 7600

/** As telas de cada setor, separadas: escolha o setor e a tela; sem toque, elas passam sozinhas. */
export function ScreensShowcase() {
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  const { sector, screen } = ALL[at]
  const sec = SECTORS.find((x) => x.id === sector)!
  const scr = sec.screens.find((x) => x.id === screen)!
  const { ref, step } = useCycle(SHOW_STEPS, screen)
  const tabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (held || calm()) return
    const t = setTimeout(() => setAt((i) => (i + 1) % ALL.length), TURN)
    return () => clearTimeout(t)
  }, [at, held])
  // No celular as abas rolam de lado: a que entrou fica à vista (sem mexer na rolagem da página).
  useEffect(() => {
    const bar = tabsRef.current
    const el = bar?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (bar && el && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: el.offsetLeft - 16, behavior: calm() ? 'auto' : 'smooth' })
  }, [at])
  const go = (s: SectorId, sc?: string) => {
    setHeld(true)
    setAt(ALL.findIndex((x) => x.sector === s && (!sc || x.screen === sc)))
  }

  return (
    <div className={`lp-show lp-show-${sector}`} ref={ref as React.RefObject<HTMLDivElement>}>
      <div className="lp-show-sectors" role="group" aria-label="Setor">
        {SECTORS.map(({ id, name, icon: Icon }) => (
          <button key={id} type="button" className={`lp-show-sector lp-show-sector-${id}`} aria-pressed={sector === id} onClick={() => go(id)}>
            <Icon size={17} aria-hidden="true" /> {name}
          </button>
        ))}
      </div>
      <div className="lp-show-stage">
        <div className="lp-show-side">
          <p className="lp-show-kicker">
            <sec.icon size={14} aria-hidden="true" /> {sec.name}
          </p>
          <p className="lp-show-lede">{sec.lede}</p>
          <div ref={tabsRef} className="lp-show-tabs" role="tablist" aria-label={`Telas: ${sec.name}`}>
            {sec.screens.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={`tela-${x.id}`}
                aria-selected={screen === x.id}
                aria-controls="tela-painel"
                className="lp-show-tab"
                onClick={() => go(sector, x.id)}
              >
                {x.label}
                {screen === x.id && !held && <span className="lp-show-timer" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p key={scr.id} className="lp-show-note">
            {scr.note}
          </p>
        </div>
        <div id="tela-painel" role="tabpanel" aria-labelledby={`tela-${scr.id}`} className="lp-show-device">
          <div key={scr.id} className="lp-show-screen">
            {scr.render(step)}
          </div>
        </div>
      </div>
    </div>
  )
}

const TYPED =
  'A chuva tinha parado, mas a cidade continuava molhada por dentro. Lia atravessou a ponte sem olhar para trás, contando os passos como quem conta dívidas. Do outro lado, alguém já sabia o nome dela.'

// Escrita

function EditorScreen({ step }: { step: number }) {
  return (
    <div className="lp-scr lp-scr-editor" aria-hidden="true">
      <p className="lp-ed-scene">A chegada · 12 de Neblina de 359 DC</p>
      <p className="lp-ed-text">
        Era noite em <span className="lp-ed-name">Ostria</span> quando o homem pálido desceu do navio. <span className="lp-ed-name">Kael</span> o viu primeiro.
      </p>
      <p className="lp-ed-text">
        Na taverna, <span className={`lp-ed-name${step >= 1 ? '' : ' is-new'}`}>Mira</span> jurou que ele tinha{' '}
        <mark className={`lp-ed-sel${step >= 3 ? ' is-on' : ''}`}>olhos cinzentos</mark>.
      </p>
      <div className={`lp-ed-pop${step >= 4 && step <= 5 ? ' is-on' : ''}`}>
        <span>Vincular</span>
        <span className="is-hot">Fato</span>
        <span>Ficha</span>
        <span>Comentar</span>
        <span>Guardar</span>
      </div>
      <div className={`lp-ed-card${step >= 6 ? ' is-on' : ''}`}>
        <strong>Fato guardado</strong>
        <span>Vaelor tem olhos cinzentos, segundo Mira</span>
      </div>
      <div className="lp-ed-margin">
        <span className="lp-ed-dot" /> Na cena: Kael, Mira · Ostria
      </div>
    </div>
  )
}

function WorldSheetScreen({ step }: { step: number }) {
  return (
    <div className="lp-scr lp-scr-mundo" aria-hidden="true">
      <p className="lp-mundo-kind">
        <span className="lp-mundo-dot" /> Personagem
      </p>
      <p className="lp-mundo-name">Ilsa</p>
      <p className="lp-mundo-lede">Guardiã da Torre de Marfim. Morreu na Queda.</p>
      <div className="lp-mundo-box">
        <span className="lp-mundo-portrait">I</span>
        <dl>
          <div>
            <dt>Fica em</dt>
            <dd className="lp-link">Torre de Marfim</dd>
          </div>
          <div>
            <dt>Nascimento</dt>
            <dd>312 DC</dd>
          </div>
          <div>
            <dt>Morte</dt>
            <dd>341 DC</dd>
          </div>
        </dl>
      </div>
      <p className="lp-mundo-text">
        Treinou <span className="lp-link">Mira</span> em segredo.{' '}
        <mark className={`lp-mundo-secret${step >= 3 ? ' is-on' : ''}`}>
          <Lock size={10} /> Sabia quem era o homem pálido.
        </mark>
      </p>
      <p className="lp-mundo-appears">Aparece em 4 cenas · 2 relações</p>
    </div>
  )
}

function TreinoScreen({ step }: { step: number }) {
  const chars = Math.round((TYPED.length * Math.min(step, 6)) / 6)
  const text = TYPED.slice(0, chars)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const goal = 30
  const met = words >= goal
  const secs = 15 * 60 - step * 37
  return (
    <div className="lp-scr lp-scr-treino" aria-hidden="true">
      <div className="lp-treino-top">
        <span className="lp-treino-clock">
          <Timer size={13} /> {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </span>
        <span className="lp-treino-bar">
          <span style={{ width: `${(step / 8) * 100}%` }} />
        </span>
        <span className="lp-treino-end">Terminar</span>
      </div>
      <p className="lp-treino-prompt">Escreva uma despedida em que ninguém diz “adeus”.</p>
      <p className="lp-treino-text">
        {text}
        <span className="lp-caret" />
      </p>
      <div className="lp-treino-count">
        <span className={`lp-treino-progress${met ? ' is-met' : ''}`}>
          <span style={{ width: `${Math.min(100, (words / goal) * 100)}%` }} />
        </span>
        <span>
          {met && <Check size={12} />} <strong>{words}</strong> de {goal} palavras{met ? ' · mínimo batido!' : ''}
        </span>
      </div>
      <p className="lp-treino-streak">
        <Flame size={12} /> 6 dias
      </p>
    </div>
  )
}

const RANK = [
  { name: 'Bia', pts: 95 },
  { name: 'Você', pts: 80, me: true },
  { name: 'Caio', pts: 65 },
  { name: 'Lu', pts: 40 },
]

function PlacarScreen({ step }: { step: number }) {
  // O treino de hoje entra e a sua linha sobe.
  const mine = step >= 4 ? 110 : 80
  const rows = RANK.map((r) => (r.me ? { ...r, pts: mine } : r)).sort((a, b) => b.pts - a.pts)
  return (
    <div className="lp-scr lp-scr-placar" aria-hidden="true">
      <p className="lp-placar-h">
        <Trophy size={14} /> Placar dos treinos
      </p>
      <p className="lp-placar-switch">
        <span className="is-on">Amigos</span>
        <span>Todo mundo</span>
        <span className="is-on">Semana</span>
        <span>Mês</span>
      </p>
      <ol className="lp-placar">
        {rows.map((r, i) => (
          <li key={r.name} className={r.me ? 'is-me' : undefined} style={{ '--i': i } as React.CSSProperties}>
            <span className="lp-placar-pos">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`}</span>
            <span className="lp-placar-av">{r.name.charAt(0)}</span>
            <span className="lp-placar-name">{r.name}</span>
            <span className="lp-placar-pts">
              <strong>{r.pts}</strong> pts
            </span>
          </li>
        ))}
      </ol>
      <p className="lp-placar-how">Pontos são os minutos de treino com o mínimo batido, até 60 por dia.</p>
    </div>
  )
}

// Mesa

function PainelScreen({ step }: { step: number }) {
  const live = step >= 3
  return (
    <div className="lp-scr lp-scr-mesa lp-scr-painel" aria-hidden="true">
      <p className="lp-painel-title">Painel do mestre</p>
      <div className="lp-painel-card">
        <p className="lp-painel-h">Próxima sessão</p>
        <p className="lp-painel-session">Sessão 3 — A Torre</p>
        <p className="lp-painel-meta">{live ? 'Em andamento' : 'Planejada · 31/10'}</p>
        <p className="lp-painel-prep">Luz na janela da Torre de Marfim. Ilsa pode aparecer se forem até lá.</p>
        <span className={`lp-painel-btn${live ? ' is-live' : ''}`}>{live ? 'Sessão em andamento' : 'Abrir sessão'}</span>
      </div>
      <div className="lp-painel-card">
        <p className="lp-painel-h">Grupo (3)</p>
        {[
          ['Kaya', 'Ana', 24, 31],
          ['Taren', 'Bruno', 18, 22],
          ['Ilmar', 'Carla', step >= 5 ? 9 : 17, 17],
        ].map(([n, p, pv, max]) => (
          <div key={n as string} className="lp-painel-pc">
            <span>
              <strong>{n}</strong> <em>{p}</em>
            </span>
            <span className="lp-pv">
              <span style={{ width: `${((pv as number) / (max as number)) * 100}%` }} />
            </span>
            <span className="lp-painel-pv">
              PV {pv}/{max}
            </span>
          </div>
        ))}
      </div>
      <div className="lp-painel-card lp-painel-secrets">
        <p className="lp-painel-h">
          <Eye size={11} /> Segredos ainda guardados
        </p>
        <p>Fato: Vaelor sobreviveu à Queda</p>
        <p>Fato: Mira é herdeira de Casa de Vaelor</p>
      </div>
    </div>
  )
}

function FichaScreen({ step }: { step: number }) {
  const pv = [31, 31, 24, 24, 19, 19, 24, 24][step] ?? 24
  const pm = step >= 5 ? 2 : 4
  return (
    <div className="lp-scr lp-scr-mesa lp-scr-ficha" aria-hidden="true">
      <div className="lp-ficha-hero">
        <span className="lp-ficha-portrait">K</span>
        <span>
          <strong>Kaya</strong>
          <span>Humana · Guerreira 3</span>
        </span>
      </div>
      <div className="lp-ficha-pools">
        <div className={`lp-pool${pv < 20 ? ' is-low' : ''}`}>
          <span className="lp-pool-label">Pontos de vida</span>
          <span className="lp-pool-n">
            <strong>{pv}</strong>/31
          </span>
          <span className="lp-pool-bar">
            <span style={{ width: `${(pv / 31) * 100}%` }} />
          </span>
        </div>
        <div className="lp-pool lp-pool-pm">
          <span className="lp-pool-label">Pontos de mana</span>
          <span className="lp-pool-n">
            <strong>{pm}</strong>/6
          </span>
          <span className="lp-pool-bar">
            <span style={{ width: `${(pm / 6) * 100}%` }} />
          </span>
        </div>
        <div className="lp-pool lp-pool-fixed">
          <span className="lp-pool-label">Defesa</span>
          <span className="lp-pool-n">
            <strong>18</strong>
          </span>
        </div>
      </div>
      <div className="lp-ficha-chips">
        <span className={`lp-chip${step >= 3 ? ' is-on' : ''}`}>Abalado</span>
        <span className="lp-chip lp-chip-add">+ Condição</span>
      </div>
      <div className={`lp-ficha-attack${step >= 1 && step <= 3 ? ' is-rolling' : ''}`}>
        <Swords size={14} />
        <span>
          <strong>Espada longa</strong> +7 · 1d8+4 · 19/x2
        </span>
      </div>
      <div className={`lp-ficha-attack${step >= 5 ? ' is-rolling' : ''}`}>
        <Zap size={14} />
        <span>
          <strong>Golpe pessoal</strong> 2 PM · {step >= 5 ? 'usado' : 'Usar'}
        </span>
      </div>
    </div>
  )
}

const LOG = [
  ['21:02', 'Rodada 1'],
  ['21:03', 'Kaya — Iniciativa: 17 · 1d20+3 [14] · dado físico'],
  ['21:05', 'Kaya — Espada longa: 22 · 1d20+7 [15] · dado físico'],
  ['21:05', 'Kaya — Espada longa (dano): 9 · 1d8+4 [5]'],
  ['21:07', 'Taren — Misticismo: 19 · 1d20+6 [13]'],
  ['21:09', 'O grupo encontrou o símbolo da Ordem do Corvo.'],
]

function RegistroScreen({ step }: { step: number }) {
  const shown = LOG.slice(0, Math.min(LOG.length, step + 1))
  return (
    <div className="lp-scr lp-scr-mesa lp-scr-registro" aria-hidden="true">
      <p className="lp-painel-title">Sessão 3 — A Torre</p>
      <p className="lp-reg-live">
        <span className="lp-live-dot" /> Em andamento
      </p>
      <ul className="lp-reg">
        {shown.map(([at, text], i) => (
          <li key={i} className={text.includes('—') ? 'is-roll' : undefined}>
            <span className="lp-reg-at">{at}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Oficina

function GuiaScreen({ step }: { step: number }) {
  return (
    <div className="lp-scr lp-scr-oficina" aria-hidden="true">
      <div className="lp-guia-hero">
        <span className="lp-guia-icon">
          <Search size={18} />
        </span>
        <span>
          <strong>Mistério</strong>
          <span>Um enigma, pistas e uma resposta que surpreende.</span>
        </span>
      </div>
      <p className="lp-guia-expect">
        <span>O que o leitor espera</span>Jogo limpo: o leitor quer ter tido a chance de adivinhar.
      </p>
      <ol className="lp-guia-works">
        {['Comece pelo fim', 'Pista à vista de todos', 'Suspeitos com segredos'].map((t, i) => (
          <li key={t} className={step >= i + 1 ? 'is-on' : undefined}>
            <span>{i + 1}</span> {t}
          </li>
        ))}
      </ol>
      <div className={`lp-guia-fact${step >= 5 ? ' is-flipped' : ''}`}>
        <span className="lp-guia-front">
          <Sparkles size={14} /> Você sabia?
        </span>
        <span className="lp-guia-back">“Os Assassinatos da Rua Morgue” (1841), de Poe, é considerado o primeiro conto policial moderno.</span>
      </div>
    </div>
  )
}

const IDEAS = [
  ['Um padeiro que nunca saiu da cidade', 'Devolver um objeto ao verdadeiro dono', 'Precisa da ajuda do pior inimigo', 'Num trem noturno que não para'],
  ['Uma tradutora de cartas de amor', 'Descobrir quem escreve as cartas anônimas', 'A verdade vai ferir quem mais ama', 'Numa festa de casamento'],
]

function IdeiasScreen({ step }: { step: number }) {
  const idea = IDEAS[step >= 4 ? 1 : 0]
  return (
    <div className="lp-scr lp-scr-oficina" aria-hidden="true">
      <p className="lp-of-tip">
        <Lightbulb size={13} /> Dica do dia · Fundamentos
      </p>
      <p className="lp-of-tip-text">Uma boa fala revela quem fala e move a história.</p>
      <p className="lp-of-h">
        <Sparkles size={13} /> Gerador de ideias
      </p>
      <dl key={step >= 4 ? 'b' : 'a'} className="lp-of-idea">
        {['Quem', 'Quer', 'Mas', 'Onde'].map((label, i) => (
          <div key={label} style={{ '--i': i } as React.CSSProperties}>
            <dt>{label}</dt>
            <dd>{idea[i]}</dd>
          </div>
        ))}
      </dl>
      <span className={`lp-of-btn${step === 3 ? ' is-press' : ''}`}>
        <Dices size={13} /> Outra ideia
      </span>
    </div>
  )
}

function ExerciciosScreen({ step }: { step: number }) {
  const done = step >= 3
  return (
    <div className="lp-scr lp-scr-oficina" aria-hidden="true">
      <p className={`lp-of-progress${done ? ' is-on' : ''}`}>
        <Check size={12} /> 3 de 14 guias abertos · {done ? 2 : 1} {done ? 'exercícios feitos' : 'exercício feito'}
      </p>
      <p className="lp-of-h">
        <Lightbulb size={13} /> Experimente
      </p>
      {[
        ['Três pistas', 'Escreva uma cena num lugar comum com três detalhes: um que é pista de verdade, um que parece e não é, e um que só faz sentido no fim.', done],
        ['O álibi', 'Um suspeito conta onde estava na hora do crime, com uma pequena contradição.', true],
      ].map(([t, p, d]) => (
        <div key={t as string} className={`lp-of-ex${d ? ' is-done' : ''}`}>
          <strong>{t}</strong>
          <span>{p}</span>
          <span className="lp-of-ex-actions">
            <span className="lp-of-ex-write">Escrever este exercício</span>
            <span className={`lp-of-ex-done${d ? ' is-on' : ''}`}>
              <Check size={11} /> {d ? 'Feito' : 'Marcar como feito'}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
