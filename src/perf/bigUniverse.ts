import type { Universe } from '../model/schema'
import { addScene, addStory, createUniverse, draftEntity, draftFact, draftRelation, draftEvent, insert, updateScene } from '../model/universe'

/** Gerador determinístico de um universo grande, para medir desempenho. */
export function bigUniverse({ entities = 600, stories = 6, scenesPerStory = 150, wordsPerScene = 1200, facts = 2000 } = {}): Universe {
  let seed = 42
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const syll = ['ka', 'el', 'mi', 'ra', 'os', 'tri', 'va', 'lor', 'il', 'sa', 'dun', 'mar', 'fen', 'gor', 'thi']
  const name = () => {
    const n = syll.slice().sort(() => rand() - 0.5).slice(0, 2 + Math.floor(rand() * 2)).join('')
    return n[0].toUpperCase() + n.slice(1)
  }
  const words = 'o a de que e do da em um para com não uma os no se na por mais as dos como mas foi ao ele das tem à seu sua ou ser quando muito há nos já está eu também só pelo pela até isso ela entre era depois sem mesmo aos ter seus quem nas me esse eles estão você tinha foram essa num nem suas meu às minha têm numa pelos elas havia seja qual será nós tenho lhe deles essas esses pelas este fosse dele mar sal vento torre porta noite'.split(' ')

  let u = createUniverse('Universo grande')
  const kinds = ['personagem', 'personagem', 'personagem', 'lugar', 'faccao', 'objeto']
  const ids: { id: string; kind: string; name: string }[] = []
  const used = new Set<string>()
  for (let i = 0; i < entities; i++) {
    let n = name()
    while (used.has(n)) n = `${n} ${name()}`
    used.add(n)
    const kind = kinds[i % kinds.length]
    let e
    ;[u, e] = insert(u, 'entities', { ...draftEntity(kind, n), summary: `Resumo de ${n}.`, aliases: rand() < 0.3 ? [`${n}inho`] : [], startYear: rand() < 0.3 ? Math.floor(rand() * 300) : null, endYear: rand() < 0.2 ? 300 + Math.floor(rand() * 100) : null })
    ids.push({ id: e.id, kind, name: n })
  }
  const people = ids.filter((e) => e.kind === 'personagem')
  const places = ids.filter((e) => e.kind === 'lugar')
  for (let i = 0; i < entities; i++) [u] = insert(u, 'relations', draftRelation(pick(ids).id, pick(ids).id, pick(['aliado de', 'inimigo de', 'filho de', 'mora em'])))
  for (let i = 0; i < 200; i++) [u] = insert(u, 'events', draftEvent(`Evento ${i}`, Math.floor(rand() * 400)))

  for (let s = 0; s < stories; s++) {
    let story
    ;[u, story] = addStory(u, `Livro ${s + 1}`)
    for (let c = 0; c < scenesPerStory; c++) {
      let scene
      ;[u, scene] = addScene(u, story.id, `Cena ${s + 1}.${c + 1}`)
      const paragraphs: string[] = []
      let para: string[] = []
      for (let w = 0; w < wordsPerScene; w++) {
        para.push(rand() < 0.04 ? pick(ids).name : pick(words))
        if (para.length > 80) {
          paragraphs.push(para.join(' ') + '.')
          para = []
        }
      }
      if (para.length) paragraphs.push(para.join(' ') + '.')
      const present = Array.from({ length: 4 }, () => pick(people).id)
      u = updateScene(u, scene.id, {
        text: paragraphs.join('\n\n'),
        doc: { type: 'doc', content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })) },
        presentIds: [...new Set(present)],
        povId: present[0],
        placeId: pick(places).id,
        date: { year: 300 + Math.floor(rand() * 60), day: 1 + Math.floor(rand() * 360) },
      })
    }
  }
  for (let i = 0; i < facts; i++) {
    const sub = pick(ids)
    ;[u] = insert(u, 'facts', draftFact({ subjectId: sub.id, predicate: pick(['tem olhos', 'nasceu em', 'serve a', 'tem idade']), value: pick(['cinzentos', 'verdes', 'Ostria', '40', '41']), canon: pick(['estabelecido', 'estabelecido', 'rumor']) }))
  }
  return u
}
