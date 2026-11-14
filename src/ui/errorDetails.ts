/** O texto que "Copiar detalhes" põe na área de transferência. */
export function errorDetails(error: Error, label: string | undefined, where: string): string {
  const stack = (error.stack ?? '').split('\n').slice(0, 8).join('\n')
  return [`Papirus ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`.trim(), label ?? '', `Onde: ${where}`, `Erro: ${error.message}`, stack].filter(Boolean).join('\n')
}
