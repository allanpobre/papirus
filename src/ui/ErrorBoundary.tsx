import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onReset?: () => void
  label?: string
  /** Quando este valor muda, o erro some e a parte tenta de novo (ex.: a tela aberta). */
  resetKey?: unknown
  /** Um jeito de sair: o botão "Voltar ao Início" (usado por uma tela que quebrou, sem derrubar o menu). */
  onHome?: () => void
  /** Mostra "Copiar detalhes" (a mensagem, o ponto do erro e a versão) para mandar a quem cuida do app. */
  copyDetails?: boolean
}

/** O texto que "Copiar detalhes" põe na área de transferência. */
export function errorDetails(error: Error, label: string | undefined, where: string): string {
  const stack = (error.stack ?? '').split('\n').slice(0, 8).join('\n')
  return [`Papirus ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`.trim(), label ?? '', `Onde: ${where}`, `Erro: ${error.message}`, stack].filter(Boolean).join('\n')
}

/**
 * Se uma parte da tela quebrar, mostra o que houve (e um jeito de sair) em vez de
 * derrubar o app inteiro numa tela vazia. Só desenha o aviso no lugar da parte que quebrou:
 * nada aqui mexe no universo, então o que já estava salvo continua como estava.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null; copied: boolean }> {
  state = { error: null as Error | null, copied: false }

  static getDerivedStateFromError(error: Error) {
    return { error, copied: false }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, copied: false })
  }

  private copy = async () => {
    const { error } = this.state
    if (!error) return
    const text = errorDetails(error, this.props.label, location.pathname + location.search)
    try {
      await navigator.clipboard.writeText(text)
      this.setState({ copied: true })
    } catch {
      // Sem permissão para copiar: deixa o texto escolhido na tela para copiar à mão.
      const pre = document.querySelector('.error-boundary pre')
      if (pre) getSelection()?.selectAllChildren(pre)
    }
  }

  render() {
    const { error, copied } = this.state
    if (!error) return this.props.children
    return (
      <div className="error-boundary" role="alert">
        <p>
          <strong>{this.props.label ?? 'Algo deu errado nesta tela.'}</strong>
        </p>
        <p className="small muted">Seu texto está salvo. Se puder, mande um print desta mensagem:</p>
        <pre className="small">{error.message}</pre>
        <div className="inline-fields">
          {this.props.onHome && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                this.setState({ error: null, copied: false })
                this.props.onHome?.()
              }}
            >
              Voltar ao Início
            </button>
          )}
          {this.props.onReset && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                this.setState({ error: null, copied: false })
                this.props.onReset?.()
              }}
            >
              Voltar
            </button>
          )}
          {this.props.copyDetails && (
            <button type="button" className="btn btn-sm" onClick={() => void this.copy()}>
              {copied ? 'Copiado' : 'Copiar detalhes'}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
