import type { Profile } from './social'

/** Foto do perfil, ou a inicial do nome quando não há foto. */
export function Avatar({ p, size = 40 }: { p: Pick<Profile, 'avatar' | 'name' | 'handle'>; size?: number }) {
  const initial = (p.name || p.handle || '?').trim().charAt(0).toUpperCase()
  return p.avatar ? (
    <img className="social-avatar" src={p.avatar} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className="social-avatar social-avatar-empty" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initial}
    </span>
  )
}
