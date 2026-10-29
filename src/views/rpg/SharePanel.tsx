import { Copy, ExternalLink, Radio, RefreshCw, Settings, Square } from 'lucide-react'
import type { Group } from '../../model/schema'
import { codexSnapshot } from '../../share/snapshot'
import { publishNow } from '../../share/useCodexSync'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { useMesaLink } from './LiveTable'

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Liga e desliga o Codex ao vivo de uma mesa, com link e QR code para os jogadores. */
export function SharePanel({ group }: { group: Group }) {
  const { universe, toast, go } = useWorkspace()
  const { server, share, link, qr, sync, starting, start: startLink, stop, copy } = useMesaLink(group)

  if (!server) {
    return (
      <section className="share-panel">
        <h3 className="section-label">
          <Radio size={14} aria-hidden="true" /> Codex ao vivo
        </h3>
        <p className="small">Os jogadores abrem um link no celular e veem cada revelação na hora. Precisa de um servidor (Supabase, plano grátis), configurado uma vez.</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go('config', 'conta')}>
          <Settings size={14} /> Configurar servidor
        </button>
      </section>
    )
  }

  const start = async () => {
    if (await startLink()) toast('Codex ao vivo. Mande o link para a mesa.')
  }

  if (!share) {
    return (
      <section className="share-panel">
        <h3 className="section-label">
          <Radio size={14} aria-hidden="true" /> Codex ao vivo
        </h3>
        <p className="small">Gera um link para a mesa. Os jogadores só veem o que está na prévia ao lado, e cada nova revelação chega na hora. Pelo link, cada um rola pela própria ficha: a rolagem aparece para você e para o grupo.</p>
        <button type="button" className="btn btn-primary btn-sm" disabled={starting} onClick={() => void start()}>
          <Radio size={14} /> {starting ? 'Ligando…' : 'Compartilhar ao vivo'}
        </button>
        {sync?.state === 'erro' && (
          <p className="notice notice-error small" role="alert">
            {sync.error}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="share-panel share-on">
      <h3 className="section-label">
        <span className={`live-dot${sync?.state === 'erro' ? ' live-error' : ''}`} aria-hidden="true" /> Codex ao vivo
      </h3>
      <p className="small share-status" aria-live="polite">
        {sync?.state === 'publicando'
          ? 'Publicando…'
          : sync?.state === 'erro'
            ? `Não publicou: ${sync.error}`
            : sync?.at
              ? `Em dia · atualizado às ${timeFmt.format(new Date(sync.at))}`
              : 'Ligado. As mudanças são publicadas sozinhas.'}
      </p>
      {sync?.state === 'erro' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void publishNow(server, group.id, share, codexSnapshot(universe, group.id))}>
          <RefreshCw size={14} /> Tentar de novo
        </button>
      )}
      <div className="share-link">
        <label htmlFor={`link-${group.id}`} className="sr-only">
          Link para os jogadores
        </label>
        <input id={`link-${group.id}`} className="input input-sm" readOnly value={link} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy()}>
          <Copy size={14} /> Copiar
        </button>
      </div>
      <div className="share-qr" role="img" aria-label="QR code do link para os jogadores" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="inline-fields">
        <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Abrir como jogador
        </a>
        <ConfirmButton className="btn btn-ghost btn-sm" title="Parar de compartilhar" question="Parar e apagar o Codex do servidor? O link deixa de funcionar." confirmLabel="Parar" onConfirm={() => void stop()}>
          <Square size={14} /> Parar
        </ConfirmButton>
      </div>
      <p className="muted tiny">
        Quem tiver o link vê este Codex e pode rolar na mesa. Em combate, aparece a ordem da iniciativa (a vida e a Defesa dos inimigos, não). Para trocar o link, pare e compartilhe de novo.
      </p>
    </section>
  )
}
