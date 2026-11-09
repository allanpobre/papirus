import { CheckCircle2, Circle, Compass, X } from 'lucide-react'
import { useState } from 'react'
import { isSample } from '../model/sample'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'

interface FirstStep {
  id: string
  label: string
  hint: string
  done: boolean
  go: () => void
}

/**
 * Os primeiros passos de um universo novo, no Início: três coisas que levam ao lugar certo e ficam
 * riscadas quando estão feitas. No lugar da janela do tour na primeira abertura.
 */
export function FirstSteps({ onScene }: { onScene: () => void }) {
  const { universe, go, readOnly, kind, startTour } = useWorkspace()
  const key = `primeiros-passos:${universe.id}`
  const [closed, setClosed] = useState(() => recall(key) === 'fechado')
  if (readOnly || closed || isSample(universe)) return null

  const openMesa = (tab: string) => {
    remember('rpg-aba', tab)
    go('rpg')
  }
  const steps: FirstStep[] =
    kind === 'campanha'
      ? [
          {
            id: 'grupo',
            label: 'Crie o personagem de cada jogador',
            hint: 'Em Mesa › Grupo, com o nome de quem joga.',
            done: universe.sheets.some((s) => s.role === 'pj'),
            go: () => openMesa('personagens'),
          },
          {
            id: 'convite',
            label: 'Convide o grupo',
            hint: 'Um link para o celular de cada um, sem conta.',
            done: universe.groups.some((g) => g.share),
            go: () => openMesa('mestre'),
          },
          {
            id: 'sessao',
            label: 'Comece a sessão 1',
            hint: 'No Painel, “Começar agora”.',
            done: universe.sessions.some((s) => s.status !== 'planejada'),
            go: () => openMesa('mestre'),
          },
        ]
      : [
          {
            id: 'cena',
            label: 'Escreva a primeira cena',
            hint: 'Só o texto; capítulos e fichas podem vir depois.',
            done: universe.scenes.some((s) => s.text.trim()),
            go: onScene,
          },
          {
            id: 'ficha',
            label: 'Transforme um nome em ficha',
            hint: 'Na Página, o rodapé conta os nomes novos do texto.',
            done: universe.entities.length > 0,
            go: () => go('escrever'),
          },
          {
            id: 'bilhete',
            label: 'Deixe um bilhete para amanhã',
            hint: 'No fim da cena, uma linha sobre o que vem depois.',
            done: Boolean(universe.settings.nextNote?.text.trim()),
            go: () => go('escrever'),
          },
        ]
  if (steps.every((s) => s.done)) return null

  return (
    <section className="home-card home-first" aria-labelledby="primeiros-passos">
      <div className="home-first-head">
        <h2 id="primeiros-passos" className="section-title">
          Primeiros passos
        </h2>
        <button
          type="button"
          className="btn-icon btn-sm"
          aria-label="Esconder os primeiros passos"
          title="Esconder"
          onClick={() => {
            remember(key, 'fechado')
            setClosed(true)
          }}
        >
          <X size={15} />
        </button>
      </div>
      <ol className="first-steps">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'is-done' : undefined}>
            {s.done ? <CheckCircle2 size={18} aria-hidden="true" className="first-step-icon" /> : <Circle size={18} aria-hidden="true" className="first-step-icon" />}
            <span className="first-step-text">
              {s.done ? (
                <span className="first-step-label">
                  {s.label}
                  <span className="sr-only"> (feito)</span>
                </span>
              ) : (
                <button type="button" className="link-btn first-step-label" onClick={s.go}>
                  {s.label}
                </button>
              )}
              <span className="muted small">{s.hint}</span>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-ghost btn-sm" onClick={startTour}>
        <Compass size={15} /> Fazer o tour
      </button>
    </section>
  )
}
