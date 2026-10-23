import {
  ArrowRight,
  BookDown,
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
          <a href="#escrever">Para quem escreve</a>
          <a href="#mestrar">Para quem mestra</a>
          <a href="#principios">Princípios</a>
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
            <p className="lp-eyebrow">Para quem escreve histórias e para quem mestra RPG</p>
            <h1>
              Seu mundo, escrito e jogado <em>no mesmo caderno.</em>
            </h1>
            <p className="lp-lede">
              Escreva como sempre. O Papirus percebe os nomes, guarda fichas, datas, segredos e mentiras, e na mesa mostra aos jogadores só o que você revelar. Nada é obrigatório.
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

        <section className="lp-section" id="escrever" aria-labelledby="escrever-titulo">
          <p className="lp-eyebrow">Para quem escreve</p>
          <h2 id="escrever-titulo">Escreva primeiro. O resto se organiza quando você quiser.</h2>
          <ol className="lp-steps">
            <li>
              <span className="lp-step-n">1</span>
              <h3>Escreva a cena</h3>
              <p>Um editor limpo, sem distrações. Os nomes que você já conhece aparecem sublinhados; os novos ficam como sugestão, nunca viram ficha sozinhos.</p>
            </li>
            <li>
              <span className="lp-step-n">2</span>
              <h3>Selecione e guarde</h3>
              <p>Um trecho vira ficha, fato, comentário ou ligação com um clique. “Mira jurou que ele tinha olhos cinzentos” vira um fato, com quem disse e se é verdade.</p>
            </li>
            <li>
              <span className="lp-step-n">3</span>
              <h3>Veja o mundo crescer</h3>
              <p>Fichas, relações, linha do tempo e mapas se preenchem a partir do texto. O Papirus pergunta quando algo não fecha: alguém em dois lugares no mesmo dia, um morto que aparece de novo.</p>
            </li>
          </ol>
        </section>

        <section className="lp-band" id="mestrar" aria-labelledby="mestrar-titulo">
          <div className="lp-band-inner">
            <div className="lp-band-copy">
              <p className="lp-eyebrow">Para quem mestra</p>
              <h2 id="mestrar-titulo">O mesmo mundo, agora na mesa.</h2>
              <p className="lp-lede">
                Use qualquer sistema, ou crie o seu. Prepare sessões, role iniciativa e controle a vida do grupo pelo tablet. O que os jogadores descobrem vai para o Codex deles, ao vivo no celular de cada um.
              </p>
              <ul className="lp-checks">
                <li>
                  <Dices size={18} aria-hidden="true" /> D&amp;D 5e, Tormenta 20, Ordem Paranormal, d100, parada de dados ou regras suas
                </li>
                <li>
                  <Swords size={18} aria-hidden="true" /> “Na mesa”: iniciativa, grupo, dados, tabelas e registro numa tela só
                </li>
                <li>
                  <Radio size={18} aria-hidden="true" /> Codex ao vivo: cada revelação chega aos jogadores em segundos
                </li>
                <li>
                  <EyeOff size={18} aria-hidden="true" /> Segredos ficam com você; uma mentira aparece só como “segundo fulano”
                </li>
              </ul>
            </div>
            <Phone />
          </div>
        </section>

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
      </main>

      <footer className="lp-footer">
        <span className="lp-brand">
          <BrandMark size={20} /> Papirus
        </span>
        <span className="muted small">Feito para escritores e mestres. Código aberto.</span>
        <a className="lp-footer-link" href="https://github.com/allanpobre/papirus" target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" /> Código no GitHub
        </a>
      </footer>
    </div>
  )
}

const FEATURES = [
  { icon: BookMarked, title: 'Fichas', text: 'Personagens, lugares, facções e o que mais você inventar, com campos livres e seções que recolhem.' },
  { icon: Network, title: 'Relações', text: 'Quem é filho, rival ou criador de quem, num grafo que você navega. Uma relação pode ter vários nomes.' },
  { icon: CalendarRange, title: 'Linha do tempo', text: 'Eras, eventos e cenas datadas, com um calendário próprio: “12 de Neblina de 359 DC”.' },
  { icon: MapIcon, title: 'Atlas', text: 'Suba a imagem do seu mapa e marque os lugares. Revele à mesa só os marcadores que ela conhece.' },
  { icon: EyeOff, title: 'Segredos e mentiras', text: 'Trechos secretos nas fichas e fatos falsos com quem os contou, separados do que é verdade.' },
  { icon: MessageSquareText, title: 'Comentários e versões', text: 'Notas presas ao texto, versões de cada cena para comparar e voltar atrás.' },
  { icon: BookDown, title: 'Livros', text: 'Importe um .docx ou .md e ele vira cenas. Exporte em Word, EPUB ou Markdown.' },
  { icon: ScrollText, title: 'Archivist (opcional)', text: 'Pergunte à sua lore com IA, usando a sua chave. Ele só lê o que você manda e nunca muda nada.' },
]

/** Uma página de manuscrito: nomes reconhecidos, um fato guardado e o Codex. */
function Manuscript() {
  return (
    <figure className="lp-page" aria-label="Exemplo: uma cena com nomes reconhecidos, um fato guardado e o Codex da mesa">
      <div className="lp-sheet">
        <p className="lp-scene">A chegada · 12 de Neblina de 359 DC</p>
        <p>
          Era noite em <span className="lp-name">Ostria</span> quando o homem pálido desceu do navio. <span className="lp-name">Kael</span> o viu primeiro, da sombra das redes.
        </p>
        <p>
          Mais tarde, na taverna, <span className="lp-name">Mira</span> jurou que ele tinha <mark className="lp-fact">olhos cinzentos</mark>.
        </p>
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

/** Um celular com o Codex dos jogadores. */
function Phone() {
  return (
    <figure className="lp-phone" aria-label="Exemplo: o Codex no celular de um jogador">
      <div className="lp-phone-screen">
        <div className="lp-phone-top">
          <span>As Cinzas de Ostria</span>
          <span className="lp-live">
            <Radio size={11} aria-hidden="true" /> ao vivo
          </span>
        </div>
        <p className="lp-phone-new">Novidades do mestre</p>
        <p className="lp-phone-title">Codex</p>
        <p className="lp-phone-sub">Mesa de sexta</p>
        <p className="lp-phone-kind">Personagens</p>
        <p className="lp-phone-entry">
          <strong>Kael</strong>
          Contrabandista do porto. Desconfia de todo mundo, menos da irmã.
        </p>
        <p className="lp-phone-entry">
          <strong>Vaelor</strong>
          <em>Ainda pouco se sabe.</em>
        </p>
        <p className="lp-phone-kind">Linha do tempo</p>
        <p className="lp-phone-entry lp-phone-new-item">
          <strong>341 DC</strong> A Queda
        </p>
        <p className="lp-phone-kind">O que sabemos</p>
        <p className="lp-phone-entry">
          Vaelor tem olhos cinzentos <em>(segundo Mira)</em>
        </p>
      </div>
    </figure>
  )
}
