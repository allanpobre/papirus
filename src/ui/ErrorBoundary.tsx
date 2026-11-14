import { Component, type ReactNode } from 'react'
import { errorDetails } from './errorDetails'

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

/**
 * Se uma parte da tela quebrar, mostra o que houve (e um jeito de sair) em vez de
 * derrubar o app inteiro numa tela vazia. Só desenha o aviso no lugar da parte que quebrou:
 * nada aqui mexe no universo, então o que já estava salvo continua como estava.
 */
interface State {
  error: Error | null
  copied: boolean
  /** O `resetKey` com que o erro foi visto: mudou, o erro some. */
  key: unknown
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error, copied: false }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, copied: false, key: props.resetKey } : null
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
