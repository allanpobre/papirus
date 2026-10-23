import { CheckCircle2, PlugZap } from 'lucide-react'
import { useState } from 'react'
import { BUILD_SERVER, DEFAULT_PUBLIC_URL, isConfigured, testServer } from '../share/server'
import type { Prefs } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { Field } from '../ui/bits'

/** Onde fica o servidor do Codex ao vivo e das contas, e o endereço dos links dos jogadores. */
export function ServerCard() {
  const { prefs, setPref } = useWorkspace()
  return (
    <section className="settings-card">
      <h2 className="section-title">Servidor: contas e Codex ao vivo</h2>
      <ServerFields prefs={prefs} setPref={setPref} />
    </section>
  )
}

export function ServerFields({ prefs, setPref }: { prefs: Prefs; setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const server = prefs.server
  const effective = isConfigured(server) ? server : BUILD_SERVER

  const test = async () => {
    if (!effective) return
    setTesting(true)
    setResult(null)
    try {
      await testServer(effective)
      setResult({ ok: true, text: 'Conectado. O servidor está pronto para o Codex ao vivo.' })
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="server-fields">
      <p className="muted small">
        Contas e o Codex ao vivo usam um projeto Supabase (plano grátis). Crie o projeto, rode no SQL Editor os scripts <code>supabase/codex.sql</code> e <code>supabase/contas.sql</code> do
        repositório e cole aqui o endereço e a chave pública (em Project Settings → API).
        {BUILD_SERVER && ' Esta publicação já vem com um servidor; preencha só se quiser usar outro.'}
      </p>
      <div className="form-grid">
        <Field label="Endereço do projeto" hint="https://xxxx.supabase.co">
          {(id) => (
            <input
              id={id}
              className="input"
              inputMode="url"
              spellCheck={false}
              placeholder={BUILD_SERVER?.url ?? 'https://xxxx.supabase.co'}
              value={server.url}
              onChange={(e) => setPref('server', { ...server, url: e.target.value.trim() })}
            />
          )}
        </Field>
        <Field label="Chave pública (anon key)" hint="Pode ir no link dos jogadores: só permite ler.">
          {(id) => (
            <input id={id} className="input" spellCheck={false} placeholder="eyJ…" value={server.anonKey} onChange={(e) => setPref('server', { ...server, anonKey: e.target.value.trim() })} />
          )}
        </Field>
        <Field label="Endereço público do Papirus" hint="Onde os jogadores abrem o link." wide>
          {(id) => <input id={id} className="input" inputMode="url" spellCheck={false} placeholder={DEFAULT_PUBLIC_URL} value={prefs.publicUrl} onChange={(e) => setPref('publicUrl', e.target.value.trim())} />}
        </Field>
      </div>
      <div className="inline-fields">
        <button type="button" className="btn btn-ghost btn-sm" disabled={!effective || testing} onClick={() => void test()}>
          <PlugZap size={14} /> {testing ? 'Testando…' : 'Testar conexão'}
        </button>
        {result && (
          <span className={`small ${result.ok ? 'ok-text' : 'error-text'}`} role="status">
            {result.ok && <CheckCircle2 size={14} aria-hidden="true" />} {result.text}
          </span>
        )}
      </div>
    </div>
  )
}
