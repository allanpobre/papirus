import { describe, expect, it } from 'vitest'
import type { AtlasMap } from '../model/schema'
import { daysText, modeDays, routeDays, travelDays } from './travel'

const map = {
  id: 'm', name: '', image: '', width: 1000, height: 500, createdAt: '', updatedAt: '',
  pins: [
    { id: 'a', entityId: 'A', x: 0, y: 0, label: '' },
    { id: 'b', entityId: 'B', x: 0.5, y: 0, label: '' },
    { id: 'c', entityId: 'C', x: 1, y: 0, label: '' },
  ],
  widthDays: 20,
  routes: [
    { id: 'r1', from: 'a', to: 'b', kind: 'estrada', days: null },
    { id: 'r2', from: 'b', to: 'c', kind: 'mar', days: 4 },
  ],
} as AtlasMap

describe('viagem no mapa', () => {
  it('dias pela escala ou pelo número escrito; cada jeito no seu fator', () => {
    expect(routeDays(map, map.routes![0])).toBe(10)
    expect(modeDays(map, map.routes![0], 'cavalo')).toBe(4)
    expect(modeDays(map, map.routes![1], 'pe')).toBeNull()
    expect(modeDays(map, map.routes![1], 'barco')).toBe(4)
  })
  it('o caminho mais rápido soma os trechos; sem rota, null', () => {
    expect(travelDays(map, 'a', 'c')).toBe(8)
    expect(travelDays({ ...map, routes: [] }, 'a', 'c')).toBeNull()
  })
  it('texto dos dias', () => {
    expect(daysText(1)).toBe('1 dia')
    expect(daysText(2.5)).toBe('2,5 dias')
    expect(daysText(0.5)).toBe('12 horas')
  })
})
