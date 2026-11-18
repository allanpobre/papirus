import { describe, expect, it } from 'vitest'
import { buildWiki } from '../export/wiki'
import { ostriaUniverse } from '../model/sampleOstria'
import { readerCopy } from './readerCopy'

describe('referências das fichas: só do autor', () => {
  it('nunca vão na cópia de leitura (com ou sem segredos) nem na wiki', () => {
    const u = ostriaUniverse()
    const kael = u.entities.find((e) => e.name === 'Kael')!
    const withRefs = {
      ...u,
      entities: u.entities.map((e) =>
        e.id === kael.id
          ? { ...e, refs: [{ id: 'r1', kind: 'obra' as const, title: 'Arya Stark', image: null, url: '', text: 'A fúria quieta', took: ['personalidade'], notThis: 'Não é nobre' }] }
          : e,
      ),
    }
    for (const show of [false, true]) {
      const copy = readerCopy(withRefs, show)
      expect(copy.entities.find((e) => e.id === kael.id)?.refs).toBeUndefined()
      expect(JSON.stringify(copy)).not.toContain('Arya Stark')
    }
    const { html } = buildWiki(withRefs, { upTo: null, images: new Map() })
    expect(html).not.toContain('Arya Stark')
    expect(html).not.toContain('A fúria quieta')
  })
})
