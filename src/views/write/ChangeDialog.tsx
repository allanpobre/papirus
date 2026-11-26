import { useState } from 'react'
import { chosenOf, definersFor } from '../../logic/definers'
import type { MentionMatcher } from '../../logic/detection'
import type { Scene } from '../../model/schema'
import { entityName, newId, patch, sceneTitle } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'
import { Modal } from '../../ui/Modal'

/*
 * "Isto muda alguém?" ou "isto revela algo?", a partir de um trecho selecionado na cena. Mudar cria uma fase
 * da ficha que começa nesta cena, com o trecho como causa. Revelar marca que o leitor conhece a ficha aqui, ou
 * descobre aqui uma escolha do Quem é dela (a espécie verdadeira, por exemplo).
 */
export function ChangeDialog({ scene, text, paragraph, matcher, onClose }: { scene: Scene; text: string; paragraph: string; matcher: MentionMatcher | null; onClose: () => void }) {
  const { universe, update, toast, peek } = useWorkspace()
  // Quem pode ser: os citados no trecho, depois no parágrafo, o ponto de vista e os presentes.
  const ids = [...new Set([...(matcher?.find(text).map((m) => m.entityId) ?? []), ...(matcher?.find(paragraph).map((m) => m.entityId) ?? []), scene.povId, ...scene.presentIds].filter(Boolean) as string[])]
  const people = ids.map((id) => universe.entities.find((e) => e.id === id)).filter((e) => e !== undefined)
  const [who, setWho] = useState(people[0]?.id ?? '')
  const [what, setWhat] = useState<'muda' | 'revela'>('muda')
  const [name, setName] = useState('')
  const entity = universe.entities.find((e) => e.id === who)
  const choices = entity ? definersFor(universe, entity.kind).flatMap((d) => (chosenOf(universe, entity.id, d) ? [{ d, c: chosenOf(universe, entity.id, d)! }] : [])) : []
  const [reveal, setReveal] = useState('ficha')
  const here = sceneTitle(scene)

  const apply = () => {
    if (!entity) return
    if (what === 'muda') {
      update((u) => {
        const e = u.entities.find((x) => x.id === entity.id)
        return e ? patch(u, 'entities', e.id, { phases: [...(e.phases ?? []), { id: newId(), sceneId: scene.id, name: name.trim(), cause: text.trim(), nameNow: '', summary: '', image: null, fields: [] }] }) : u
      })
      toast(`Nova fase de ${entity.name} a partir de “${here}”`, { action: { label: 'Ver ficha', run: () => peek(entity.id) } })
    } else if (reveal === 'ficha') {
      update((u) => patch(u, 'entities', entity.id, { reveal: { sceneId: scene.id } }))
      toast(`O leitor conhece ${entity.name} em “${here}”`)
    } else {
      const r = universe.relations.find((x) => x.id === reveal)
      update((u) => patch(u, 'relations', reveal, { reveal: { sceneId: scene.id, maskId: r?.reveal?.maskId ?? null } }))
      toast(`O leitor descobre isso de ${entity.name} em “${here}”`, { action: { label: 'Ver ficha', run: () => peek(entity.id) } })
    }
    onClose()
  }

  return (
    <Modal
      about="Marque o que muda nesta cena (um personagem muda de lado) ou o que o leitor descobre aqui. A ficha passa a mostrar isso a partir desta cena."
      title="Muda ou revela"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!entity} onClick={apply}>
            {what === 'muda' ? 'Criar fase' : 'Marcar revelação'}
          </button>
        </>
      }
    >
      <blockquote className="change-quote small">{text.trim()}</blockquote>
      {people.length === 0 ? (
        <p className="muted small">Nenhuma ficha neste trecho. Escreva o nome de alguém (ou marque quem está na cena) e tente de novo.</p>
      ) : (
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Quem</span>
            <select className="input select" value={who} onChange={(ev) => setWho(ev.target.value)}>
              {people.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </label>
          <div className="seg" role="radiogroup" aria-label="O que este trecho faz">
            <label className="check">
              <input type="radio" name="muda-revela" checked={what === 'muda'} onChange={() => setWhat('muda')} /> Isto muda {entity?.name}
            </label>
            <label className="check">
              <input type="radio" name="muda-revela" checked={what === 'revela'} onChange={() => setWhat('revela')} /> Isto revela algo
            </label>
          </div>
          {what === 'muda' ? (
            <label className="field">
              <span className="field-label">Nome da fase (opcional)</span>
              <input className="input" placeholder="Depois da queda, General…" value={name} onChange={(ev) => setName(ev.target.value)} />
            </label>
          ) : (
            <label className="field">
              <span className="field-label">O leitor descobre aqui</span>
              <select className="input select" value={reveal} onChange={(ev) => setReveal(ev.target.value)}>
                <option value="ficha">Quem é {entity?.name} (conhece a ficha)</option>
                {choices.map(({ d, c }) => (
                  <option key={c.relationId} value={c.relationId}>
                    {d.name}: {entityName(universe, c.option.id)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="muted small">{what === 'muda' ? `A fase começa em “${here}”, com este trecho como o porquê. O resto você completa na ficha.` : `Antes de “${here}”, quem lê não vê isso.`}</p>
        </div>
      )}
    </Modal>
  )
}
