import { describe, expect, it } from 'vitest'
import { markAt, markSegments, unwrapMark } from './marks'

describe('marcas de segredo e spoiler no campo de escrita', () => {
  const text = 'Mira [segredo]é filha de Vaelor[/segredo] e [a partir de "A ponte" #3f2a9c]morre[/a partir].'

  it('separa marcas, trechos secretos e spoilers', () => {
    const segs = markSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.find((s) => s.text === 'é filha de Vaelor')).toMatchObject({ secret: true, tag: false })
    expect(segs.find((s) => s.text === '[segredo]')).toMatchObject({ secret: true, tag: true })
    expect(segs.find((s) => s.text === 'morre')).toMatchObject({ reveal: true, tag: false, secret: false })
    expect(segs.find((s) => s.text.startsWith('[a partir'))).toMatchObject({ tag: true })
  })

  it('segredo dentro de spoiler vale para os dois', () => {
    const segs = markSegments('[a partir de "X"]a [segredo]b[/segredo][/a partir]')
    expect(segs.find((s) => s.text === 'b')).toMatchObject({ secret: true, reveal: true, tag: false })
  })

  it('tira o segredo onde o cursor está', () => {
    const r = markAt(text, text.indexOf('filha'), 'secret')!
    expect(unwrapMark(text, r).text).toBe('Mira é filha de Vaelor e [a partir de "A ponte" #3f2a9c]morre[/a partir].')
    expect(markAt(text, 2, 'secret')).toBeUndefined()
  })
})
