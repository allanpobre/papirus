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

/**
 * Dois quadros que saem sozinhos das fichas e ligações, com o mundo de exemplo do próprio Papirus (a Terra de Oz):
 * as terras de Oz numa árvore deitada e quem está com quem (e contra quem) em arcos. Só desenho.
 */
export function QuadrosDemo() {
  return (
    <section className="lp-quadros" aria-labelledby="quadros-titulo">
      <h3 id="quadros-titulo">Escreva as ligações. Os quadros se desenham sozinhos.</h3>
      <div className="lp-quadros-grid">
        <figure aria-label="Árvore da Terra de Oz, deitada">
          <svg viewBox="0 0 320 190" role="img" aria-label="Terra de Oz se divide em Munchkins, Winkies, Quadlings e Norte; o Sul tem o Castelo de Glinda e o País de Porcelana">
            <g className="lq-lines">
              <path d="M96 95 C118 95 118 28 138 28 M96 95 C118 95 118 70 138 70 M96 95 C118 95 118 112 138 112 M96 95 C118 95 118 154 138 154" />
              <path d="M218 112 C236 112 236 92 250 92 M218 112 C236 112 236 132 250 132" />
            </g>
            <QBox x={8} y={77} w={88} label="Terra de Oz" sub="Reino" strong />
            <QBox x={138} y={10} w={80} label="Munchkins" sub="Leste" small />
            <QBox x={138} y={52} w={80} label="Winkies" sub="Oeste" small />
            <QBox x={138} y={94} w={80} label="Quadlings" sub="Sul" small />
            <QBox x={138} y={136} w={80} label="Norte" sub="Reino" small />
            <QBox x={250} y={74} w={66} label="Glinda" sub="Castelo" small />
            <QBox x={250} y={114} w={66} label="Porcelana" sub="País" small />
          </svg>
          <figcaption>Do exemplo “Terra de Oz”: terras dentro de terras, e você cria galhos direto no desenho.</figcaption>
        </figure>
        <figure aria-label="Diplomacia entre terras e povos de Oz">
          <svg viewBox="0 0 320 190" role="img" aria-label="Os Macacos estão a serviço dos Winkies; Winkies estão em guerra com Oz; Oz e Quadlings estão em tensão">
            <path className="lq-ally" d="M40 128 C40 96 118 96 118 128" />
            <path className="lq-war" d="M40 128 C40 20 196 20 196 128" />
            <path className="lq-tense" d="M196 128 C196 80 274 80 274 128" />
            <text className="lq-label" x="79" y="100" textAnchor="middle">a serviço de</text>
            <text className="lq-label" x="120" y="44" textAnchor="middle">em guerra</text>
            <text className="lq-label" x="235" y="86" textAnchor="middle">em tensão</text>
            <QBox x={4} y={128} w={72} label="Winkies" sub="Reino" small />
            <QBox x={82} y={128} w={72} label="Macacos" sub="Facção" small />
            <QBox x={160} y={128} w={72} label="Oz" sub="Reino" small />
            <QBox x={238} y={128} w={72} label="Quadlings" sub="Reino" small />
          </svg>
          <figcaption>Facções e reinos com cor e traço para cada tipo (os mesmos do exemplo “Terra de Oz”), e um controle de ano.</figcaption>
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
