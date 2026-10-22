import { describe, expect, it } from 'vitest'
import { fileNameFor } from './download'

describe('fileNameFor', () => {
  it('gera nomes de arquivo seguros a partir de títulos livres', () => {
    expect(fileNameFor('A Canção de Vaelor!', 'md')).toBe('a-cancao-de-vaelor.md')
    expect(fileNameFor('   ', 'json')).toBe('sem-titulo.json')
    expect(fileNameFor('../../etc/passwd', 'md')).toBe('etcpasswd.md')
  })
})
