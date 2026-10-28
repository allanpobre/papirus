import { KeyRound, ScrollText, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ARCHIVIST_MODELS, ArchivistError, askArchivist, type ArchivistConfig } from '../ai/archivist'
import { buildArchivistContext } from '../logic/archivistContext'
import { draftInbox, insert } from '../model/universe'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { Empty, Field, Select } from '../ui/bits'
import { EntityMultiPicker } from '../ui/EntityPicker'
import { PageHelp } from '../ui/PageTour'

interface Exchange {
  question: string
  answer: string
  model: string
  refused: boolean
  tokens: number
}

function readConfig(): ArchivistConfig {
  try {
    const saved = JSON.parse(recall('archivist') ?? '{}') as Partial<ArchivistConfig>
    return { apiKey: saved.apiKey ?? '', model: saved.model ?? 'claude-opus-5-5', effort: saved.effort ?? 'medium' }
  } catch {
    return { apiKey: '', model: 'claude-opus-5-5', effort: 'medium' }
  }
}

/** Renderização simples do Markdown da resposta: títulos, negrito, listas. */
function Answer({ text }: { text: string }) {
  const html = useMemo(() => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    const out: string[] = []
    let list = false
    for (const raw of text.split('\n')) {
      const line = raw.trimEnd()
      const item = line.match(/^\s*[-*]\s+(.*)/)
      if (item) {
        if (!list) out.push('<ul>')
        list = true
        out.push(`<li>${inline(item[1])}</li>`)
        continue
      }
      if (list) {
        out.push('</ul>')
        list = false
      }
      const h = line.match(/^#{1,4}\s+(.*)/)
      if (h) out.push(`<h4>${inline(h[1])}</h4>`)
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`)
    }
    if (list) out.push('</ul>')
    return out.join('')
  }, [text])
  // O texto é escapado antes de virar HTML.
  return <div className="archivist-answer" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function ArchivistView() {
  const { universe } = useWorkspace()
  const [config, setConfig] = useState<ArchivistConfig>(readConfig)
  const [showKey, setShowKey] = useState(() => !readConfig().apiKey)
  const [question, setQuestion] = useState('')
  const [includeSecrets, setIncludeSecrets] = useState(false)
  const [includeManuscript, setIncludeManuscript] = useState(false)
  const [pinned, setPinned] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Exchange[]>([])

  const saveConfig = (c: ArchivistConfig) => {
    setConfig(c)
    remember('archivist', JSON.stringify(c))
  }

  const context = useMemo(
    () => buildArchivistContext(universe, question, { includeSecrets, includeManuscript, pinnedIds: pinned }),
    [universe, question, includeSecrets, includeManuscript, pinned],
  )

  const ask = async () => {
    if (!question.trim() || !config.apiKey) return
    setBusy(true)
    setError(null)
    try {
      const a = await askArchivist(config, context.text, question.trim())
      setHistory((h) => [{ question: question.trim(), answer: a.refused ? '' : a.text, model: a.model, refused: a.refused, tokens: a.inputTokens + a.outputTokens }, ...h])
      setQuestion('')
      setPreview(false)
    } catch (err) {
      setError(err instanceof ArchivistError ? err.message : `Falha inesperada: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view archivist-view">
      <header className="view-head view-head-wide">
        <h1>Perguntar ao mundo</h1>
        <PageHelp tour="archivist" />
        <button type="button" className="btn btn-ghost" aria-expanded={showKey} onClick={() => setShowKey(!showKey)}>
          <KeyRound size={16} /> Chave e modelo
        </button>
      </header>
      <p className="muted small view-lede">
        Opcional. Pergunte sobre a sua lore: lacunas, contradições, consequências. O Archivist só lê os registros enviados, separa o registrado do inferido e
        nunca muda nada sozinho. Tudo o mais no Papirus funciona sem IA.
      </p>

      {showKey && (
        <section className="settings-card archivist-key" aria-label="Chave e modelo">
          <div className="form-grid">
            <Field label="Chave da API da Anthropic" hint="Guardada só neste navegador. Cada pergunta é cobrada na sua conta.">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-ant-…"
                  value={config.apiKey}
                  onChange={(e) => saveConfig({ ...config, apiKey: e.target.value.trim() })}
                />
              )}
            </Field>
            <Field label="Modelo">
              {(id) => <Select id={id} value={config.model} onChange={(v) => saveConfig({ ...config, model: v })} options={ARCHIVIST_MODELS.map((m) => ({ value: m.id, label: m.label }))} />}
            </Field>
            <Field label="Profundidade" hint="Mais profundidade: respostas mais cuidadosas, mais lentas e mais caras.">
              {(id) => (
                <Select<ArchivistConfig['effort']>
                  id={id}
                  value={config.effort}
                  onChange={(v) => saveConfig({ ...config, effort: v })}
                  options={[
                    { value: 'low', label: 'Rápida' },
                    { value: 'medium', label: 'Equilibrada' },
                    { value: 'high', label: 'Profunda' },
                  ]}
                />
              )}
            </Field>
          </div>
          {config.apiKey && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveConfig({ ...config, apiKey: '' })}>
              <X size={14} /> Esquecer a chave
            </button>
          )}
        </section>
      )}

      <form
        className="archivist-ask"
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
      >
        <label htmlFor="archivist-q" className="sr-only">
          Pergunta
        </label>
        <textarea
          id="archivist-q"
          className="input textarea"
          rows={3}
          placeholder="Ex.: Se Ilsa está viva, quem mais sabe disso? O que não fecha na linha do tempo da Queda?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void ask()
            }
          }}
        />
        <div className="archivist-options">
          <div className="archivist-pins">
            <EntityMultiPicker label="Incluir sempre" value={pinned} onChange={setPinned} placeholder="Fichas extras…" />
          </div>
          <label className="check">
            <input type="checkbox" checked={includeSecrets} onChange={(e) => setIncludeSecrets(e.target.checked)} /> Enviar segredos
          </label>
          <label className="check">
            <input type="checkbox" checked={includeManuscript} onChange={(e) => setIncludeManuscript(e.target.checked)} /> Enviar trechos do manuscrito
          </label>
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={preview} onClick={() => setPreview(!preview)}>
            <ScrollText size={14} /> Ver o que será enviado
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !question.trim() || !config.apiKey}>
            <Send size={15} /> {busy ? 'Consultando…' : 'Perguntar'}
          </button>
        </div>
        {!config.apiKey && <p className="muted small">Informe uma chave da API em “Chave e modelo” para perguntar.</p>}
        {context.hiddenSecrets > 0 && !includeSecrets && (
          <p className="muted small">{context.hiddenSecrets} registros secretos ficaram de fora.</p>
        )}
      </form>

      {preview && (
        <section className="archivist-preview" aria-label="Contexto que será enviado">
          <p className="eyebrow">Isto será enviado ao modelo, junto com a pergunta</p>
          <pre>{context.text}</pre>
        </section>
      )}

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {history.length === 0 ? (
        <Empty icon={<ScrollText size={32} />} title="Nenhuma pergunta ainda.">
          <p>As respostas ficam só nesta visita. Guarde em Ideias o que quiser manter.</p>
        </Empty>
      ) : (
        <ol className="archivist-history">
          {history.map((h, i) => (
            <li key={i} className="archivist-item">
              <p className="archivist-q">{h.question}</p>
              {h.refused ? (
                <p className="notice notice-error">O modelo recusou esta pergunta. Tente reformular.</p>
              ) : (
                <Answer text={h.answer} />
              )}
              <p className="muted tiny">
                {h.model} · {h.tokens.toLocaleString('pt-BR')} tokens · respostas são sugestões, não canon
              </p>
              {!h.refused && <SaveToInbox question={h.question} answer={h.answer} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function SaveToInbox({ question, answer }: { question: string; answer: string }) {
  const { update, toast } = useWorkspace()
  const [saved, setSaved] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={saved}
      onClick={() => {
        update((u) => insert(u, 'inbox', draftInbox(`Pergunta ao mundo: ${question}\n\n${answer}`, 'captura', 'Perguntar ao mundo'))[0])
        setSaved(true)
        toast('Resposta guardada em Ideias')
      }}
    >
      {saved ? 'Guardada em Ideias' : 'Guardar em Ideias'}
    </button>
  )
}
