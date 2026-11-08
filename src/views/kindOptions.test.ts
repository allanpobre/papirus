import { describe, expect, it } from 'vitest'
import { namesFromText } from './kindOptions'

describe('criar várias fichas', () => {
  it('um nome por linha, sem marcadores, sem repetir e sem linhas vazias', () => {
    expect(namesFromText('Doran\n  Selma \n\n- Orin\n• Vasco\nselma\r\nKael')).toEqual(['Doran', 'Selma', 'Orin', 'Vasco', 'Kael'])
    expect(namesFromText('   \n\n')).toEqual([])
  })
})
