import { CloudOff, LogIn } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { Avatar } from '../social/Avatar'
import { getMyProfileCache, getNoticeCount, loadMyProfile, loadNotices, noticesSeenAt, pushChallengeWords, setNoticeCount, subscribeMyProfile, subscribeNoticeCount, unseenCount } from '../social/social'
import { todayTotal } from '../social/dailyWords'
import { todayKey } from '../logic/stats'
import { authClient, useAccount } from './auth'
import { useCloudStatus } from './useCloud'

/** Botão da conta: "Entrar", ou a foto (ou inicial) do perfil. Abre perfil, amigos e a nuvem. */
export function AccountButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const { user, server } = useAccount()
  const cloud = useCloudStatus()
  const cache = useSyncExternalStore(subscribeMyProfile, getMyProfileCache)
  const profile = user && cache?.userId === user.id ? cache.profile : null
  const userId = user?.id
  const notices = useSyncExternalStore(subscribeNoticeCount, getNoticeCount)
  const hasProfile = !!profile
  useEffect(() => {
    if (!userId || !server) return
    void authClient(server).then((sb) => loadMyProfile(sb, userId))
  }, [userId, server])
  // Avisos novos (pedidos, comentários, "quero ler", livros de amigos): confere ao abrir e a cada 3 minutos.
  useEffect(() => {
    if (!userId || !server || !hasProfile) return
    let off = false
    const check = async () => {
      if (document.hidden) return
      try {
        const sb = await authClient(server)
        const list = await loadNotices(sb, userId)
        if (!off) setNoticeCount(unseenCount(list, noticesSeenAt(userId)))
        // Palavras de hoje para os desafios de escrita em andamento.
        await pushChallengeWords(sb, userId, todayKey(), todayTotal()).catch(() => 0)
      } catch {
        // Sem a parte social no servidor: sem avisos.
      }
    }
    void check()
    const t = setInterval(() => void check(), 180_000)
    const onVisible = () => !document.hidden && void check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, server, hasProfile])

  if (!user) {
    return (
      <button type="button" data-tour="conta" className="account-btn" title="Entrar ou criar conta" aria-label="Entrar" onClick={onClick}>
        <LogIn size={16} aria-hidden="true" />
        {!compact && <span className="account-btn-label">Entrar</span>}
      </button>
    )
  }
  // Só o @ ou o começo do e-mail: o endereço inteiro estoura o topo no celular.
  const label = profile ? `@${profile.handle}` : user.email?.split('@')[0] || 'Conta'
  return (
    <button
      type="button"
      data-tour="conta"
      className="account-btn signed"
      title={`Conta: ${user.email}`}
      aria-label={`Conta: ${user.email}${notices ? ` (${notices} ${notices === 1 ? 'aviso novo' : 'avisos novos'})` : ''}`}
      onClick={onClick}
    >
      <span className="account-btn-avatar">
        <Avatar p={profile ?? { avatar: null, name: '', handle: user.email ?? '?' }} size={24} />
        {cloud.state === 'erro' && <CloudOff size={12} aria-label="Não sincronizou" className="account-btn-warn" />}
        {notices > 0 && cloud.state !== 'erro' && <span className="account-btn-dot" aria-hidden="true" />}
      </span>
      {!compact && <span className="account-btn-label">{label}</span>}
    </button>
  )
}
