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
      <figcaption className="small">Um site num arquivo só, sem os segredos. Abre em qualquer navegador.</figcaption>
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
