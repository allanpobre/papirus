import { Check, Dices, Eye, Flame, GraduationCap, Heart, Lightbulb, Lock, Map as MapIcon, NotebookPen, PenLine, Radio, Search, SearchCheck, Sparkles, Swords, Timer, Trophy, Zap } from 'lucide-react'
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

// ─── A mesa: o mestre no tablet, e dois jogadores no celular ──────────────

const MESA_STEPS = [2000, 1700, 1500, 1400, 1500, 1700, 1900, 1300, 3600]
const ROLLING = [3, 11, 7, 18, 2, 14, 9]

/**
 * A mesa inteira numa cena: o mestre com o escudo no tablet (Roteiro e Palco) e dois jogadores,
 * cada um com o cartão no celular (um no escuro, outro no claro, no mesmo tema da mesa). É a vez
 * da Kaya: o celular dela mostra no meio da tela; ela rola com o dado de verdade; o mestre confere
 * a Defesa e tira o dano do goblin; ela toca em "Terminei" e a vez vai ao Taren; o mestre revela
 * um segredo do roteiro e ele chega aos dois. Os passos:
 * 0 sua vez, Kaya · 1 dado · 2 a rolagem chega · 3 "acerta" volta · 4 dano · 5 goblin cai
 * 6 vez do Taren · 7 o mestre revela · 8 a revelação chega
 */
export function MesaDemo() {
  const { ref, step } = useCycle(MESA_STEPS)
  const arrived = step >= 2
  const damage = step >= 4
  const goblinDown = step >= 5
  const tarenTurn = step >= 6
  const revealing = step === 7
  const revealed = step >= 8
  const order = [
    { name: 'Kaya', current: !tarenTurn, acted: tarenTurn },
    { name: 'Taren', current: tarenTurn },
    { name: 'Goblin', down: goblinDown, foe: true },
  ]

  return (
    <figure ref={ref as React.RefObject<HTMLElement>} className="lp-trio" aria-label="Exemplo: o mestre com o escudo no tablet e dois jogadores com o cartão no celular, na mesma mesa">
      <div className="lp-device lp-device-taren" aria-hidden="true">
        <p className="lp-device-tag">Taren · celular no claro</p>
        <CodexPhone me="Taren" mode="claro" step={step} order={order} />
      </div>

      <div className="lp-device lp-device-mestre" aria-hidden="true">
        <p className="lp-device-tag">Mestre · o escudo no tablet</p>
        <div className="lp-tablet">
          <div className="lp-tablet-top">
            <span className="lp-tablet-emblem">
              <Dices size={14} />
            </span>
            <span className="lp-tablet-title">A Torre</span>
            <span className="lp-tablet-sub">Mesa de sexta · Sessão 2</span>
            <span className="lp-live-pill is-on">
              <span className="lp-live-dot" /> 1:24
            </span>
          </div>
          <div className="lp-tablet-body">
            <div className="lp-init lp-roteiro">
              <p className="lp-mini-h">
                <NotebookPen size={12} /> Roteiro · só você vê
              </p>
              <p className="lp-shield-label">Cenas</p>
              <p className="lp-beat is-done">
                <i /> A chave na taverna
              </p>
              <p className="lp-beat is-now">
                <i /> Subir pelas falésias <b>agora</b>
              </p>
              <p className="lp-beat">
                <i /> A biblioteca selada
              </p>
              <p className="lp-shield-label">Segredos e pistas</p>
              <div className={`lp-secret-row${revealing ? ' is-pressing' : ''}${revealed ? ' is-done' : ''}`}>
                <span>O símbolo na porta é da Ordem do Corvo.</span>
                <span className="lp-secret-btn">
                  {revealed ? <Check size={12} /> : <Eye size={12} />} {revealed ? 'Revelado' : 'Revelar'}
                </span>
              </div>
            </div>
            <div className="lp-init lp-palco">
              <p className="lp-mini-h">
                <Swords size={12} /> Palco · rodada 2
              </p>
              <div className="lp-queue">
                {order.map((c) => (
                  <span key={c.name} className={`lp-qface${c.current ? ' is-now' : ''}${c.foe ? ' is-foe' : ''}${c.down || c.acted ? ' is-done' : ''}`}>
                    <b>{c.name[0]}</b>
                    <small>{c.name}</small>
                  </span>
                ))}
              </div>
              <span className={`lp-next${step === 6 ? ' is-pressing' : ''}`}>{tarenTurn ? 'Vez do Taren' : 'Vez da Kaya'} ›</span>
            </div>
            <div className={`lp-tray lp-rolls${arrived ? ' is-on' : ''}`}>
              <p className="lp-mini-h">
                <Dices size={12} /> Últimas rolagens
              </p>
              {damage && (
                <div className="lp-tray-roll is-latest">
                  <span className="lp-tray-total">9</span>
                  <span>
                    <strong>Kaya · dano em Goblin</strong>
                    <small>1d8+4 [5] · pelo celular</small>
                    {goblinDown ? <em className="lp-tray-done">Goblin derrotado</em> : <span className="lp-tray-act is-pressing">Tirar 9 PV de Goblin</span>}
                  </span>
                </div>
              )}
              {arrived ? (
                <div className={`lp-tray-roll${damage ? '' : ' is-latest'}`}>
                  <span className="lp-tray-total">22</span>
                  <span>
                    <strong>Kaya · Espada longa contra Goblin</strong>
                    <small>
                      <b>Acerta</b> · Defesa 14 · 1d20+7 [15]
                    </small>
                  </span>
                </div>
              ) : (
                <p className="lp-tray-wait">Esperando a vez da Kaya…</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="lp-device lp-device-kaya" aria-hidden="true">
        <p className="lp-device-tag">Kaya · celular no escuro</p>
        <CodexPhone me="Kaya" mode="escuro" step={step} order={order} />
      </div>

      <figcaption className="lp-duo-caption">
        <span className={step <= 3 ? 'is-on' : ''}>
          <Dices size={13} aria-hidden="true" /> A vez da Kaya chega no meio da tela do celular. Ela rola o dado de verdade; o mestre confere a Defesa: acerta.
        </span>
        <span className={step === 4 || step === 5 ? 'is-on' : ''}>
          <Heart size={13} aria-hidden="true" /> O dano chega ao mestre, que tira da vida do goblin.
        </span>
        <span className={step >= 6 ? 'is-on' : ''}>
          <Radio size={13} aria-hidden="true" /> Ela toca em "Terminei" e a vez vai ao Taren. O segredo que o mestre revela chega aos dois.
        </span>
      </figcaption>
    </figure>
  )
}

type DemoOrder = { name: string; current?: boolean; down?: boolean; acted?: boolean; foe?: boolean }[]

/** O cartão no celular de um jogador, no tema Tempestade da mesa (claro ou escuro, como cada um escolheu). */
function CodexPhone({ me, mode, step, order }: { me: 'Kaya' | 'Taren'; mode: 'claro' | 'escuro'; step: number; order: DemoOrder }) {
  const kaya = me === 'Kaya'
  const myTurn = kaya ? step < 6 : step >= 6
  // A vez chega no meio da tela; depois de tocar, o cartão volta.
  const turnNow = kaya ? step === 0 : step === 6
  const asking = kaya && step === 1
  const rolls = [
    ...(step >= 4 ? [{ total: 9, label: 'dano em Goblin', verdict: null as string | null }] : []),
    ...(step >= 2 ? [{ total: 22, label: 'Espada longa contra Goblin', verdict: step >= 3 ? 'Acerta' : null }] : []),
  ]
  const pc = kaya ? { pv: 24, max: 31 } : { pv: 18, max: 22 }
  return (
    <div className={`lp-phone lp-codex lp-codex-${mode}`}>
      <div className="lp-phone-screen">
        <div className="lp-phone-top">
          <span>Mesa de sexta</span>
          <span className="lp-live">
            <Radio size={10} /> ao vivo
          </span>
        </div>
        {step >= 8 && (
          <p className="lp-phone-toast">
            <Eye size={10} /> O mestre revelou: a Ordem do Corvo
          </p>
        )}
        <div className="lp-stage">
          <small>Cena</small>
          <strong>Subir pelas falésias</strong>
          <em>Vento forte, pedra molhada.</em>
        </div>
        <p className="lp-phone-kind">
          <Swords size={10} /> Combate · rodada 2
        </p>
        <div className="lp-queue is-phone">
          {order.map((e) => (
            <span key={e.name} className={`lp-qface${e.current ? ' is-now' : ''}${e.foe ? ' is-foe' : ''}${e.down || e.acted ? ' is-done' : ''}${e.name === me ? ' is-me' : ''}`}>
              <b>{e.name[0]}</b>
              <small>{e.name === me ? 'Você' : e.name}</small>
            </span>
          ))}
        </div>
        <div className="lp-phone-pc">
          <strong>{me}</strong>
          <span className="lp-pv">
            <span style={{ width: `${(pc.pv / pc.max) * 100}%` }} />
          </span>
          <span className="lp-phone-pv">
            PV {pc.pv}/{pc.max}
          </span>
        </div>

        <div className="lp-dock">
          {myTurn && !turnNow && (
            <p className="lp-dock-turn" key={me + step}>
              <Swords size={11} /> Sua vez, {me}!
            </p>
          )}
          {rolls.slice(0, 2).map((r, i) => (
            <p key={r.total} className={`lp-dock-roll${i === 0 ? ' is-latest' : ''}`}>
              <span className="lp-dock-total">{r.total}</span>
              <span>
                <strong>
                  {kaya ? 'Você' : 'Kaya'} · {r.label}
                </strong>
                {r.verdict && (
                  <small>
                    {r.verdict} <Check size={10} />
                  </small>
                )}
              </span>
            </p>
          ))}
          <span className="lp-dock-actions">
            {kaya && (step === 2 || step === 3) && <span className={`lp-dock-btn is-ghost${step === 3 ? ' is-pressing' : ''}`}>Rolar dano</span>}
            {kaya && step === 5 && <span className="lp-dock-btn is-ghost is-pressing">Terminei</span>}
            <span className="lp-dock-btn">
              <Dices size={12} /> Rolar como {me}
            </span>
          </span>
          <span className="lp-tabs">
            <span>Eu</span>
            <span className="is-on">Mesa</span>
            <span>Codex</span>
          </span>
        </div>

        {turnNow && (
          <div className="lp-turn-now">
            <small>Rodada 2</small>
            <strong>Sua vez, {me}!</strong>
            <span className="lp-dock-btn is-pressing">
              <Swords size={12} /> {kaya ? 'Espada longa +7' : 'Machado +6'}
            </span>
            <span className="lp-turn-done">Terminei</span>
          </div>
        )}

        {asking && (
          <div className="lp-phone-sheet">
            <p className="lp-roll-q">Quanto saiu no dado?</p>
            <p className="lp-sheet-what">Kaya · Espada longa · 1d20+7</p>
            <div className="lp-roll-row">
              <RollingDie rolling final={15} />
              <span className="lp-sheet-total">Total 22</span>
            </div>
          </div>
        )}
      </div>
    </div>
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
      {
        id: 'mapa',
        label: 'Mapa',
        note: 'A história vista de cima: cada cena do tamanho que tem, na cor de como termina, com os atos do modelo e as pistas como linhas. As perguntas vêm só do que você marcou.',
        render: (s) => <MapaScreen step={s} />,
      },
      {
        id: 'editor',
        label: 'Página e Revisão',
        note: 'Na Página, só o texto. Na Revisão, os nomes que o mundo já conhece ficam sublinhados, e um trecho selecionado vira fato, ficha, comentário ou ideia.',
        render: (s) => <EditorScreen step={s} />,
      },
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
      { id: 'escudo', label: 'Escudo do mestre', note: 'O roteiro da sessão para riscar (início forte, cenas, segredos) e o palco: a cena atual e os relógios, que os jogadores veem no celular.', render: (s) => <EscudoScreen step={s} /> },
      { id: 'combate', label: 'Combate', note: 'A fila de turnos com a vida de cada um, e três jeitos de iniciativa: clássica, por lados ou pipoca (quem agiu escolhe o próximo).', render: (s) => <CombateScreen step={s} /> },
      { id: 'ficha-jogo', label: 'Ficha de jogo', note: 'A ficha abre pronta para jogar: PV e PM com um toque, ataques com dano e crítico, poderes que gastam PM, condições à vista.', render: (s) => <FichaScreen step={s} /> },
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

const MAP_SCENES: [number, 'pior' | 'melhor' | 'igual'][] = [
  [3, 'pior'],
  [2, 'pior'],
  [1, 'igual'],
  [4, 'melhor'],
  [3.5, 'pior'],
  [3, 'melhor'],
  [3, 'pior'],
  [2.5, 'melhor'],
]

function MapaScreen({ step }: { step: number }) {
  const total = MAP_SCENES.reduce((a, [w]) => a + w, 0)
  return (
    <div className="lp-scr lp-scr-mapa" aria-hidden="true">
      <p className="lp-ed-scene">Livro I · Três atos</p>
      <div className="lp-map-acts">
        <span>Ato I</span>
        <span>Ato II</span>
        <span>Ato III</span>
      </div>
      <div className="lp-map-strip">
        {MAP_SCENES.map(([w, shift], i) => (
          <i key={i} className={step >= 1 + Math.floor(i / 3) ? `is-${shift}` : undefined} style={{ width: `${(w / total) * 100}%` }} />
        ))}
      </div>
      <p className="lp-map-beats">
        <span>Gancho</span>
        <span>Virada</span>
        <span>Meio</span>
        <span>Tudo perdido</span>
      </p>
      <div className={`lp-map-promise${step >= 4 ? ' is-on' : ''}`}>
        <span>A espada embrulhada</span>
        <b>
          <i style={{ left: '6%' }} className="is-open" />
          <i style={{ left: '44%' }} />
          <i style={{ left: '92%' }} className="is-paid" />
        </b>
      </div>
      <div className={`lp-map-promise is-stalled${step >= 5 ? ' is-on' : ''}`}>
        <span>Os 312 degraus</span>
        <b>
          <i style={{ left: '20%' }} className="is-open" />
        </b>
      </div>
      <p className={`lp-map-q${step >= 6 ? ' is-on' : ''}`}>“Os 312 degraus” foi plantada em “A Torre fechada” e nenhuma pista dela aparece depois. Ela ainda vai avançar?</p>
    </div>
  )
}

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

const BEATS = ['A chave na taverna', 'Subir pelas falésias', 'A biblioteca selada', 'Cassian chega com a guarda']

/** O escudo: as cenas se riscam uma a uma, um segredo é revelado e o relógio enche. */
function EscudoScreen({ step }: { step: number }) {
  const now = Math.min(BEATS.length - 1, Math.floor(step / 2))
  const filled = Math.min(4, 1 + Math.floor(step / 3))
  return (
    <div className="lp-scr lp-scr-mesa lp-scr-escudo" aria-hidden="true">
      <div className="lp-escudo-col">
        <p className="lp-painel-title">Roteiro</p>
        <p className="lp-shield-label">Início forte</p>
        <p className="lp-escudo-start">Um corvo pousa na mesa com uma chave de marfim no bico.</p>
        <p className="lp-shield-label">Cenas</p>
        {BEATS.map((b, i) => (
          <p key={b} className={`lp-beat${i < now ? ' is-done' : ''}${i === now ? ' is-now' : ''}`}>
            <i /> {b} {i === now && <b>agora</b>}
          </p>
        ))}
        <p className="lp-shield-label">Segredos e pistas</p>
        <div className={`lp-secret-row${step >= 5 ? ' is-done' : ''}${step === 4 ? ' is-pressing' : ''}`}>
          <span>Vaelor sobreviveu à Queda</span>
          <span className="lp-secret-btn">{step >= 5 ? <Check size={12} /> : <Eye size={12} />}</span>
        </div>
      </div>
      <div className="lp-escudo-col">
        <p className="lp-painel-title">Palco</p>
        <div className="lp-stage is-big">
          <small>Cena atual</small>
          <strong>{BEATS[now]}</strong>
        </div>
        <div className="lp-clock">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="16" r="14" className="lp-clock-bg" />
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={['M16 16 L16 2 A14 14 0 0 1 30 16 Z', 'M16 16 L30 16 A14 14 0 0 1 16 30 Z', 'M16 16 L16 30 A14 14 0 0 1 2 16 Z', 'M16 16 L2 16 A14 14 0 0 1 16 2 Z'][i]} className={i < filled ? 'lp-clock-on' : 'lp-clock-off'} />
            ))}
          </svg>
          <span>
            <strong>A guarda chega</strong> {filled} de 4
          </span>
        </div>
      </div>
    </div>
  )
}

const MODES = [
  { name: 'Clássica', order: ['Kaya 19', 'Goblin 15', 'Taren 12', 'Lobo 8'], how: 'Cada um rola; do maior para o menor.' },
  { name: 'Por lados', order: ['Heróis', 'Kaya', 'Taren', 'Inimigos', 'Goblin', 'Lobo'], how: 'Heróis 14 × inimigos 9: os heróis escolhem a ordem.' },
  { name: 'Pipoca', order: ['Kaya', '→ Taren', '→ Goblin', '→ Lobo'], how: 'Quem agiu escolhe quem vem depois.' },
]

/** O combate: os três jeitos de iniciativa passando, cada um com a sua fila. */
function CombateScreen({ step }: { step: number }) {
  const m = MODES[Math.min(MODES.length - 1, Math.floor(step / 3))]
  return (
    <div className="lp-scr lp-scr-mesa lp-scr-combate" aria-hidden="true">
      <p className="lp-painel-title">Combate · rodada 1</p>
      <p className="lp-modes">
        {MODES.map((x) => (
          <span key={x.name} className={x === m ? 'is-on' : ''}>
            {x.name}
          </span>
        ))}
      </p>
      <div className="lp-queue is-wide">
        {m.order.map((n, i) => (
          <span key={n} className={`lp-qface${i === 0 ? ' is-now' : ''}${/Goblin|Lobo|Inimigos/.test(n) ? ' is-foe' : ''}${/^(Heróis|Inimigos)$/.test(n) ? ' is-side' : ''}`}>
            <b>{n.replace('→ ', '')[0]}</b>
            <small>{n}</small>
          </span>
        ))}
      </div>
      <p className="lp-modes-how">{m.how}</p>
      <span className="lp-next is-pressing">Próxima vez ›</span>
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

// ─── Telinhas dos passos da escrita e dos amigos ──────────────────────────

/** O que se vê na tela em cada passo da escrita (os textos são os do app). */
export function StepScreen({ n }: { n: 1 | 2 | 3 }) {
  if (n === 1)
    return (
      <div className="lp-mini lp-mini-map" aria-hidden="true">
        <p className="lp-mini-bar">
          <MapIcon size={11} /> Mapa · Três atos
        </p>
        <p className="lp-mini-strip">
          <i className="is-pior" style={{ flex: 3 }} />
          <i className="is-pior" style={{ flex: 2 }} />
          <i className="is-igual" style={{ flex: 1 }} />
          <i className="is-melhor" style={{ flex: 4 }} />
          <i className="is-pior" style={{ flex: 3 }} />
          <i className="is-melhor" style={{ flex: 3 }} />
        </p>
        <p className="lp-mini-promise">
          <span>A espada embrulhada</span>
          <b />
        </p>
        <p className="lp-mini-q">“Nas brumas” está marcada como “igual”. Alguma coisa muda nela?</p>
      </div>
    )
  if (n === 2)
    return (
      <div className="lp-mini lp-mini-page" aria-hidden="true">
        <p className="lp-mini-bar">
          <PenLine size={11} /> Página · A chegada
        </p>
        <p className="lp-mini-frame">
          <span>Como termina</span> Pior: Mira jura que ele tem os olhos do príncipe morto
        </p>
        {/* Como no app: na Página, nem os nomes conhecidos ficam sublinhados. */}
        <p className="lp-mini-text">
          Era noite em Ostria quando Kael viu o navio. Ao lado dele, Ilsa não disse nada.
          <span className="lp-mini-caret" />
        </p>
        <p className="lp-mini-wait">
          <i /> 1 pergunta esperando a revisão
        </p>
      </div>
    )
  return (
    <div className="lp-mini lp-mini-3" aria-hidden="true">
      <p className="lp-mini-label">
        <SearchCheck size={11} /> Revisão · Esta cena
      </p>
      <p className="lp-mini-shift">
        <span>Melhor</span>
        <span className="is-on">Pior</span>
        <span>Igual</span>
      </p>
      <p className="lp-mini-check">
        <Check size={12} /> Planta “A espada embrulhada”
      </p>
      <p className="lp-mini-q">Kael está em Ostria em “A chegada” e em Torre de Marfim em “A Torre”, no mesmo dia. Viajou, ou é outra pessoa?</p>
      <p className="lp-mini-actions">
        <span className="is-hot">É intencional</span>
        <span>Explicar</span>
        <span>É um erro</span>
      </p>
    </div>
  )
}

const NEWS = [
  { who: 'Ana', text: 'pôs “A Queda de Valkaria” na estante.', when: 'agora' },
  { who: 'Bruno', text: 'bateu a meta do dia: 1.200 palavras.', when: 'há 2 horas' },
  { who: 'Carla', text: 'reagiu 🔥 a um capítulo de “As Cinzas de Ostria”.', when: 'ontem' },
]

/** O celular na parte dos amigos: as novidades chegando e o placar dos treinos. */
export function FriendsPhone() {
  const { ref, step } = useCycle([1400, 1400, 1400, 3800])
  return (
    <figure ref={ref as React.RefObject<HTMLElement>} className="lp-friends" aria-label="Exemplo: as novidades dos amigos e o placar dos treinos">
      <div className="lp-friends-screen" aria-hidden="true">
        <p className="lp-friends-h">
          <Sparkles size={12} /> Novidades
        </p>
        <ul className="lp-friends-news">
          {NEWS.map((n, i) => (
            <li key={n.who} className={step >= NEWS.length - 1 - i ? 'is-on' : ''}>
              <span className="lp-friends-avatar">{n.who[0]}</span>
              <span>
                <strong>{n.who}</strong> {n.text}
                <small>{n.when}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="lp-friends-h">
          <Trophy size={12} /> Placar dos treinos · Semana
        </p>
        <ol className={`lp-friends-placar${step >= 3 ? ' is-on' : ''}`}>
          {[
            ['🥇', 'Ana', 214],
            ['🥈', 'Você', 180],
            ['🥉', 'Bruno', 96],
          ].map(([medal, who, pts]) => (
            <li key={who} className={who === 'Você' ? 'is-me' : ''}>
              <span>{medal}</span>
              <strong>{who}</strong>
              <span className="lp-friends-pts">{pts} pts</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  )
}
