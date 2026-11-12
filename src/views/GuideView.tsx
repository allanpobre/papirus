import { ArrowRight, BookOpenText, Dices, Earth, Feather, House, Search, Sprout, Wrench, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fold } from '../logic/text'
import { PAGE_TOURS, type PageTourId } from '../shell/pageTours'
import { remember } from '../state/prefs'
import { useWorkspace, type View } from '../state/workspace'
import { ViewTop } from '../ui/ViewTop'

/*
 * Guia: todas as ferramentas do Papirus, área por área, e cada parte de cada área a fundo. O texto de
 * cada parte vem do passeio (?) da tela, então o Guia e os passeios dizem sempre a mesma coisa.
 */

interface Part {
  title: string
  /** Uma frase: para que serve. */
  what: string
  tour: PageTourId
  /** Sem tela no universo (fica no início do app): não tem "Abrir". */
  view?: View
  /** Na Mesa: a aba que abre. */
  rpgTab?: string
}

interface Area {
  id: string
  title: string
  icon: LucideIcon
  intro: string
  parts: Part[]
}

const AREAS: Area[] = [
  {
    id: 'inicio',
    title: 'Início',
    icon: House,
    intro: 'A porta do universo: onde você parou, o próximo passo e o que falta no mundo.',
    parts: [{ title: 'Início', what: 'Abre na cena em que você parou, com o bilhete para amanhã, a meta do dia e o que falta no mundo.', tour: 'inicio', view: 'inicio' }],
  },
  {
    id: 'escrita',
    title: 'Escrever e publicar',
    icon: Feather,
    intro: 'Escrever em três momentos (Estrutura, Página e Revisão) e, no fim, fazer o livro.',
    parts: [
      { title: 'Estrutura', what: 'A história vista de cima: o modelo (três atos, Save the Cat…), as cenas na cor de como terminam e as promessas.', tour: 'organizar', view: 'organizar' },
      { title: 'Página e Revisão', what: 'A Página é só o texto, com a porta fechada. A Revisão traz a margem: quem aparece, o que a cena planta e as perguntas.', tour: 'escrever', view: 'escrever' },
      { title: 'Revisar nomes', what: 'Os nomes novos do texto, um por um: virar ficha, juntar como apelido ou ignorar.', tour: 'revisao', view: 'escrever' },
      { title: 'Publicar', what: 'Do manuscrito ao livro: revisar, o que os leitores disseram, diagramar, o livro em 3D, folhear e baixar.', tour: 'livro', view: 'livro' },
      { title: 'Diagramar', what: 'O livro como vai sair: fonte, página, capa e capa para gráfica, vendo as páginas de verdade.', tour: 'diagramar', view: 'livro' },
    ],
  },
  {
    id: 'mundo',
    title: 'Mundo',
    icon: Earth,
    intro: 'Tudo o que existe na história: fichas, como se ligam, quando aconteceu e onde fica.',
    parts: [
      { title: 'Fichas', what: 'Personagens, lugares, facções e o que mais você inventar. Cada ficha tem o “Quem é” (o que a define neste mundo), a descrição, os campos e as ligações.', tour: 'fichas', view: 'fichas' },
      { title: 'Ligações', what: 'Quem é o quê de quem, num mapa que você navega cena a cena, e a árvore da família.', tour: 'relacoes', view: 'relacoes' },
      { title: 'Linha do tempo', what: 'Eras, eventos e cenas datadas, com a Máquina do tempo para ver o mundo num ano.', tour: 'timeline', view: 'timeline' },
      { title: 'Mapas', what: 'A imagem do seu mapa com os lugares marcados, o caminho de cada personagem e as regiões de quem manda.', tour: 'atlas', view: 'atlas' },
      { title: 'Wiki', what: 'O mundo como um site para leitores ou jogadores, sem segredos, em quatro estilos.', tour: 'wiki', view: 'wiki' },
    ],
  },
  {
    id: 'trama',
    title: 'Trama',
    icon: Sprout,
    intro: 'O que a história promete e quem sabe de quê.',
    parts: [
      { title: 'Pistas e mistérios', what: 'Sementes (uma preparação e o pagamento) e mistérios (as pistas de uma pergunta).', tour: 'tramas', view: 'tramas' },
      { title: 'Quem sabe o quê', what: 'Cada fato numa frase: se é verdade, quem sabe e se o leitor já viu.', tour: 'conhecimento', view: 'conhecimento' },
    ],
  },
  {
    id: 'mesa',
    title: 'Mesa de RPG',
    icon: Dices,
    intro: 'O mesmo mundo, numa campanha: preparar, o grupo, o que os jogadores veem e as regras.',
    parts: [
      { title: 'Preparar', what: 'A próxima sessão, o sistema, o grupo e os segredos ainda guardados.', tour: 'rpg-mestre', view: 'rpg', rpgTab: 'mestre' },
      { title: 'Sessões', what: 'Cada sessão com preparação, registro, diário e iniciativa.', tour: 'rpg-sessoes', view: 'rpg', rpgTab: 'sessoes' },
      { title: 'Grupo', what: 'As fichas de jogo dos personagens: vida, ataques e rolagens a um toque.', tour: 'rpg-personagens', view: 'rpg', rpgTab: 'personagens' },
      { title: 'Codex', what: 'O que os jogadores veem no celular: só o que você revelou.', tour: 'rpg-codex', view: 'rpg', rpgTab: 'codex' },
      { title: 'Regras e dados', what: 'Os sistemas de jogo, os dados, as tabelas aleatórias e os inimigos prontos.', tour: 'rpg-sistemas', view: 'rpg', rpgTab: 'sistemas' },
      { title: 'Sessão ao vivo', what: 'Quando a sessão começa, o app vira a mesa: roteiro, palco e grupo.', tour: 'sessao', view: 'rpg', rpgTab: 'sessoes' },
    ],
  },
  {
    id: 'ferramentas',
    title: 'Ferramentas',
    icon: Wrench,
    intro: 'O que serve a tudo: anotar, perguntar, aprender e ajustar.',
    parts: [
      { title: 'Ideias', what: 'Anote de qualquer lugar e decida depois: vira cena, ficha ou fica guardada.', tour: 'inbox', view: 'inbox' },
      { title: 'Perguntar ao mundo', what: 'Pergunte à sua lore com IA, usando a sua chave. Ela só lê o que você manda.', tour: 'archivist', view: 'archivist' },
      { title: 'Oficina', what: 'Aprender escrevendo: trilhas curtas, exercícios, imitação e o caderno.', tour: 'oficina', view: 'oficina' },
      { title: 'Comunidade', what: 'No início do app (Trocar de universo): novidades, continuar lendo, seguir, quem leu seus livros, bloquear e pedir AU.', tour: 'hub-comunidade' },
      { title: 'Ajustes e dados', what: 'Este universo (Simples ou Completo, calendário), este aparelho (aparência, backup) e a sua conta.', tour: 'config', view: 'config' },
    ],
  },
]

/** Os passos de uma parte, sem os que se repetem em todas as partes da área ("O mundo em quatro partes"). */
function stepsOf(area: Area, part: Part) {
  const own = PAGE_TOURS[part.tour]?.steps ?? []
  const count = new Map<string, number>()
  for (const p of area.parts) for (const s of PAGE_TOURS[p.tour]?.steps ?? []) count.set(s.title, (count.get(s.title) ?? 0) + 1)
  return own.filter((s) => area.parts.length < 2 || (count.get(s.title) ?? 0) < 2)
}

export default function GuideView() {
  const { go, kind } = useWorkspace()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const q = fold(query.trim())

  // Numa campanha, a Mesa vem logo depois do Início.
  const areas = useMemo(() => (kind === 'campanha' ? [AREAS[0], AREAS[4], ...AREAS.slice(1, 4), AREAS[5]] : AREAS), [kind])
  const found = useMemo(
    () =>
      areas
        .map((a) => ({
          area: a,
          parts: a.parts.filter((p) => !q || fold([a.title, p.title, p.what, ...stepsOf(a, p).flatMap((s) => [s.title, s.body])].join(' ')).includes(q)),
        }))
        .filter((x) => x.parts.length),
    [areas, q],
  )

  const openPart = (p: Part) => {
    if (p.rpgTab) remember('rpg-aba', p.rpgTab)
    if (p.view) go(p.view)
  }

  return (
    <div className="view guide-view">
      <ViewTop area="Guia" tour="guia" />
      <p className="muted guide-lede">Todas as ferramentas do Papirus, área por área. Toque numa parte para ver tudo o que ela faz; “Abrir” leva até ela, e lá o (?) mostra cada coisa no lugar.</p>
      <label className="guide-search">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" aria-label="Procurar no guia" placeholder="Procurar: mapa, segredo, dados, capa…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {found.length === 0 && <p className="muted">Nada com “{query.trim()}” no guia.</p>}
      {found.map(({ area: a, parts }) => {
        const Icon = a.icon
        return (
          <section key={a.id} className="guide-area" aria-labelledby={`guia-${a.id}`}>
            <h2 id={`guia-${a.id}`} className="guide-area-title">
              <Icon size={18} aria-hidden="true" /> {a.title}
            </h2>
            <p className="muted small">{a.intro}</p>
            <ul className="guide-parts">
              {parts.map((p) => {
                const key = `${a.id}:${p.title}`
                const expanded = open === key || Boolean(q)
                const steps = stepsOf(a, p)
                return (
                  <li key={key} className={`guide-part${expanded ? ' is-open' : ''}`}>
                    <div className="guide-part-head">
                      <button type="button" className="guide-part-toggle" aria-expanded={expanded} onClick={() => setOpen(open === key ? null : key)}>
                        <strong>{p.title}</strong>
                        <span className="small muted">{p.what}</span>
                      </button>
                      {p.view && (
                        <button type="button" className="btn btn-sm" onClick={() => openPart(p)} aria-label={`Abrir ${p.title}`}>
                          Abrir <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {expanded && steps.length > 0 && (
                      <dl className="guide-steps">
                        {steps.map((s) => (
                          <div key={s.title}>
                            <dt>{s.title}</dt>
                            <dd>{s.body}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <p className="muted small guide-foot">
        <BookOpenText size={14} aria-hidden="true" /> Cada tela tem o seu (?) no alto: ele mostra as mesmas explicações, apontando para cada coisa.
      </p>
    </div>
  )
}
