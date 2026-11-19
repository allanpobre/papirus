import { generateContinent } from '../logic/continent'

/** Desenha um continente gerado num pergaminho (mar, costa, montanhas, rios e florestas) e devolve a imagem. */
export function drawContinent(seed: number): { data: string; width: number; height: number } {
  const width = 1600
  const height = 1000
  const c = generateContinent(seed)
  const cv = document.createElement('canvas')
  cv.width = width
  cv.height = height
  const g = cv.getContext('2d')!
  const P = ([x, y]: [number, number]): [number, number] => [x * width, y * height]
  // Mar com ondinhas.
  g.fillStyle = '#c9dcdc'
  g.fillRect(0, 0, width, height)
  g.strokeStyle = 'rgba(40, 90, 110, 0.18)'
  g.lineWidth = 1.5
  for (let y = 20; y < height; y += 38) {
    for (let x = (y / 38) % 2 ? 0 : 40; x < width; x += 80) {
      g.beginPath()
      g.arc(x, y, 9, Math.PI * 1.15, Math.PI * 1.85)
      g.stroke()
    }
  }
  const shape = (pts: [number, number][]) => {
    g.beginPath()
    pts.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))))
    g.closePath()
  }
  // Terra: sombra da costa, terra e contorno.
  for (const land of [c.coast, ...c.islands]) {
    shape(land)
    g.save()
    g.shadowColor = 'rgba(30, 60, 70, 0.35)'
    g.shadowBlur = 18
    g.fillStyle = '#eadfbf'
    g.fill()
    g.restore()
    g.strokeStyle = '#6b5636'
    g.lineWidth = 2.5
    g.stroke()
  }
  // Florestas: bolinhas verdes.
  for (const f of c.forests) {
    const [x, y] = P(f)
    g.fillStyle = '#7d9a63'
    g.beginPath()
    g.arc(x, y, 7, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#4f6b3c'
    g.lineWidth = 1
    g.stroke()
  }
  // Rios.
  g.strokeStyle = '#4f86a8'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const r of c.rivers) {
    g.beginPath()
    r.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))))
    g.lineWidth = 3
    g.stroke()
  }
  // Montanhas: triângulos com um lado na sombra.
  for (const m of [...c.mountains].sort((a, b) => a[1] - b[1])) {
    const [x, y] = P(m)
    const w = 22
    const h = 26
    g.fillStyle = '#b8a78a'
    g.beginPath()
    g.moveTo(x - w, y + h / 2)
    g.lineTo(x, y - h / 2)
    g.lineTo(x + w, y + h / 2)
    g.closePath()
    g.fill()
    g.fillStyle = '#8c7a5e'
    g.beginPath()
    g.moveTo(x, y - h / 2)
    g.lineTo(x + w, y + h / 2)
    g.lineTo(x + 4, y + h / 2)
    g.closePath()
    g.fill()
    g.strokeStyle = '#5a4a32'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(x - w, y + h / 2)
    g.lineTo(x, y - h / 2)
    g.lineTo(x + w, y + h / 2)
    g.stroke()
  }
  return { data: cv.toDataURL('image/jpeg', 0.85), width, height }
}
