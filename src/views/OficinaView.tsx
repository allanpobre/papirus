import { AlertTriangle, BookOpen, Check, Lightbulb, PenLine, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Scene } from '../model/schema'
import { addScene, updateScene } from '../model/universe'
import { GUIDES, guessGuide, type GuideId } from '../oficina/guides'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'

/** Oficina: dicas de escrita por gênero, livros para estudar, curiosidades e exercícios. */
export default function OficinaView() {
  const { universe, update, go, readOnly } = useWorkspace()
  const [id, setId] = useState<GuideId>(() => (recall('oficina-guia') as GuideId | null) ?? guessGuide(universe.settings.fieldTemplates))
  const guide = GUIDES.find((g) => g.id === id) ?? GUIDES[0]
  const choose = (g: GuideId) => {
    setId(g)
    remember('oficina-guia', g)
  }

  // O exercício vira uma cena solta, com o enunciado na sinopse.
  const practice = (title: string, prompt: string) => {
    let created: Scene | undefined
    update((u) => {
      const [next, s] = addScene(u, null, `Exercício: ${title}`)
      created = s
      return updateScene(next, s.id, { synopsis: prompt })
    })
    if (created) go('escrever', created.id)
  }

  return (
    <div className="view oficina">
      <header className="view-head">
        <h1>Oficina</h1>
      </header>
      <p className="lede oficina-lede">Dicas para escrever melhor, por gênero, com livros para estudar, curiosidades e exercícios que viram cena.</p>

      <div className="oficina-chips" role="radiogroup" aria-label="Guia">
        {GUIDES.map((g) => (
          <button key={g.id} type="button" role="radio" aria-checked={g.id === guide.id} className="start-chip" onClick={() => choose(g.id)}>
            {g.label}
          </button>
        ))}
      </div>

      <article className="oficina-guide" aria-labelledby="oficina-titulo">
        <h2 id="oficina-titulo" className="oficina-title">
          {guide.label}
        </h2>
        <p className="oficina-intro">{guide.lede}</p>
        <p className="oficina-expect small">
          <strong>O que o leitor espera:</strong> {guide.expect}
        </p>

        <section className="oficina-section" aria-labelledby="oficina-funciona">
          <h3 id="oficina-funciona" className="section-label">
            <Check size={14} aria-hidden="true" /> O que funciona
          </h3>
          <ul className="oficina-tips">
            {guide.works.map((w) => (
              <li key={w.title}>
                <strong>{w.title}.</strong> {w.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="oficina-section" aria-labelledby="oficina-armadilhas">
          <h3 id="oficina-armadilhas" className="section-label">
            <AlertTriangle size={14} aria-hidden="true" /> Armadilhas comuns
          </h3>
          <ul className="oficina-traps">
            {guide.traps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="oficina-section" aria-labelledby="oficina-livros">
          <h3 id="oficina-livros" className="section-label">
            <BookOpen size={14} aria-hidden="true" /> Livros para estudar
          </h3>
          <ul className="oficina-books">
            {guide.books.map((b) => (
              <li key={b.title}>
                <span className="oficina-book-title">{b.title}</span>
                <span className="muted small">{b.author}</span>
                <span className="small">{b.what}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="oficina-section oficina-facts" aria-labelledby="oficina-curiosidades">
          <h3 id="oficina-curiosidades" className="section-label">
            <Sparkles size={14} aria-hidden="true" /> Curiosidades
          </h3>
          <ul>
            {guide.facts.map((f) => (
              <li key={f} className="small">
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="oficina-section" aria-labelledby="oficina-exercicios">
          <h3 id="oficina-exercicios" className="section-label">
            <Lightbulb size={14} aria-hidden="true" /> Experimente
          </h3>
          <ul className="oficina-exercises">
            {guide.exercises.map((e) => (
              <li key={e.title}>
                <strong>{e.title}</strong>
                <p className="small">{e.prompt}</p>
                {!readOnly && (
                  <button type="button" className="btn btn-sm" onClick={() => practice(e.title, e.prompt)}>
                    <PenLine size={14} /> Escrever este exercício
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  )
}
