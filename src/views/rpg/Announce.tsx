import { Megaphone } from 'lucide-react'
import { useState } from 'react'
import { NOTICE_TONES } from '../../model/schema'
import { announce, NOTICE_PRESETS, NOTICE_TONE_LABEL, type Notice, type NoticeTone } from '../../rpg/sessionLife'
import { sendNoticeNow } from '../../share/useTableRolls'
import { useWorkspace } from '../../state/workspace'
import { Field } from '../../ui/bits'
import { EntityPicker } from '../../ui/EntityPicker'
import { Modal } from '../../ui/Modal'
import { useRpg } from './rpgContext'

/**
 * O mestre improvisa: "Um inimigo aparece!", "Emboscada!", "Pausa de 10 minutos". O aviso aparece
 * na tela inteira de cada celular, na hora, e fica no registro. Quem aparece pode ganhar o nome
 * no Codex e um lugar na iniciativa.
 */
export function AnnounceDialog({ onClose }: { onClose: () => void }) {
  const { universe, update, toast } = useWorkspace()
  const { group, activeSession } = useRpg()
  const [text, setText] = useState('')
  const [tone, setTone] = useState<NoticeTone>('aviso')
  const [who, setWho] = useState<string | null>(null)
  const [reveal, setReveal] = useState(true)
  const [fight, setFight] = useState(false)
  if (!activeSession) return null
  const known = who ? universe.revelations.some((r) => r.groupId === group.id && r.target === 'entidade' && r.targetId === who) : false

  const send = () => {
    let sent: Notice | null = null
    update((u) => {
      const [next, n] = announce(u, activeSession.id, text, tone, who ? { entityId: who, reveal: reveal && !known, fight } : null)
      sent = n
      return next
    })
    if (!sent) return
    sendNoticeNow(group.id, sent)
    toast(group.share ? 'Aviso enviado para a mesa.' : 'Aviso no registro. Para chegar aos celulares, convide os jogadores.')
    onClose()
  }

  return (
    <Modal
      title="Anunciar para a mesa"
      onClose={onClose}
      help="anunciar"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={send}>
            <Megaphone size={16} /> Anunciar
          </button>
        </>
      }
    >
      <p className="muted small">Aparece na tela inteira do celular de cada jogador, na hora, e fica no registro da sessão.</p>
      <div className="announce-presets" role="group" aria-label="Atalhos">
        {NOTICE_PRESETS.map((p) => (
          <button
            key={p.text}
            type="button"
            className={`chip announce-chip tone-${p.tone}`}
            aria-pressed={text === p.text}
            onClick={() => {
              setText(p.text)
              setTone(p.tone)
              if (who) setFight(p.tone === 'perigo')
            }}
          >
            {p.text}
          </button>
        ))}
      </div>
      <Field label="O que acontece?">
        {(id) => (
          <textarea
            id={id}
            className="input textarea"
            rows={2}
            maxLength={160}
            placeholder="Escreva o que a mesa precisa saber agora…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) send()
            }}
          />
        )}
      </Field>
      <div className="announce-tones" role="radiogroup" aria-label="Tom do aviso">
        {NOTICE_TONES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={tone === t} className={`tone-${t}`} onClick={() => setTone(t)}>
            {NOTICE_TONE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="announce-who">
        <EntityPicker
          label="Quem aparece (opcional)"
          placeholder="Buscar ou criar um personagem…"
          kinds={['personagem']}
          value={who}
          onChange={(id) => {
            setWho(id)
            setFight(tone === 'perigo')
          }}
        />
        {who && (
          <div className="announce-who-opts">
            <label className="toggle">
              <input type="checkbox" role="switch" checked={known || reveal} disabled={known} onChange={(e) => setReveal(e.target.checked)} />
              <span className="toggle-track" aria-hidden="true" />
              <span>{known ? 'A mesa já conhece' : 'Mostrar o nome no Codex'}</span>
            </label>
            <label className="toggle">
              <input type="checkbox" role="switch" checked={fight} onChange={(e) => setFight(e.target.checked)} />
              <span className="toggle-track" aria-hidden="true" />
              <span>Entra no combate (iniciativa)</span>
            </label>
          </div>
        )}
      </div>
      {text.trim() && (
        <div className={`announce-preview tone-${tone}`} aria-hidden="true">
          <span className="announce-preview-kicker">{tone === 'perigo' ? 'Perigo!' : tone === 'misterio' ? 'Algo acontece' : 'Aviso do mestre'}</span>
          <span className="announce-preview-text">{text.trim()}</span>
        </div>
      )}
    </Modal>
  )
}
