import { Minus, Plus } from 'lucide-react'
import { playKey, unlockAudio } from '../../editor/keySounds'
import type { Prefs } from '../../state/prefs'
import { useWorkspace } from '../../state/workspace'
import { Toggle } from '../../ui/bits'
import { MoreMenu } from '../../ui/MoreMenu'

const FONTS: { value: Prefs['editorFont']; label: string }[] = [
  { value: 'serifa', label: 'Serifa' },
  { value: 'sem-serifa', label: 'Sem serifa' },
  { value: 'maquina', label: 'Máquina' },
]

const WIDTHS: { value: Prefs['editorWidth']; label: string }[] = [
  { value: 'estreita', label: 'Estreita' },
  { value: 'media', label: 'Média' },
  { value: 'larga', label: 'Larga' },
]

const SOUNDS: { value: Prefs['keySound']; label: string }[] = [
  { value: 'nenhum', label: 'Nenhum' },
  { value: 'suave', label: 'Suave' },
  { value: 'maquina', label: 'Máquina' },
]

const MIN = 15
const MAX = 26

/**
 * "Aa" na barra da Página: letra, largura e foco sem sair da cena (como o Aa do Kindle e do iA Writer).
 * Vale para este aparelho, em todos os universos; o resto fica em Ajustes › Escrita.
 */
export function TextMenu({ phone }: { phone: boolean }) {
  const { prefs, setPref, go } = useWorkspace()
  return (
    <MoreMenu
      label="Texto da página"
      buttonClass="btn-icon text-menu-btn"
      button={
        <>
          <span aria-hidden="true">Aa</span>
          <span className="sr-only">Texto da página</span>
        </>
      }
      popClass="text-menu"
    >
      {(close) => (
        <>
          <div className="text-menu-row">
            <span className="text-menu-label" id="tm-size">
              Tamanho
            </span>
            <div className="text-menu-size" role="group" aria-labelledby="tm-size">
              <button type="button" className="btn-icon btn-sm" aria-label="Letra menor" disabled={prefs.editorSize <= MIN} onClick={() => setPref('editorSize', Math.max(MIN, prefs.editorSize - 1))}>
                <Minus size={15} />
              </button>
              <output className="text-menu-value" aria-live="polite">
                {prefs.editorSize}
              </output>
              <button type="button" className="btn-icon btn-sm" aria-label="Letra maior" disabled={prefs.editorSize >= MAX} onClick={() => setPref('editorSize', Math.min(MAX, prefs.editorSize + 1))}>
                <Plus size={15} />
              </button>
            </div>
          </div>
          <Choice label="Fonte" options={FONTS} value={prefs.editorFont} onPick={(v) => setPref('editorFont', v)} />
          {!phone && <Choice label="Largura" options={WIDTHS} value={prefs.editorWidth} onPick={(v) => setPref('editorWidth', v)} />}
          <div className="text-menu-toggles">
            <Toggle label="Linha no meio da tela" checked={prefs.typewriter} onChange={(v) => setPref('typewriter', v)} />
            <Toggle label="Só o parágrafo atual" checked={prefs.focusParagraph} onChange={(v) => setPref('focusParagraph', v)} />
          </div>
          <Choice
            label="Som ao digitar"
            options={SOUNDS}
            value={prefs.keySound}
            onPick={(v) => {
              setPref('keySound', v)
              if (v !== 'nenhum') {
                unlockAudio()
                playKey(v, 'letra')
              }
            }}
          />
          <p className="text-menu-foot muted tiny">
            Vale para este aparelho, em todos os universos.{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                close()
                go('config', 'escrita')
              }}
            >
              Mais em Ajustes
            </button>
          </p>
        </>
      )}
    </MoreMenu>
  )
}

function Choice<T extends string>({ label, options, value, onPick }: { label: string; options: { value: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="text-menu-row">
      <span className="text-menu-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onPick(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
