import { ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient, useAccount } from '../account/auth'
import { cleanCloudImages, cleanLocalImages, localImageStats } from '../images/cleanup'
import { cloudUsage, QUOTA_BYTES } from '../images/cloud'
import { markSent } from '../images/useImageSync'
import { useWorkspace } from '../state/workspace'

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: bytes < 10 * 1024 * 1024 ? 1 : 0 })} MB`

/** Imagens: quanto ocupam aqui e na conta, e limpar as que nenhum universo usa mais. */
export function ImagesCard() {
  const { library, toast } = useWorkspace()
  const account = useAccount()
  const [local, setLocal] = useState<{ count: number; bytes: number } | null>(null)
  const [cloud, setCloud] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let off = false
    void localImageStats().then((s) => !off && setLocal(s))
    if (account.user && account.server)
      void authClient(account.server)
        .then(cloudUsage)
        .then((n) => !off && setCloud(n))
        .catch(() => !off && setCloud(null))
    return () => {
      off = true
    }
  }, [account.user, account.server, tick])

  const clean = async () => {
    setBusy(true)
    try {
      const here = await cleanLocalImages(library)
      let there = { count: 0, bytes: 0 }
      if (account.user?.email && account.server) {
        const sb = await authClient(account.server)
        const res = await cleanCloudImages(sb, account.user.id, account.user.email, library)
        // Apagadas do servidor: se voltarem a ser usadas, sobem de novo.
        markSent(account.server, res.ids, false)
        there = res
      }
      const total = here.count + there.count
      toast(total ? `Pronto: ${total} ${total === 1 ? 'imagem sem uso apagada' : 'imagens sem uso apagadas'} (${mb(here.bytes + there.bytes)}).` : 'Nenhuma imagem sem uso.')
    } catch (err) {
      toast(`Não deu para limpar: ${err instanceof Error ? err.message : String(err)}`, { tone: 'erro' })
    } finally {
      setBusy(false)
      setTick((n) => n + 1)
    }
  }

  return (
    <section className="settings-card" aria-labelledby="imagens-titulo">
      <h2 id="imagens-titulo" className="section-title">
        <ImageIcon size={17} aria-hidden="true" /> Imagens
      </h2>
      <p className="small">
        Capas, retratos, mapas e imagens das cenas. Antes de guardar, o Papirus encolhe cada imagem (uma foto de celular vira uns 150 KB).
        {account.user ? ' Com a conta, elas vão para os seus outros aparelhos e para quem lê pelo link.' : ' Sem conta, ficam só neste navegador (e vão junto no backup).'}
      </p>
      <p className="small tabular">
        Neste aparelho: {local ? `${local.count} ${local.count === 1 ? 'imagem' : 'imagens'} · ${mb(local.bytes)}` : '…'}
      </p>
      {account.user && cloud !== null && (
        <div className="images-quota">
          <p className="small tabular">
            Na conta: {mb(cloud)} de {mb(QUOTA_BYTES)}
          </p>
          <span className="resource-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (cloud / QUOTA_BYTES) * 100)}%` }} />
          </span>
        </div>
      )}
      <div className="inline-fields">
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void clean()}>
          {busy ? 'Limpando…' : 'Limpar imagens sem uso'}
        </button>
      </div>
    </section>
  )
}
