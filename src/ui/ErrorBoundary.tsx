import { Component, type ReactNode } from 'react'

/**
 * Se uma parte da tela quebrar, mostra o que houve (e um jeito de sair) em vez de
 * derrubar o app inteiro numa tela vazia.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="error-boundary" role="alert">
        <p>
          <strong>{this.props.label ?? 'Algo deu errado nesta tela.'}</strong>
        </p>
        <p className="small muted">Seu texto está salvo. Se puder, mande um print desta mensagem:</p>
        <pre className="small">{error.message}</pre>
        <div className="inline-fields">
          {this.props.onReset && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                this.setState({ error: null })
                this.props.onReset?.()
              }}
            >
              Voltar
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
