import { recall, remember } from '../state/prefs'
import { ArrowRight, Earth, Globe, Import, Layers, ScrollText, Sprout, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { worldGaps } from '../logic/worldGaps'
import { worldLevel } from '../model/kind'
import { draftEntity, insert } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'
import { ForeignImport } from './ForeignImport'
import { suggestLinks } from '../logic/suggestLinks'
import { WORLD_LEVELS, WORLD_POINTS, worldLevelFor, worldPoints } from '../logic/play'
import { WorldStage } from '../ui/WorldStage'
import { SeedDialog } from './SeedDialog'

/** A partir de quantas fichas o Simples sugere o Completo. */
const GROWN = 50

/**
 * O Mundo no Início de cada universo: o que falta (fichas sem resumo, soltas, fora do mapa…),
 * a semente quando ainda não há fichas, atalhos (lenda, trazer de outro app, wiki) e quem
 * mais está construindo junto agora.
 */
export function WorldCard() {
  const { universe, go, update, readOnly, others } = useWorkspace()
  const full = worldLevel(universe) === 'completo'
  const gaps = useMemo(() => worldGaps(universe, { full }).slice(0, 3), [universe, full])
  const [seeding, setSeeding] = useState(false)
  // Vindo da Biblioteca por “Já tenho um mundo em outro app”: o importador já abre.
  // Lê sem apagar e apaga depois de montar: apagar aqui dentro perdia o pedido quando o React montava duas vezes.
  const [importing, setImporting] = useState(() => Boolean(recall('abrir-trazer')))
  useEffect(() => {
    if (importing) remember('abrir-trazer', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const empty = universe.entities.length === 0
  const points = useMemo(() => worldPoints(universe), [universe])
  const level = worldLevelFor(points.total)
  // Ligações que já estão escritas nas fichas (de um mundo trazido, por exemplo): o primeiro "falta" é aceitá-las.
  const written = useMemo(() => suggestLinks(universe).length, [universe])
  const grown = !full && !readOnly && (universe.entities.length >= GROWN || universe.groups.length > 0)
  const together = others.filter((o) => o.entityId)

  const newLegend = () => {
    // Uma lenda, carta, decreto ou canção: um texto de dentro do mundo, ligado às fichas que cita.
    let id = ''
    update((u) => {
      const [next, e] = insert(u, 'entities', draftEntity('documento', 'Nova lenda'))
      id = e.id
      return next
    })
    go('fichas', id)
  }

  return (
    <section className="world-card" aria-labelledby="mundo-titulo">
      {seeding && <SeedDialog onClose={() => setSeeding(false)} />}
      {importing && (
        <Modal about="Traga o mundo de outro app (Obsidian, Markdown, Kanka, World Anvil ou um .zip). As fichas entram neste universo." title="Trazer de outro app" onClose={() => setImporting(false)} size="sm">
          <ForeignImport onDone={() => setImporting(false)} />
        </Modal>
      )}
      <h2 id="mundo-titulo">
        <Earth size={16} aria-hidden="true" /> {empty ? 'Comece o mundo' : 'O que falta no mundo'}
      </h2>

      {/* O nível do mundo: o próprio mundo crescendo (de Semente a Lenda), e o caminho até o próximo é o que falta. */}
      <div className="world-level" role="group" aria-label={`Este mundo: nível ${level.n}, ${level.name}`}>
        <WorldStage level={level.n} />
        <div className="world-level-text">
          <p className="world-level-name">
            <strong>{level.name}</strong> <span className="muted small">· nível {level.n} de {WORLD_LEVELS.length}</span>
          </p>
          <span className="resource-bar" aria-hidden="true">
            <span style={{ width: `${level.to ? Math.round(((points.total - level.from) / (level.to - level.from)) * 100) : 100}%` }} />
          </span>
          <p className="tiny muted">
            {level.to ? `${points.total} pontos · faltam ${level.to - points.total} para virar ${WORLD_LEVELS[level.n].name}` : `${points.total} pontos · o mundo virou lenda`}
          </p>
          <details className="world-level-how">
            <summary className="tiny">Como o mundo cresce</summary>
            <ul className="tiny">
              {WORLD_POINTS.map((p) => (
                <li key={p.key}>
                  <span>
                    {p.label} <span className="muted">(+{p.each})</span>
                  </span>
                  <span className="tabular">{points.parts[p.key]}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      {written > 0 && !readOnly && (
        <button type="button" className="world-gap world-gap-links" onClick={() => go('relacoes')}>
          <span>
            <strong>
              {written} {written === 1 ? 'ligação escrita' : 'ligações escritas'} nas fichas, para aceitar
            </strong>
            <small className="muted">Como “irmão de” ou “serve a”: um toque vira ligação no mapa de Ligações.</small>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
      {empty ? (
        <p className="muted small">Um lugar, um povo, uma pessoa. Ou plante a semente: cinco perguntas, e o mundo ganha as primeiras fichas já ligadas.</p>
      ) : gaps.length === 0 ? (
        <p className="muted small">Nada pendente: toda ficha tem resumo, ligação e lugar no mapa.</p>
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

      {together.length > 0 && (
        <ul className="world-together-list small" aria-label="Construindo junto agora">
          {together.map((o) => {
            const where = universe.entities.find((e) => e.id === o.entityId)
            return (
              <li key={o.key}>
                <Users size={13} aria-hidden="true" /> <strong>{o.who}</strong> está em{' '}
                <button type="button" className="link-btn" onClick={() => where && go('fichas', where.id)}>
                  {where?.name || 'uma ficha'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {grown && (
        <p className="world-grow small" role="status">
          <Layers size={16} aria-hidden="true" />
          <span>
            <strong>O mundo cresceu.</strong> No Completo aparecem campos com tipo, listas, segredos e quem sabe o quê.
          </span>
          <button type="button" className="btn btn-sm" onClick={() => update((u) => ({ ...u, settings: { ...u.settings, worldLevel: 'completo' } }))}>
            Passar para o Completo
          </button>
        </p>
      )}

      <div className="world-actions">
        {empty && !readOnly && (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setSeeding(true)}>
            <Sprout size={15} aria-hidden="true" /> Plantar a semente
          </button>
        )}
        {!readOnly && (
          <button type="button" className="btn btn-sm" onClick={newLegend}>
            <ScrollText size={15} aria-hidden="true" /> Escrever uma lenda
          </button>
        )}
        {!readOnly && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setImporting(true)}>
            <Import size={15} aria-hidden="true" /> Trazer de outro app
          </button>
        )}
        {!empty && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => go('wiki')}>
            <Globe size={15} aria-hidden="true" /> Wiki
          </button>
        )}
      </div>
    </section>
  )
}
