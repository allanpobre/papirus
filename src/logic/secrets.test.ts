import { describe, expect, it } from 'vitest'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { patch } from '../model/universe'
import { buildArchivistContext } from './archivistContext'
import { codexMarkdown } from './codex'
import { countSecrets, nearMissSecretMarks, splitSecrets, stripSecrets, stripSecretsAcross, unclosedSecrets, wrapSecret } from './secrets'

const text = 'Cidade portuária. [segredo]O rei está vivo sob a Torre.[/segredo] Mercado forte.\n\n[SEGREDO]Linha inteira secreta.[/SEGREDO]\n\nFim.'

describe('trechos secretos', () => {
  it('separa partes públicas e secretas', () => {
    expect(splitSecrets(text).filter((p) => p.secret).map((p) => p.text)).toEqual(['O rei está vivo sob a Torre.', 'Linha inteira secreta.'])
    expect(countSecrets(text)).toBe(2)
  })

  it('remove os segredos sem deixar buracos', () => {
    expect(stripSecrets(text)).toBe('Cidade portuária. Mercado forte.\n\nFim.')
  })

  it('envolve uma seleção com as marcações', () => {
    expect(wrapSecret('abc def', 4, 7)).toEqual({ text: 'abc [segredo]def[/segredo]', cursor: 26 })
    expect(wrapSecret('abc', 3, 3).text).toBe('abc[segredo][/segredo]')
  })

  it('o Codex nunca mostra trechos secretos, mesmo revelando a ficha inteira', () => {
    let u = sampleUniverse()
    const ostria = u.entities.find((e) => e.name === 'Ostria')!
    u = patch(u, 'entities', ostria.id, { description: text })
    const md = codexMarkdown(u, u.groups[0].id)
    expect(md).toContain('Mercado forte.')
    expect(md).not.toContain('rei está vivo')
    expect(md).not.toContain('[segredo]')
  })

  it('o Archivist só recebe segredos de trecho se o autor pedir', () => {
    let u = sampleUniverse()
    const ostria = u.entities.find((e) => e.name === 'Ostria')!
    u = patch(u, 'entities', ostria.id, { description: text })
    expect(buildArchivistContext(u, 'Ostria', { includeSecrets: false, includeManuscript: false }).text).not.toContain('rei está vivo')
    expect(buildArchivistContext(u, 'Ostria', { includeSecrets: true, includeManuscript: false }).text).toContain('rei está vivo')
  })
})

describe('segredo seguro por padrão (auditoria 23)', () => {
  it('uma marca aberta sem fechar esconde até o fim do parágrafo (e não vaza)', () => {
    expect(stripSecrets('Ela chegou. [segredo]É a rainha disfarçada. Depois partiu.')).toBe('Ela chegou.')
    expect(stripSecrets('Ela chegou. [segredo]É a rainha.\nOutro parágrafo.')).toBe('Ela chegou.\nOutro parágrafo.')
    expect(unclosedSecrets('a [segredo]b')).toBe(1)
    expect(unclosedSecrets('a [segredo]b[/segredo]')).toBe(0)
  })
  it('aceita maiúsculas, espaços e plural na marca', () => {
    expect(stripSecrets('Oi [ Segredo ]x[/ SEGREDO ] fim')).toBe('Oi fim')
    expect(stripSecrets('Oi [segredos]x[/segredos] fim')).toBe('Oi fim')
  })
  it('uma marca de fechar sozinha some, sem esconder nada', () => {
    expect(stripSecrets('Oi [/segredo] fim')).toBe('Oi fim')
  })
  it('aponta marcas parecidas que não valem ("[segrdo]")', () => {
    expect(nearMissSecretMarks('a [segrdo]b[/segrdo] c [sgredo]')).toEqual(['[segrdo]', '[/segrdo]', '[sgredo]'])
    expect(nearMissSecretMarks('a [segredo]b[/segredo] [capítulo]')).toEqual([])
  })
  it('um segredo aberto num pedaço (negrito) e fechado noutro não vaza o meio', () => {
    expect(stripSecretsAcross(['Antes [segredo]um ', 'meio', ' fim[/segredo] depois'])).toEqual(['Antes ', '', ' depois'])
  })
})

describe('o livro que sai não leva os trechos [segredo] das cenas', () => {
  it('EPUB, Word e Markdown sem o trecho, e a marca sem fechar também não vaza', async () => {
    const { bookFrom, bookToMarkdown } = await import('../export/exportBook')
    const { ostriaUniverse } = await import('../model/sampleOstria')
    const u = ostriaUniverse()
    const { scenesOf } = await import('../model/universe')
    const story = u.stories[0]
    const sc = scenesOf(u, story.id)[0]
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kael viu o porto. [segredo]Ele é o ZQX escondido.[/segredo] Fim.' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Depois [segredo]sem fechar o WQY.' }] }] }
    const com = { ...u, scenes: u.scenes.map((s) => (s.id === sc.id ? { ...s, doc, text: 'Kael viu o porto. [segredo]Ele é o ZQX escondido.[/segredo] Fim.\nDepois [segredo]sem fechar o WQY.' } : s)) }
    const md = bookToMarkdown(bookFrom(com as typeof u, story))
    expect(md).toContain('Kael viu o porto.')
    expect(md).not.toContain('ZQX')
    expect(md).not.toContain('WQY')
    expect(md).not.toContain('[segredo]')
  })
})
