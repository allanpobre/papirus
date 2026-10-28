import { Check, Crown, Dices, Eye, Flame, GraduationCap, Heart, Lightbulb, Radio, Shield, Sparkles, Swords, Timer, Trophy, Zap } from 'lucide-react'
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
          <span className="lp-tablet-sub">Mesa de sexta · Tormenta 20</span>
          <span className={`lp-live-pill${revealed ? ' is-on' : ''}`}>
            <Radio size={10} /> Codex ao vivo
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
                = 22 <em>acerta</em>
              </span>
            </div>
            <p className={`lp-roll-dmg${hit ? ' is-on' : ''}`}>
              Dano 1d8+4 → <strong>9</strong>
            </p>
          </div>
          <div className={`lp-secret${revealing ? ' is-pressing' : ''}${revealed ? ' is-done' : ''}`}>
            <p className="lp-mini-h">
              <Eye size={12} /> Segredo da sessão
            </p>
            <p className="lp-secret-text">O símbolo na porta é da Ordem do Corvo.</p>
            <span className="lp-secret-btn">{revealed ? <Check size={12} /> : <Eye size={12} />} {revealed ? 'Revelado ao grupo' : 'Revelar ao grupo'}</span>
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
          <Heart size={13} aria-hidden="true" /> O dano entra na vida do goblin.
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

// ─── Telas do app, em abas que andam sozinhas ─────────────────────────────

const TABS = [
  { id: 'ficha', label: 'Ficha de jogo', icon: Shield },
  { id: 'treino', label: 'Treino', icon: Timer },
  { id: 'placar', label: 'Placar', icon: Trophy },
  { id: 'oficina', label: 'Oficina', icon: GraduationCap },
] as const
type TabId = (typeof TABS)[number]['id']

const SHOW_STEPS = [500, 900, 900, 900, 900, 900, 900, 1400]

const TYPED =
  'A chuva tinha parado, mas a cidade continuava molhada por dentro. Lia atravessou a ponte sem olhar para trás, contando os passos como quem conta dívidas. Do outro lado, alguém já sabia o nome dela.'

/** As telas por dentro: ficha, treino, placar e Oficina, cada uma no clima do seu setor. */
export function ScreensShowcase() {
  const [tab, setTab] = useState<TabId>('ficha')
  const [held, setHeld] = useState(false)
  const { ref, step } = useCycle(SHOW_STEPS, tab)
  const tabsRef = useRef<HTMLDivElement>(null)
  // No celular as abas rolam de lado: a que entrou fica à vista (sem mexer na rolagem da página).
  useEffect(() => {
    const bar = tabsRef.current
    const el = bar?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (bar && el && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: el.offsetLeft - 16, behavior: calm() ? 'auto' : 'smooth' })
  }, [tab])
  // Sem toque da pessoa, as abas trocam sozinhas a cada volta.
  useEffect(() => {
    if (held || calm()) return
    const t = setTimeout(() => setTab((x) => TABS[(TABS.findIndex((y) => y.id === x) + 1) % TABS.length].id), 7600)
    return () => clearTimeout(t)
  }, [tab, held])

  return (
    <div className="lp-show" ref={ref as React.RefObject<HTMLDivElement>}>
      <div ref={tabsRef} className="lp-show-tabs" role="tablist" aria-label="Telas do Papirus">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tela-${id}`}
            aria-selected={tab === id}
            aria-controls="tela-painel"
            className={`lp-show-tab lp-show-tab-${id}`}
            onClick={() => {
              setTab(id)
              setHeld(true)
            }}
          >
            <Icon size={16} aria-hidden="true" /> {label}
            {tab === id && !held && <span className="lp-show-timer" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div id="tela-painel" role="tabpanel" aria-labelledby={`tela-${tab}`} className={`lp-show-stage lp-show-${tab}`}>
        <div key={tab} className="lp-show-screen">
          {tab === 'ficha' && <FichaScreen step={step} />}
          {tab === 'treino' && <TreinoScreen step={step} />}
          {tab === 'placar' && <PlacarScreen step={step} />}
          {tab === 'oficina' && <OficinaScreen step={step} />}
        </div>
        <p className="lp-show-note">{NOTES[tab]}</p>
      </div>
    </div>
  )
}

const NOTES: Record<TabId, string> = {
  ficha: 'A ficha de jogo abre pronta para jogar: PV e PM com um toque, ataques que calculam o dano e o crítico, condições à vista.',
  treino: 'O treino de escrita: um sprint com relógio e um mínimo de palavras ou caracteres. Cada tentativa fica guardada para refazer.',
  placar: 'O placar dos treinos, entre amigos ou de todo mundo: pontos por minutos com o mínimo batido, conferidos no servidor.',
  oficina: 'A Oficina: guias de gêneros, técnicas e para mestres, e um gerador de ideias que vira cena com um toque.',
}

function FichaScreen({ step }: { step: number }) {
  const pv = [31, 31, 24, 24, 19, 19, 24, 24][step] ?? 24
  const pm = step >= 5 ? 2 : 4
  return (
    <div className="lp-scr lp-scr-ficha" aria-hidden="true">
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
          <span className="lp-pool-label">Mana</span>
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
        <span className={`lp-chip${step >= 3 ? ' is-on' : ''}`}>Abalada</span>
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
          <strong>Golpe pessoal</strong> 2 PM · {step >= 5 ? 'usado!' : 'Usar'}
        </span>
      </div>
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
        <Flame size={12} /> 6 dias seguidos
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
  // A sua pontuação sobe com o treino de hoje e passa a da Bia.
  const mine = step >= 4 ? 110 : 80
  const rows = RANK.map((r) => (r.me ? { ...r, pts: mine } : r)).sort((a, b) => b.pts - a.pts)
  return (
    <div className="lp-scr lp-scr-placar" aria-hidden="true">
      <p className="lp-placar-h">
        <Trophy size={14} /> Placar · semana · amigos
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
      <p className={`lp-placar-toast${step >= 4 ? ' is-on' : ''}`}>
        <Sparkles size={12} /> +30 do treino de hoje: você passou para o 1º lugar!
      </p>
    </div>
  )
}

const IDEAS = [
  ['Um padeiro que nunca saiu da cidade', 'Devolver um objeto ao verdadeiro dono', 'Precisa da ajuda do pior inimigo', 'Num trem noturno que não para'],
  ['Uma tradutora de cartas de amor', 'Descobrir quem escreve as cartas anônimas', 'A verdade vai ferir quem mais ama', 'Numa festa de casamento'],
]

function OficinaScreen({ step }: { step: number }) {
  const idea = IDEAS[step >= 4 ? 1 : 0]
  return (
    <div className="lp-scr lp-scr-oficina" aria-hidden="true">
      <p className="lp-of-tip">
        <Lightbulb size={13} /> Dica do dia · Diálogo
      </p>
      <p className="lp-of-tip-text">“Disse” é invisível. Verbos como “redarguiu” tiram o leitor da cena.</p>
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
      <div className="lp-of-guides">
        {['Personagem', 'Mestrar', 'Mistério'].map((g, i) => (
          <span key={g} className={i === 1 ? 'is-mine' : undefined}>
            {i === 1 ? <Crown size={11} /> : null} {g}
          </span>
        ))}
      </div>
    </div>
  )
}
