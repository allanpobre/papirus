import { ARCHIVIST_SYSTEM } from '../logic/archivistContext'

export const ARCHIVIST_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (padrão)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (mais barato)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (o mais barato)' },
] as const

export interface ArchivistConfig {
  apiKey: string
  model: string
  effort: 'low' | 'medium' | 'high'
}

export interface ArchivistAnswer {
  text: string
  model: string
  refused: boolean
  inputTokens: number
  outputTokens: number
}

export class ArchivistError extends Error {}

/**
 * Pergunta ao Claude, direto do navegador, com a chave do próprio autor.
 * Só é chamado por ação explícita. O SDK é carregado sob demanda.
 */
export async function askArchivist(config: ArchivistConfig, context: string, question: string): Promise<ArchivistAnswer> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // Sem servidor: a chave é do autor e fica neste navegador.
  const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })

  try {
    const response = await client.beta.messages.create({
      model: config.model,
      max_tokens: 16000,
      output_config: { effort: config.effort },
      // Se o modelo recusar por política, o servidor tenta outro modelo adequado.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: ARCHIVIST_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `<registros>\n${context}\n</registros>` },
            { type: 'text', text: question },
          ],
        },
      ],
    })

    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    return {
      text,
      model: response.model,
      refused: response.stop_reason === 'refusal',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ArchivistError('A chave de API foi recusada. Confira a chave nos ajustes do Archivist.')
    if (error instanceof Anthropic.PermissionDeniedError) throw new ArchivistError('Esta chave não tem permissão para usar o modelo escolhido.')
    if (error instanceof Anthropic.RateLimitError) throw new ArchivistError('Limite de uso atingido. Espere um pouco e tente de novo.')
    if (error instanceof Anthropic.BadRequestError) throw new ArchivistError(`A API recusou o pedido: ${error.message}`)
    if (error instanceof Anthropic.APIConnectionError) throw new ArchivistError('Sem conexão com a API. Verifique a internet.')
    if (error instanceof Anthropic.APIError) throw new ArchivistError(`Erro da API (${error.status}): ${error.message}`)
    throw error
  }
}
