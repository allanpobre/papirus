import { Check, Sparkles } from 'lucide-react'
import { chosenOf, choose, definersFor, optionsOf } from '../logic/definers'
import { ImageButtons, Picture } from '../images/Picture'
import { ROLE_LABEL } from '../model/labels'
import { STORY_ROLES, type Entity, type StoryRole } from '../model/schema'
import { patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { GeneratedCover } from '../ui/GeneratedCover'

/*
 * O criador de personagem (Nova cara), como no começo de um RPG: o nome, o papel na história em cartas, o que
 * define a ficha neste mundo (espécie, povo…) em cartas com rosto, e o retrato. Tudo opcional; "Pronto" abre
 * a tela do personagem. Nada aqui é formulário: é escolher.
 */
const ROLE_HINT: Record<StoryRole, string> = {
  protagonista: 'A história é dela.',
  antagonista: 'Quem se opõe.',
  secundario: 'Anda junto, pesa na trama.',
  figurante: 'Aparece e passa.',
}

export function CharacterCreator({ entity: e, onDone }: { entity: Entity; onDone: () => void }) {
  const { universe, update, toast } = useWorkspace()
  const set = (changes: Partial<Entity>) => update((u) => patch(u, 'entities', e.id, changes))
  const defs = definersFor(universe, e.kind)
  return (
    <article className="entity creator" aria-label={`Criar ${e.name || 'personagem'}`}>
      <header className="creator-head">
        <p className="tiny muted">Novo personagem</p>
        <input className="creator-name" aria-label="Nome" value={e.name} placeholder="Sem nome" onChange={(ev) => set({ name: ev.target.value })} />
      </header>

      <section className="creator-step" aria-label="Papel na história">
        <h2>Papel na história</h2>
        <div className="creator-cards" role="radiogroup" aria-label="Papel na história">
          {STORY_ROLES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={e.role === r} className="creator-card is-text" onClick={() => set({ role: e.role === r ? undefined : r })}>
              <strong>{ROLE_LABEL[r]}</strong>
              <span className="tiny muted">{ROLE_HINT[r]}</span>
              {e.role === r && <Check size={16} className="creator-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      {defs.map((d) => {
        const options = optionsOf(universe, d)
        if (!options.length) return null
        const chosen = chosenOf(universe, e.id, d)?.option.id ?? null
        return (
          <section key={d.id} className="creator-step" aria-label={d.name}>
            <h2>{d.name}</h2>
            <div className="creator-cards" role="radiogroup" aria-label={d.name}>
              {options.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={chosen === o.id} className="creator-card" onClick={() => update((u) => choose(u, e.id, d, chosen === o.id ? null : o.id))}>
                  <span className="creator-face" aria-hidden="true">
                    {o.image ? <Picture value={o.image} className="creator-img" /> : <GeneratedCover name={o.name || '?'} />}
                  </span>
                  <strong>{o.name || 'Sem nome'}</strong>
                  {o.summary && <span className="tiny muted creator-sum">{o.summary}</span>}
                  {chosen === o.id && <Check size={16} className="creator-check" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </section>
        )
      })}

      <section className="creator-step" aria-label="Retrato">
        <h2>Retrato</h2>
        <div className="creator-portrait">
          <span className="creator-face is-big" aria-hidden="true">
            {e.image ? <Picture value={e.image} className="creator-img" /> : <GeneratedCover name={e.name || '?'} />}
          </span>
          <div className="row">
            <ImageButtons value={e.image ?? null} use="retrato" chooseLabel="Escolher retrato" onChange={(image) => set({ image })} onError={(m) => toast(m, { tone: 'erro' })} />
          </div>
        </div>
      </section>

      <footer className="creator-foot">
        <button type="button" className="btn btn-primary btn-lg" onClick={onDone}>
          <Sparkles size={17} aria-hidden="true" /> Pronto
        </button>
        <p className="tiny muted">Tudo dá para mudar depois, tocando na própria ficha.</p>
      </footer>
    </article>
  )
}
