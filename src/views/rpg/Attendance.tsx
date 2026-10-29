import { SESSION_ATTENDANCE, type Group, type Session, type Sheet } from '../../model/schema'
import { ATTENDANCE_LABEL, attendanceOf, partyOf, setAttendance } from '../../rpg/sessionLife'
import { useTablePresence } from '../../share/presence'
import { useWorkspace } from '../../state/workspace'

/**
 * Quem joga nesta sessão: cada personagem com o jogador dele, se está com o Codex aberto,
 * e a escolha de quem não veio (o mestre conduz o personagem, ou ele fica de fora).
 */
export function AttendanceList({ session, group }: { session: Session; group: Group }) {
  const { universe, update, readOnly } = useWorkspace()
  const party = partyOf(universe, group.id)
  const online = new Set(useTablePresence(group.id).map((p) => p.name))
  if (!party.length) return <p className="muted small">Nenhum personagem de jogador nesta mesa. Crie em Personagens.</p>

  return (
    <ul className="attendance" aria-label="Quem joga nesta sessão">
      {party.map((p) => {
        const a = attendanceOf(session, p.id)
        return (
          <li key={p.id} className={`attendance-row is-${a}`}>
            <span className="attendance-who">
              <strong>{p.name}</strong>
              <span className="muted small">{p.player || 'sem jogador'}</span>
              {online.has(p.name) && (
                <span className="attendance-online">
                  <span className="presence-dot" aria-hidden="true" /> no Codex agora
                </span>
              )}
            </span>
            <span className="attendance-pick" role="radiogroup" aria-label={`${p.name} nesta sessão`}>
              {SESSION_ATTENDANCE.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={a === v} disabled={readOnly} onClick={() => update((u) => setAttendance(u, session.id, p.id, v))}>
                  {ATTENDANCE_LABEL[v]}
                </button>
              ))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** No cartão do personagem, na mesa: joga, o mestre conduz ou fica de fora. */
export function AttendanceSelect({ session, sheet }: { session: Session; sheet: Sheet }) {
  const { update, readOnly } = useWorkspace()
  return (
    <select
      className="input input-sm attendance-select"
      aria-label={`${sheet.name} nesta sessão`}
      value={attendanceOf(session, sheet.id)}
      disabled={readOnly}
      onChange={(e) => update((u) => setAttendance(u, session.id, sheet.id, e.target.value as (typeof SESSION_ATTENDANCE)[number]))}
    >
      {SESSION_ATTENDANCE.map((v) => (
        <option key={v} value={v}>
          {v === 'joga' && sheet.player ? `Joga (${sheet.player})` : ATTENDANCE_LABEL[v]}
        </option>
      ))}
    </select>
  )
}
