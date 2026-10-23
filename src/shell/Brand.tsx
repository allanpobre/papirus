/** Marca do Papirus: um rolo de papiro com uma linha de tinta. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-svg">
      <rect x="5" y="6" width="20" height="21" rx="2.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M25 9.5h1.5a2.5 2.5 0 0 0 0-5H8.5A3.5 3.5 0 0 0 5 8" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.5 13h11M9.5 17h11M9.5 21h6.5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <BrandMark />
      {!compact && <span className="brand-name">Papirus</span>}
    </span>
  )
}
