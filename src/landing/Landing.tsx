import {
  ArrowRight,
  Bell,
  BookOpenCheck,
  Check,
  Feather,
  Flame,
  GraduationCap,
  Headphones,
  ImageIcon,
  Palette,
  Printer,
  Target,
  Trophy,
  Users,
  BookMarked,
  CalendarRange,
  Dices,
  EyeOff,
  ExternalLink,
  Lock,
  MapIcon,
  MessageSquareText,
  Moon,
  Network,
  Radio,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sun,
  Swords,
  WifiOff,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrandMark } from '../shell/Brand'
import { FriendsPhone, MesaDemo, ScreensShowcase, StepScreen } from './Demos'
import { rollIdea, type IdeaMode } from '../oficina/ideas'
import { MESA_THEMES } from '../rpg/themes'

const APP = 'app/'

type Theme = 'light' | 'dark'
const systemTheme = (): Theme => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

/** Página de apresentação do Papirus. O app fica em /app/. */
export function Landing() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}').theme
      return saved === 'escuro' ? 'dark' : saved === 'claro' ? 'light' : systemTheme()
    } catch {
      return systemTheme()
    }
  })
  // Quem já usa vê "Continuar" em vez de "Começar".
  const [hasWork] = useState(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}') as { onboarded?: boolean }
      return Boolean(localStorage.getItem('papirus:ultimo-universo') || prefs.onboarded)
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // A mesma cor de destaque escolhida no app.
  useEffect(() => {
    try {
      const accent = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}').accent
      if (accent && accent !== 'viridiana') document.documentElement.setAttribute('data-accent', accent)
    } catch {
      // Sem armazenamento: fica a cor padrão.
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      const prefs = JSON.parse(localStorage.getItem('papirus:prefs') ?? '{}')
      localStorage.setItem('papirus:prefs', JSON.stringify({ ...prefs, theme: next === 'dark' ? 'escuro' : 'claro' }))
    } catch {
      // Sem armazenamento: o tema vale só nesta visita.
    }
  }

  const primary = hasWork ? 'Continuar no Papirus' : 'Começar a escrever'

  return (
    <div className="lp">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="lp-nav">
        <a className="lp-brand" href="./" aria-label="Papirus, início">
          <BrandMark size={28} />
          <span>Papirus</span>
        </a>
        <nav className="lp-links" aria-label="Seções">
          <a href="#escrever">Escrita</a>
          <a href="#mestrar">Mesa de RPG</a>
          <a href="#oficina">Oficina</a>
          <a href="#juntos">Amigos</a>
        </nav>
        <div className="lp-nav-actions">
          <button type="button" className="btn-icon" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a className="btn btn-primary btn-sm" href={APP}>
            Abrir o Papirus
          </a>
        </div>
      </header>

      <main id="conteudo">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Escrita, mesa de RPG e oficina, num app só</p>
            <h1>
              Seu mundo, escrito e jogado <em>no mesmo caderno.</em>
            </h1>
            <p className="lp-lede">
              Escreva como sempre. O Papirus percebe os nomes, guarda fichas, datas, segredos e mentiras. Na mesa, organiza as fichas e mostra aos jogadores só o que você revelar. E na Oficina, ensina um pouco por dia. Nada é obrigatório.
            </p>
            <div className="lp-ctas">
              <a className="btn btn-primary btn-lg" href={APP}>
                {primary} <ArrowRight size={18} />
              </a>
              <a className="btn btn-ghost btn-lg" href={`${APP}?exemplo`}>
                <Sparkles size={18} /> Ver um mundo de exemplo
              </a>
            </div>
            <ul className="lp-proof">
              <li>
                <ShieldCheck size={15} aria-hidden="true" /> Grátis e sem cadastro
              </li>
              <li>
                <WifiOff size={15} aria-hidden="true" /> Funciona sem internet
              </li>
              <li>
                <Lock size={15} aria-hidden="true" /> Seus dados ficam com você
              </li>
            </ul>
          </div>
          <Manuscript />
        </section>

        <div className="lp-zone lp-zone-setores">
        <section className="lp-section" id="setores" aria-labelledby="setores-titulo">
          <p className="lp-eyebrow">Três setores</p>
          <h2 id="setores-titulo">Cada parte com a sua cara. O mesmo caderno por trás.</h2>
          <div className="lp-sectors">
            {SECTORS.map(({ id, icon: Icon, name, title, items, href }) => (
              <a key={id} className={`lp-sector lp-sector-${id}`} href={href}>
                <span className="lp-sector-icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span className="lp-sector-name">{name}</span>
                <span className="lp-sector-title">{title}</span>
                <ul>
                  {items.map((t) => (
                    <li key={t}>
                      <Check size={14} aria-hidden="true" /> {t}
                    </li>
                  ))}
                </ul>
                <span className="lp-sector-go">
                  Saber mais <ArrowRight size={15} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </section>
        </div>

        <div className="lp-zone lp-zone-escrita">
        <section className="lp-section" id="escrever" aria-labelledby="escrever-titulo">
          <p className="lp-eyebrow">
            <Feather size={14} aria-hidden="true" /> Escrita · para quem escreve
          </p>
          <h2 id="escrever-titulo">Escreva primeiro. O resto se organiza quando você quiser.</h2>
          <ol className="lp-steps">
            <li>
              <span className="lp-step-n">1</span>
              <h3>Escreva a cena</h3>
              <p>Um editor limpo, sem distrações. Os nomes que você já conhece aparecem sublinhados. Os novos, o Papirus conta no botão Revisar da margem, como sugestão: nunca viram ficha sozinhos.</p>
              <StepScreen n={1} />
            </li>
            <li>
              <span className="lp-step-n">2</span>
              <h3>Selecione e guarde</h3>
              <p>Um trecho vira ficha, fato, comentário ou ligação com um clique. “Mira jurou que ele tinha olhos cinzentos” vira um fato, com quem disse e se é verdade.</p>
              <StepScreen n={2} />
            </li>
            <li>
              <span className="lp-step-n">3</span>
              <h3>Veja o mundo crescer</h3>
              <p>Fichas, relações, linha do tempo e mapas se preenchem a partir do texto. O Papirus pergunta quando algo não fecha: alguém em dois lugares no mesmo dia, um morto que aparece de novo.</p>
              <StepScreen n={3} />
            </li>
          </ol>
        </section>
        </div>

        <section className="lp-band lp-mesa" id="mestrar" aria-labelledby="mestrar-titulo">
          <div className="lp-band-inner">
            <div className="lp-band-copy">
              <p className="lp-eyebrow">
                <Dices size={14} aria-hidden="true" /> Mesa de RPG · para quem mestra
              </p>
              <h2 id="mestrar-titulo">O mesmo mundo, agora na mesa.</h2>
              <p className="lp-lede">
                O RPG de verdade acontece na mesa, com dados de verdade. O Papirus é o ajudante: guarda as fichas, faz as contas e liga o mestre ao celular de cada jogador, nos dois sentidos.
              </p>
              <ul className="lp-checks">
                <li>
                  <Dices size={18} aria-hidden="true" /> Role os seus dados e diga o que saiu: o app soma o bônus, vê o crítico e calcula o dano. Esqueceu os dados? Ele rola.
                </li>
                <li>
                  <Swords size={18} aria-hidden="true" /> Ficha feita para jogar: PV e PM com um toque, ataques, poderes que gastam PM, condições e inventário
                </li>
                <li>
                  <Palette size={18} aria-hidden="true" /> Cada mesa com o clima do gênero, escolhido pelo mestre; cada jogador escolhe claro ou escuro
                </li>
                <li>
                  <Swords size={18} aria-hidden="true" /> Combate: escolha o alvo e o app diz se acerta pela Defesa; o dano sai da vida dele, e quem cai aparece como derrotado
                </li>
                <li>
                  <Radio size={18} aria-hidden="true" /> Codex ao vivo: cada jogador rola pela própria ficha no celular, e a mesa toda vê. Revelações, mapa e a vez no combate chegam na hora
                </li>
                <li>
                  <EyeOff size={18} aria-hidden="true" /> Segredos ficam com você; uma mentira aparece só como “segundo fulano”
                </li>
              </ul>
              <p className="lp-systems">D&amp;D 5e · Tormenta 20 · Ordem Paranormal · Call of Cthulhu · parada de dados · ou as suas regras</p>
              <ul className="lp-themes" aria-label="Temas da mesa">
                {MESA_THEMES.map((t) => (
                  <li key={t.id} style={{ '--t-bg': t.dark[0], '--t-card': t.dark[1], '--t-accent': t.dark[2] } as React.CSSProperties}>
                    <span className="lp-theme-dot" aria-hidden="true" />
                    <span>
                      <strong>{t.name}</strong> {t.genre}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="lp-band-demo">
            <MesaDemo />
          </div>
        </section>

        <section className="lp-oficina-band" id="oficina" aria-labelledby="oficina-titulo">
          <div className="lp-section lp-oficina">
          <div className="lp-oficina-copy">
            <p className="lp-eyebrow">
              <GraduationCap size={14} aria-hidden="true" /> Oficina · para aprender
            </p>
            <h2 id="oficina-titulo">Aprenda escrevendo. Um pouco por dia.</h2>
            <p className="lp-lede">Guias curtos de gêneros e técnicas, e guias para quem mestra: o que funciona, armadilhas, livros para estudar, curiosidades e exercícios que viram cena com um toque.</p>
            <ul className="lp-shelf" aria-label="Guias da Oficina">
              {SHELF.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
          <IdeaDemo />
          </div>
        </section>

        <div className="lp-zone lp-zone-telas">
        <section className="lp-section lp-inside" id="telas" aria-labelledby="telas-titulo">
          <p className="lp-eyebrow">Por dentro</p>
          <h2 id="telas-titulo">Veja como é usar, setor por setor.</h2>
          <p className="lp-lede">Três partes separadas, cada uma com as suas telas. Escolha um setor.</p>
          <ScreensShowcase />
        </section>
        </div>

        <div className="lp-zone lp-zone-amigos">
        <section className="lp-section" id="juntos" aria-labelledby="juntos-titulo">
          <p className="lp-eyebrow">
            <Users size={14} aria-hidden="true" /> Com os amigos
          </p>
          <h2 id="juntos-titulo">Escrever é sozinho. Ler pode ser junto.</h2>
          <p className="lp-lede">Com uma conta (opcional), você ganha um perfil, adiciona amigos e decide, livro por livro, quem pode ler: só você, os amigos ou todo mundo.</p>
          <div className="lp-together-wrap">
            <div className="lp-features lp-together">
              {TOGETHER.map(({ icon: Icon, title, text }) => (
                <article key={title} className="lp-feature">
                  <Icon size={20} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <FriendsPhone />
          </div>
        </section>
        </div>

        <div className="lp-zone lp-zone-tudo">
        <section className="lp-section" aria-labelledby="tudo-titulo">
          <h2 id="tudo-titulo">Tudo o que um mundo precisa</h2>
          <div className="lp-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="lp-feature">
                <Icon size={20} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        </div>

        <div className="lp-zone lp-zone-principios">
        <section className="lp-section lp-principles" id="principios" aria-labelledby="principios-titulo">
          <p className="lp-eyebrow">Princípios</p>
          <h2 id="principios-titulo">O mundo é seu. O Papirus só ajuda.</h2>
          <div className="lp-principle-list">
            <blockquote>
              <p>Nada é obrigatório.</p>
              <span>Escreva sem criar uma ficha sequer. Esconda do menu o que você não usa. Cada automação pode ser desligada.</span>
            </blockquote>
            <blockquote>
              <p>Nada vira canon sem você.</p>
              <span>O Papirus sugere e pergunta. Contradições podem ser propositais: mistério, magia ou mentira de personagem.</span>
            </blockquote>
            <blockquote>
              <p>Seus dados são seus.</p>
              <span>Tudo fica no seu navegador. Baixe o backup, salve numa pasta do computador ou, se quiser, numa conta para usar em vários aparelhos.</span>
            </blockquote>
          </div>
        </section>
        </div>

        <div className="lp-zone lp-zone-final">
        <section className="lp-final" aria-labelledby="final-titulo">
          <h2 id="final-titulo">Abra o caderno.</h2>
          <p>Leva dez segundos: dê um nome ao seu mundo e comece a escrever.</p>
          <div className="lp-ctas">
            <a className="btn btn-primary btn-lg" href={APP}>
              {primary} <ArrowRight size={18} />
            </a>
            <a className="btn btn-ghost btn-lg" href={`${APP}?exemplo`}>
              <Sparkles size={18} /> Ver o exemplo
            </a>
          </div>
        </section>
        </div>
      </main>

      <footer className="lp-footer">
        <span className="lp-brand">
          <BrandMark size={20} /> Papirus
        </span>
        <span className="muted small">Feito para escritores e mestres. Código aberto. Versão {__APP_VERSION__}.</span>
        <a className="lp-footer-link" href="https://github.com/allanpobre/papirus" target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" /> Código no GitHub
        </a>
      </footer>
    </div>
  )
}

const FEATURES = [
  { icon: BookMarked, title: 'Fichas', text: 'Personagens, lugares, facções e o que mais você inventar, com retrato, campos livres e um modo de leitura como enciclopédia.' },
  { icon: Network, title: 'Relações', text: 'Quem é filho, rival ou criador de quem, num grafo que você navega. Uma relação pode ter vários nomes.' },
  { icon: CalendarRange, title: 'Linha do tempo', text: 'Eras, eventos e cenas datadas, com um calendário próprio: “12 de Neblina de 359 DC”.' },
  { icon: MapIcon, title: 'Atlas', text: 'Suba a imagem do seu mapa e marque os lugares. Revele à mesa só os marcadores que ela conhece.' },
  { icon: EyeOff, title: 'Segredos e spoilers', text: 'Trechos secretos nas fichas, fatos falsos com quem os contou e partes que o leitor só vê depois de certa cena.' },
  { icon: ImageIcon, title: 'Imagens', text: 'Capa do universo, retratos, mapas e imagens nas cenas, encolhidas sozinhas para não pesar.' },
  { icon: Headphones, title: 'Ler e ouvir', text: 'Leia como livro, com um caderno que não dá spoiler, ou ouça o texto em voz alta para revisar.' },
  { icon: Printer, title: 'Livro pronto', text: 'Importe .docx ou .md. Exporte em Word, EPUB ou um PDF diagramado para imprimir.' },
  { icon: Target, title: 'Metas e calendário', text: 'Meta do dia, meta com prazo e um calendário de quanto você escreveu, com a sequência de dias.' },
  { icon: MessageSquareText, title: 'Comentários e versões', text: 'Notas presas ao texto e versões de cada cena para comparar e voltar atrás.' },
  { icon: WifiOff, title: 'Instala e funciona offline', text: 'Vira app no celular e no computador e abre sem internet. Backup em arquivo, numa pasta ou na conta.' },
  { icon: ScrollText, title: 'Perguntar ao mundo (opcional)', text: 'Pergunte à sua lore com IA, usando a sua chave. Ele só lê o que você manda e nunca muda nada.' },
]

const SECTORS = [
  {
    id: 'escrita',
    icon: Feather,
    name: 'Escrita',
    title: 'Escreva e veja o mundo crescer',
    items: ['Editor que reconhece os nomes', 'Fichas, relações, linha do tempo e mapas', 'Modo leitor, áudio, Word, EPUB e PDF', 'Amigos, estante e desafios'],
    href: '#escrever',
  },
  {
    id: 'mesa',
    icon: Dices,
    name: 'Mesa de RPG',
    title: 'Mestre com dados de verdade',
    items: ['Dado físico primeiro; o app faz as contas', 'Combate: acerta ou erra, e o dano no alvo', 'Seis climas, um para cada gênero', 'Jogadores rolam pelo Codex, ao vivo'],
    href: '#mestrar',
  },
  {
    id: 'oficina',
    icon: GraduationCap,
    name: 'Oficina',
    title: 'Aprenda um pouco por dia',
    items: ['Gêneros, técnicas e guias de mestre', 'Exercícios que viram cena', 'Gerador de ideias e de ganchos', 'Dica do dia e o seu progresso'],
    href: '#oficina',
  },
] as const

const SHELF = ['Fundamentos', 'Fantasia', 'Ficção científica', 'Mistério', 'Romance', 'Terror', 'Drama e realismo', 'Personagem', 'Estrutura', 'Diálogo', 'Ritmo e tensão', 'Revisão', 'Mestrar', 'Aventuras e vilões']

const TOGETHER = [
  { icon: BookOpenCheck, title: 'Estante', text: 'Publique um livro para os amigos (ou para todo mundo) e eles leem direto no navegador.' },
  { icon: Bell, title: 'Novidades', text: 'Quem pôs livro novo na estante, quem bateu a meta, quem pediu amizade.' },
  { icon: Users, title: 'Leitores beta', text: 'Mande um link de leitura e receba comentários presos ao trecho e reações por capítulo.' },
  { icon: Trophy, title: 'Desafios', text: 'Uma proposta por dia e desafios entre amigos. Medalhas para quem gosta.' },
  { icon: Flame, title: 'Sequência', text: 'Dias seguidos escrevendo, contados só se você quiser contar.' },
  { icon: Trophy, title: 'Placar dos treinos', text: 'Entre amigos ou de todo mundo, na semana ou no mês. Só números: o texto nunca aparece.' },
]

/** O gerador de ideias da Oficina, para experimentar aqui mesmo. */
function IdeaDemo() {
  const [mode, setMode] = useState<IdeaMode>('escrita')
  const [idea, setIdea] = useState(() => rollIdea('escrita'))
  const [n, setN] = useState(0)
  const roll = (m: IdeaMode = mode) => {
    setIdea(rollIdea(m))
    setN((x) => x + 1)
  }
  return (
    <figure className="lp-idea" aria-label="Gerador de ideias da Oficina">
      <div className="lp-idea-top">
        <span>
          <Sparkles size={16} aria-hidden="true" /> Gerador de ideias
        </span>
        <span className="lp-idea-modes" role="radiogroup" aria-label="Ideia para">
          {(
            [
              ['escrita', 'Escrever'],
              ['mesa', 'Mesa'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m)
                roll(m)
              }}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      <dl key={n} aria-live="polite">
        {idea.parts.map((p, i) => (
          <div key={p.label} style={{ '--i': i } as React.CSSProperties}>
            <dt>{p.label}</dt>
            <dd>{p.text}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn btn-primary" onClick={() => roll()}>
        <Dices size={16} key={n} className={n ? 'lp-dice' : undefined} /> Sortear outra
      </button>
    </figure>
  )
}

type Seg = { t: string; kind?: 'name' | 'fact' }

/** O texto da cena de exemplo, em pedaços: nomes que o Papirus reconhece e o trecho que vira fato. */
const SCENE: Seg[][] = [
  [{ t: 'Era noite em ' }, { t: 'Ostria', kind: 'name' }, { t: ' quando o homem pálido desceu do navio. ' }, { t: 'Kael', kind: 'name' }, { t: ' o viu primeiro, da sombra das redes.' }],
  [{ t: 'Mais tarde, na taverna, ' }, { t: 'Mira', kind: 'name' }, { t: ' jurou que ele tinha ' }, { t: 'olhos cinzentos', kind: 'fact' }, { t: '.' }],
]
const TOTAL = SCENE.flat().reduce((n, s) => n + s.t.length, 0)
/** Onde cada pedaço começa no texto todo. */
const STARTS: number[][] = (() => {
  let at = 0
  return SCENE.map((para) =>
    para.map((seg) => {
      const start = at
      at += seg.t.length
      return start
    }),
  )
})()
const calm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A página de manuscrito se escreve sozinha: os nomes conhecidos ganham o sublinhado
 * quando terminam de ser digitados, o trecho vira fato e as fichas chegam na margem.
 * O texto inteiro já está na página desde o início (só transparente), então nada pula.
 */
function Manuscript() {
  const [typed, setTyped] = useState(() => (calm() ? TOTAL : 0))
  const [phase, setPhase] = useState<'escrevendo' | 'fato' | 'fichas'>(() => (calm() ? 'fichas' : 'escrevendo'))

  useEffect(() => {
    if (typed >= TOTAL) return
    const t = setTimeout(() => setTyped((n) => Math.min(TOTAL, n + 1)), typed === 0 ? 700 : 26)
    return () => clearTimeout(t)
  }, [typed])

  useEffect(() => {
    if (typed < TOTAL || phase === 'fichas') return
    const t = setTimeout(() => setPhase((p) => (p === 'escrevendo' ? 'fato' : 'fichas')), phase === 'escrevendo' ? 450 : 650)
    return () => clearTimeout(t)
  }, [typed, phase])

  const render = (seg: Seg, start: number, key: number) => {
    const shown = Math.max(0, Math.min(seg.t.length, typed - start))
    const done = shown === seg.t.length
    // O cursor fica no pedaço que está sendo digitado.
    const caret = typed < TOTAL && typed >= start && typed < start + seg.t.length
    const inner = (
      <>
        {seg.t.slice(0, shown)}
        {caret && <span className="lp-caret" aria-hidden="true" />}
        <span className="lp-ghost">{seg.t.slice(shown)}</span>
      </>
    )
    if (seg.kind === 'name') return <span key={key} className={`lp-name${done ? ' is-on' : ''}`}>{inner}</span>
    if (seg.kind === 'fact') return <mark key={key} className={`lp-fact${phase !== 'escrevendo' ? ' is-on' : ''}`}>{inner}</mark>
    return <span key={key}>{inner}</span>
  }

  return (
    <figure className={`lp-page lp-${phase}`} aria-label="Exemplo: uma cena com nomes reconhecidos, um fato guardado e o Codex da mesa">
      <div className="lp-sheet">
        <p className="lp-scene">A chegada · 12 de Neblina de 359 DC</p>
        {SCENE.map((para, i) => (
          <p key={i}>{para.map((seg, j) => render(seg, STARTS[i][j], j))}</p>
        ))}
      </div>
      <aside className="lp-cards" aria-hidden="true">
        <p className="lp-card">
          <strong>Kael</strong>
          <span>Personagem · aparece em 3 cenas</span>
        </p>
        <p className="lp-card lp-card-fact">
          <strong>Fato guardado</strong>
          <span>Vaelor tem olhos cinzentos, segundo Mira</span>
        </p>
      </aside>
    </figure>
  )
}
