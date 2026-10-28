/**
 * Marca do Papirus: um rolo de papiro num ladrilho da cor de destaque. Usa as cores do
 * momento, então na mesa fica no tom do tema e no escuro se inverte sozinha.
 */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-svg">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="10" y="9" width="12" height="15" fill="var(--accent-ink)" />
      <rect x="7.5" y="6.5" width="17" height="4.6" rx="2.3" fill="var(--accent-ink)" stroke="var(--accent)" strokeWidth="1.1" />
      <rect x="7.5" y="21.2" width="17" height="4.6" rx="2.3" fill="var(--accent-ink)" stroke="var(--accent)" strokeWidth="1.1" />
      <path d="M12.5 14.4h7M12.5 17.6h5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
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
