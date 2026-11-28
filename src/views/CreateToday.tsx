import { Castle, CalendarRange, ChevronDown, Dices, GitBranch, Gem, Map as MapIcon, MapPin, PawPrint, Plus, User, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { useState } from 'react'
import { recall, remember } from '../state/prefs'
import { useMediaQuery } from '../ui/useMediaQuery'
import { kindPlural } from '../model/labels'
import type { Universe } from '../model/schema'

type Tile = { key: string; label: string; icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>; kind?: string; go?: 'atlas' | 'timeline' | 'arvore' | 'tabela'; count: (u: Universe) => number | null }

const ofKind = (k: string) => (u: Universe) => u.entities.filter((e) => e.kind === k).length

const TILES: Tile[] = [
  { key: 'personagem', label: 'Personagem', icon: User, kind: 'personagem', count: ofKind('personagem') },
  { key: 'faccao', label: 'Facção', icon: Users, kind: 'faccao', count: ofKind('faccao') },
  { key: 'reino', label: 'Reino', icon: Castle, kind: 'reino', count: ofKind('reino') },
  { key: 'artefato', label: 'Item', icon: Gem, kind: 'artefato', count: ofKind('artefato') },
  { key: 'lugar', label: 'Lugar', icon: MapPin, kind: 'lugar', count: ofKind('lugar') },
  { key: 'especie', label: 'Espécie', icon: PawPrint, kind: 'especie', count: ofKind('especie') },
  { key: 'arvore', label: 'Árvore', icon: GitBranch, go: 'arvore', count: () => null },
  { key: 'tabela', label: 'Tabela', icon: Dices, go: 'tabela', count: (u) => u.tables.length },
  { key: 'mapa', label: 'Mapa', icon: MapIcon, go: 'atlas', count: (u) => u.maps.length },
  { key: 'tempo', label: 'Linha do tempo', icon: CalendarRange, go: 'timeline', count: (u) => u.events.length },
]

/**
 * "O que vamos criar hoje?": os tipos mais usados num toque, no alto das Fichas. Cada um mostra quantos já existem
 * e, se faltar resumo, avisa. Pode ser fechado; fica fechado neste aparelho.
 */
export function CreateToday({ universe, onKind, onGo, onMore }: { universe: Universe; onKind: (kind: string) => void; onGo: (view: 'atlas' | 'timeline' | 'arvore' | 'tabela') => void; onMore: () => void }) {
  // No celular a lista vem primeiro: a grade começa fechada (um toque abre); no computador, aberta.
  const phone = useMediaQuery('(max-width: 760px)')
  const saved = recall('criar-hoje')
  const [chosen, setChosen] = useState<boolean | null>(saved === 'aberto' ? true : saved === 'fechado' ? false : null)
  const open = chosen ?? !phone
  const toggle = () => {
    setChosen(!open)
    remember('criar-hoje', open ? 'fechado' : 'aberto')
  }
  return (
    <section className="create-today" aria-label="O que vamos criar hoje?">
      <button type="button" className="create-today-head" aria-expanded={open} onClick={toggle}>
        <span>O que vamos criar hoje?</span>
        <ChevronDown size={16} aria-hidden="true" className={open ? 'is-open' : ''} />
      </button>
      {open && (
        <div className="create-today-grid">
          {TILES.map((t) => {
            const n = t.count(universe)
            const bare = t.kind ? universe.entities.filter((e) => e.kind === t.kind && !e.summary.trim()).length : 0
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                className="create-tile"
                style={t.kind ? ({ '--k': `var(--kind-${t.kind})` } as React.CSSProperties) : undefined}
                aria-label={t.kind ? `Nova ficha: ${t.label}` : t.label}
                title={t.kind ? `Criar: ${kindPlural(t.kind).toLowerCase()} (${n} já no mundo)` : undefined}
                onClick={() => (t.kind ? onKind(t.kind) : onGo(t.go!))}
              >
                <Icon size={22} aria-hidden />
                <b>{t.label}</b>
                <small>{t.key === 'arvore' ? 'tipos, ordens, cidades…' : t.key === 'tabela' ? (n ? `${n} para rolar` : 'rumores, nomes…') : n ? `${n}${bare ? ` · ${bare} sem resumo` : ''}` : 'nenhum ainda'}</small>
              </button>
            )
          })}
          <button type="button" className="create-tile is-more" aria-label="Mais tipos de ficha" onClick={onMore}>
            <Plus size={22} aria-hidden />
            <b>Mais</b>
            <small>Cultura, magia, lenda…</small>
          </button>
        </div>
      )}
    </section>
  )
}
