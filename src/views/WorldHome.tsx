import { ArrowRight, Earth, Globe, Import, Inbox, Layers, MapIcon, Network, ScrollText, Sprout } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Picture } from '../images/Picture'
import { kindCounts, worldGaps } from '../logic/worldGaps'
import { worldLevel } from '../model/kind'
import { kindPlural } from '../model/labels'
import { draftEntity, insert } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { GeneratedCover } from '../ui/GeneratedCover'
import { PageHelp } from '../ui/PageTour'
import { SeedDialog } from './SeedDialog'
import { ForeignImport } from './ForeignImport'
import { Modal } from '../ui/Modal'

/** A partir de quantas fichas o Simples sugere o Completo. */
const GROWN = 50

/**
 * O Início de um mundo (worldbuilding): o mundo em números, o que falta e os atalhos.
 * No lugar da meta de palavras de quem escreve, o que ainda não está no mundo.
 */
export function WorldHome() {
  const { universe, go, update, hiddenViews, readOnly } = useWorkspace()
  const level = worldLevel(universe)
  const full = level === 'completo'
  const gaps = useMemo(() => worldGaps(universe, { full }).slice(0, 4), [universe, full])
  const kinds = useMemo(() => kindCounts(universe), [universe])
  const cover = universe.settings.cover ?? null
  const inbox = universe.inbox.filter((i) => i.status === 'aberto').length
  const shown = (v: Parameters<typeof go>[0]) => !hiddenViews.includes(v)
  const [seeding, setSeeding] = useState(false)
  const [importing, setImporting] = useState(false)
  const grown = !full && !readOnly && (universe.entities.length >= GROWN || universe.groups.length > 0)

  return (
    <div className="view home world-home">
      {seeding && <SeedDialog onClose={() => setSeeding(false)} />}
      {importing && (
        <Modal title="Trazer de outro app" onClose={() => setImporting(false)} size="sm">
          <ForeignImport onDone={() => setImporting(false)} />
        </Modal>
      )}
      <header className="home-today">
        <div className="home-id">
          {cover ? <Picture value={cover} className="home-thumb" /> : <GeneratedCover name={universe.name} className="home-thumb" />}
          <div className="home-id-text">
            <p className="eyebrow">
              <Earth size={13} aria-hidden="true" /> Mundo · {full ? 'Completo' : 'Simples'}
            </p>
            <h1>{universe.name || 'Sem nome'}</h1>
            {universe.description && <p className="home-desc">{universe.description}</p>}
          </div>
          <PageHelp tour="inicio-mundo" />
        </div>
        {kinds.length > 0 && (
          <ul className="world-kinds" aria-label="Fichas por tipo">
            {kinds.map(({ kind, count }) => (
              <li key={kind}>
                <button type="button" className="world-kind" onClick={() => go('fichas')}>
                  <strong className="tabular">{count}</strong> {kindPlural(kind).toLocaleLowerCase('pt-BR')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </header>

      {universe.entities.length === 0 ? (
        <section className="world-card world-empty">
          <h2>Comece pela primeira ficha</h2>
          <p className="muted">Um lugar, um povo, uma pessoa. Cada ficha faz as perguntas certas para o tipo dela. Ou plante a semente: cinco perguntas, e o mundo ganha as primeiras fichas já ligadas.</p>
          <div className="world-empty-actions">
            {!readOnly && (
              <button type="button" className="btn btn-primary" onClick={() => setSeeding(true)}>
                <Sprout size={16} aria-hidden="true" /> Plantar a semente
              </button>
            )}
            <button type="button" className="btn" onClick={() => go('fichas')}>
              <Earth size={16} aria-hidden="true" /> Abrir o Mundo
            </button>
            {!readOnly && (
              <button type="button" className="btn btn-ghost" onClick={() => setImporting(true)}>
                <Import size={16} aria-hidden="true" /> Trazer de outro app
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="world-card" aria-labelledby="falta-titulo">
          <h2 id="falta-titulo">O que falta</h2>
          {gaps.length === 0 ? (
            <p className="muted">Nada pendente: toda ficha tem resumo, ligação e lugar no mapa. Hora de escrever uma lenda ou abrir a wiki.</p>
          ) : (
            <ul className="world-gaps">
              {gaps.map((g) => (
                <li key={g.key}>
                  <button type="button" className="world-gap" onClick={() => go(g.view, g.id)}>
                    <span>
                      <strong>{g.text}</strong>
                      <small className="muted">{g.hint}</small>
                    </span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {grown && (
        <section className="world-card world-grow" role="status">
          <Layers size={18} aria-hidden="true" />
          <p>
            <strong>Seu mundo cresceu.</strong> No Completo aparecem campos com tipo, listas, segredos e quem sabe o quê. Nada do que você fez muda.
          </p>
          <button type="button" className="btn btn-sm" onClick={() => update((u) => ({ ...u, settings: { ...u.settings, worldLevel: 'completo' } }))}>
            Passar para o Completo
          </button>
        </section>
      )}

      <nav className="world-actions" aria-label="Atalhos do mundo">
        {!readOnly && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              // Uma lenda, carta, decreto ou canção: um texto de dentro do mundo, ligado às fichas que cita.
              let id = ''
              update((u) => {
                const [next, e] = insert(u, 'entities', draftEntity('documento', 'Nova lenda'))
                id = e.id
                return next
              })
              go('fichas', id)
            }}
          >
            <ScrollText size={16} aria-hidden="true" /> Escrever uma lenda
          </button>
        )}
        <button type="button" className="btn" onClick={() => go('relacoes')}>
          <Network size={16} aria-hidden="true" /> Ligações
        </button>
        <button type="button" className="btn" onClick={() => go('atlas')}>
          <MapIcon size={16} aria-hidden="true" /> Mapas
        </button>
        {shown('wiki') && (
          <button type="button" className="btn" onClick={() => go('wiki')}>
            <Globe size={16} aria-hidden="true" /> Wiki
          </button>
        )}
        {inbox > 0 && shown('inbox') && (
          <button type="button" className="btn" onClick={() => go('inbox')}>
            <Inbox size={16} aria-hidden="true" /> {inbox} {inbox === 1 ? 'ideia' : 'ideias'}
          </button>
        )}
      </nav>
    </div>
  )
}
