import { Link2 } from 'lucide-react'
import { useState } from 'react'

/*
 * Duas miniaturas para a apresentação: a wiki do mundo (que troca de estilo, como no app) e o livro
 * em 3D, como aparece em Publicar. Só desenho: nada aqui lê o app.
 */

const WIKI_STYLES = [
  ['classico', 'Clássico'],
  ['moderno', 'Moderno'],
  ['pergaminho', 'Pergaminho'],
  ['noturno', 'Noturno'],
] as const

const ENTRIES = [
  ['O', 'Ostria', 'Lugar · A capital. Hoje, metade ruína, metade mercado.'],
  ['C', 'Cassian', 'Personagem · Regente. Ninguém lembra de antes dele.'],
  ['F', 'Fé da Maré', 'Religião · Reza para o mar que engoliu o reino.'],
] as const

/** A wiki do mundo em miniatura: os quatro estilos, a um toque. */
export function WikiDemo() {
  const [style, setStyle] = useState<(typeof WIKI_STYLES)[number][0]>('pergaminho')
  return (
    <figure className="lp-wiki-demo" aria-label="Wiki do mundo, em miniatura">
      <div className="lp-wiki-styles" role="radiogroup" aria-label="Estilo da wiki">
        {WIKI_STYLES.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={style === id} onClick={() => setStyle(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className={`lp-wiki lp-wiki-${style}`} aria-hidden="true">
        <div className="lp-wiki-bar">
          <strong>As Cinzas de Ostria</strong>
          <span className="lp-wiki-search">Procurar…</span>
        </div>
        <div className="lp-wiki-hero">
          <small>Wiki do mundo</small>
          <b>As Cinzas de Ostria</b>
          <span className="lp-wiki-orn">{style === 'pergaminho' ? '✦ ❦ ✦' : style === 'noturno' ? '✧' : style === 'moderno' ? '' : '❦'}</span>
          <p>Um reino em ruínas, um estranho de rosto pálido e uma herdeira que não sabe quem é.</p>
        </div>
        <ul className="lp-wiki-list">
          {ENTRIES.map(([initial, name, text]) => (
            <li key={name}>
              <span className="lp-wiki-thumb">{initial}</span>
              <span>
                <b>{name}</b>
                <small>{text}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="lp-wiki-link small" aria-hidden="true">
        <Link2 size={13} /> Pegar o link da wiki
      </p>
      <figcaption className="small">Um site num arquivo só, ou um link para mandar: sem os segredos, abre em qualquer navegador.</figcaption>
    </figure>
  )
}

/** O livro em 3D, como em Publicar: capa, lombada e o miolo de páginas. */
export function BookDemo() {
  return (
    <figure className="lp-book-demo" aria-label="O livro em 3D">
      <div className="lp-book3d">
        <div className="lp-book3d-front">
          <small>Ana Lúcia Prado</small>
          <b>As Cinzas de Ostria</b>
          <span className="lp-book3d-orn" aria-hidden="true">❦</span>
          <small>romance</small>
        </div>
        <div className="lp-book3d-spine">As Cinzas de Ostria</div>
        <div className="lp-book3d-pages" />
        <div className="lp-book3d-back" />
      </div>
      <div className="lp-book-spread" aria-hidden="true">
        <div className="lp-book-page">
          <small>Capítulo 1</small>
          <b>A cidade de vidro</b>
          <i />
          <i />
          <i />
          <i className="short" />
        </div>
        <div className="lp-book-page lp-book-page-turn">
          <i />
          <i />
          <i />
          <i />
          <i className="short" />
        </div>
      </div>
    </figure>
  )
}

/** Dois quadros que saem sozinhos das fichas e ligações: a árvore de uma espécie e a diplomacia entre reinos. Só desenho. */
export function QuadrosDemo() {
  return (
    <section className="lp-quadros" aria-labelledby="quadros-titulo">
      <h3 id="quadros-titulo">Escreva as ligações. Os quadros se desenham sozinhos.</h3>
      <div className="lp-quadros-grid">
        <figure aria-label="Árvore de uma espécie: Dragões, Cromáticos e Metálicos">
          <svg viewBox="0 0 320 190" role="img" aria-label="Dragões se divide em Cromáticos e Metálicos; Cromáticos em Vermelho e Azul">
            <g className="lq-lines">
              <path d="M160 40 V58 M80 58 H240 M80 58 V74 M240 58 V74 M80 110 V126 M44 126 H116 M44 126 V142 M116 126 V142" />
            </g>
            <QBox x={110} y={14} w={100} label="Dragões" sub="Espécie" strong />
            <QBox x={30} y={74} w={100} label="Cromáticos" sub="Espécie" />
            <QBox x={190} y={74} w={100} label="Metálicos" sub="Espécie" />
            <QBox x={11} y={142} w={66} label="Vermelho" sub="" small />
            <QBox x={83} y={142} w={66} label="Azul" sub="" small />
          </svg>
          <figcaption>Árvores de espécies, ordens e lugares: crie galhos direto no desenho.</figcaption>
        </figure>
        <figure aria-label="Diplomacia entre três reinos">
          <svg viewBox="0 0 320 190" role="img" aria-label="Corte de Brasa e República da Maré são aliadas; ambas em guerra e em paz tensa com o Domínio de Ferro">
            <line className="lq-ally" x1="85" y1="40" x2="235" y2="40" />
            <line className="lq-war" x1="70" y1="58" x2="140" y2="140" />
            <line className="lq-tense" x1="250" y1="58" x2="180" y2="140" />
            <text className="lq-label" x="160" y="33" textAnchor="middle">aliança</text>
            <text className="lq-label" x="84" y="106" textAnchor="middle">em guerra</text>
            <text className="lq-label" x="244" y="106" textAnchor="middle">paz tensa</text>
            <QBox x={20} y={20} w={110} label="Corte de Brasa" sub="Reino" />
            <QBox x={190} y={20} w={110} label="República da Maré" sub="Reino" />
            <QBox x={105} y={140} w={110} label="Domínio de Ferro" sub="Reino" />
          </svg>
          <figcaption>Diplomacia com cor e traço para cada tipo, e um controle de ano.</figcaption>
        </figure>
      </div>
    </section>
  )
}

function QBox({ x, y, w, label, sub, strong = false, small = false }: { x: number; y: number; w: number; label: string; sub: string; strong?: boolean; small?: boolean }) {
  const h = small ? 32 : 36
  return (
    <g className={`lq-box${strong ? ' is-strong' : ''}`} transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="6" />
      <text x={w / 2} y={sub ? 16 : 20} textAnchor="middle" className="lq-name">
        {label}
      </text>
      {sub && (
        <text x={w / 2} y={28} textAnchor="middle" className="lq-sub">
          {sub}
        </text>
      )}
    </g>
  )
}
