import type { SceneDoc, Universe } from './schema'
import {
  addScene,
  addStory,
  createUniverse,
  draftEntity,
  draftEvent,
  draftFact,
  draftGroup,
  draftKnowledge,
  draftRelation,
  draftRevelation,
  draftSeed,
  draftSession,
  insert,
  patch,
  updateScene,
} from './universe'

/** Documento do editor a partir de parágrafos; `---` vira separador de cena. */
export function docFromParagraphs(paragraphs: string[]): SceneDoc {
  return {
    type: 'doc',
    content: paragraphs.map((p) =>
      p === '---'
        ? { type: 'horizontalRule' }
        : { type: 'paragraph', content: p ? [{ type: 'text', text: p }] : undefined },
    ),
  }
}

const textOf = (paragraphs: string[]) => paragraphs.filter((p) => p !== '---').join('\n\n')

/**
 * Universo de exemplo, para conhecer o Papirus sem começar do zero.
 * É marcado como exemplo no nome e pode ser apagado a qualquer momento.
 */
export function sampleUniverse(): Universe {
  let u = createUniverse('Exemplo — As Cinzas de Ostria')
  u = {
    ...u,
    description:
      'Universo de exemplo. Um reino em ruínas, um estranho de rosto pálido e uma herdeira que não sabe quem é.',
    settings: { ...u.settings, calendarSuffix: 'DC', dailyWordGoal: 500 },
  }

  const ent = (kind: string, name: string, extra: Partial<ReturnType<typeof draftEntity>> = {}) => {
    const [next, e] = insert(u, 'entities', { ...draftEntity(kind, name), ...extra })
    u = next
    return e
  }

  const reino = ent('reino', 'Reino de Ostria', {
    summary: 'Reino costeiro de torres brancas, governado pela Casa de Vaelor até a Queda.',
    editorial: 'definido',
    startYear: 12,
    endYear: 341,
    tags: ['costa', 'monarquia'],
  })
  const ostria = ent('lugar', 'Ostria', {
    summary: 'A capital. Hoje, metade ruína, metade mercado.',
    description: 'Cidade portuária construída sobre falésias de calcário. Depois da Queda, os mercadores voltaram antes dos nobres.',
    parentId: reino.id,
    editorial: 'definido',
    tags: ['cidade', 'porto'],
  })
  const torre = ent('lugar', 'Torre de Marfim', {
    summary: 'Antiga biblioteca real, fechada desde a Queda.',
    parentId: ostria.id,
    editorial: 'provisorio',
  })
  const brumas = ent('lugar', 'Vale das Brumas', {
    summary: 'Vale ao norte onde a névoa não se dissipa.',
    parentId: reino.id,
    editorial: 'rascunho',
  })
  const casa = ent('faccao', 'Casa de Vaelor', {
    summary: 'A antiga casa real de Ostria.',
    canon: 'estabelecido',
    editorial: 'definido',
  })
  const vaelor = ent('personagem', 'Vaelor', {
    aliases: ['Pale Man', 'o Homem Pálido'],
    summary: 'Último príncipe da Casa de Vaelor. Dado como morto na Queda.',
    description: 'Ninguém em Ostria sabe que ele sobreviveu. Voltou com outro rosto e outro nome.',
    canon: 'secreto',
    editorial: 'definido',
    startYear: 310,
    tags: ['nobreza', 'segredo'],
    fields: [
      { key: 'Olhos', value: 'Cinzentos' },
      { key: 'Arma', value: 'Lâmina de vidro negro' },
    ],
  })
  const kael = ent('personagem', 'Kael', {
    summary: 'Contrabandista do porto. Desconfia de todo mundo, menos da irmã.',
    editorial: 'provisorio',
    startYear: 318,
    tags: ['porto'],
  })
  const mira = ent('personagem', 'Mira', {
    aliases: ['Mira das Docas'],
    summary: 'Irmã de Kael. Herdeira escondida, sem saber.',
    canon: 'secreto',
    editorial: 'nao-decidido',
    startYear: 322,
  })
  const ilsa = ent('personagem', 'Ilsa', {
    summary: 'Guardiã da Torre de Marfim. Morreu na Queda.',
    startYear: 280,
    endYear: 341,
    editorial: 'definido',
  })
  const fe = ent('religiao', 'Fé da Maré', {
    summary: 'Culto do mar; acredita que os mortos voltam com a maré.',
    editorial: 'rascunho',
  })
  const lamina = ent('artefato', 'Lâmina de vidro negro', {
    summary: 'Forjada no Vale das Brumas. Não reflete luz.',
    canon: 'lenda',
  })

  const rel = (a: string, b: string, type: string, canon: 'estabelecido' | 'secreto' | 'rumor' = 'estabelecido') => {
    ;[u] = insert(u, 'relations', { ...draftRelation(a, b, type), canon })
  }
  rel(kael.id, mira.id, 'irmão de')
  rel(vaelor.id, casa.id, 'pertence a')
  rel(mira.id, casa.id, 'herdeira de', 'secreto')
  rel(ilsa.id, torre.id, 'guardiã de')
  rel(vaelor.id, lamina.id, 'carrega')
  rel(kael.id, vaelor.id, 'desconfia de')
  rel(fe.id, ostria.id, 'é forte em', 'rumor')

  const ev = (title: string, year: number, extra: Partial<ReturnType<typeof draftEvent>> = {}) => {
    const [next, e] = insert(u, 'events', { ...draftEvent(title, year), ...extra })
    u = next
    return e
  }
  ev('Era das Torres', 12, { kind: 'era', endYear: 341, importance: 3, description: 'Os séculos da Casa de Vaelor.' })
  ev('Fundação de Ostria', 12, { importance: 3, placeId: ostria.id })
  ev('Nascimento de Vaelor', 310, { entityIds: [vaelor.id], importance: 1 })
  ev('A Queda', 341, {
    importance: 3,
    entityIds: [vaelor.id, ilsa.id, casa.id],
    placeId: ostria.id,
    description: 'Um incêndio na noite do solstício derruba a casa real. A Torre de Marfim é fechada.',
  })
  ev('Era das Cinzas', 341, { kind: 'era', endYear: 360, importance: 2 })
  ev('Retorno do Homem Pálido', 359, { entityIds: [vaelor.id], placeId: ostria.id, canon: 'secreto' })

  // Manuscrito
  let story
  ;[u, story] = addStory(u, 'Livro I — A Maré Volta')
  u = patch(u, 'stories', story.id, { synopsis: 'Um estranho chega a Ostria e a cidade lembra do que tentou esquecer.' })

  const scene = (title: string, paragraphs: string[], extra: Parameters<typeof updateScene>[2]) => {
    let s
    ;[u, s] = addScene(u, story.id, title)
    u = updateScene(u, s.id, { doc: docFromParagraphs(paragraphs), text: textOf(paragraphs), ...extra })
    return s
  }

  const c1 = scene(
    'A chegada',
    [
      'Era noite em Ostria quando o Pale Man desceu do navio. Kael o viu primeiro: um homem alto, de rosto sem cor, carregando nada além de uma espada embrulhada em pano.',
      '— Quem está aí? — perguntou Kael, sem sair da sombra das redes.',
      'O estranho parou. Por um instante, olhou para as torres brancas no alto da falésia como quem reconhece uma casa.',
      '---',
      'Mais tarde, na taverna, Mira jurou que o homem tinha olhos cinzentos. Kael disse que era impossível ver os olhos de alguém naquela neblina.',
    ],
    { povId: kael.id, placeId: ostria.id, date: { year: 359, day: 12 }, presentIds: [kael.id, vaelor.id, mira.id], status: 'revisao', synopsis: 'O Homem Pálido chega ao porto.' },
  )
  const c2 = scene(
    'A Torre fechada',
    [
      'A Torre de Marfim não abria havia dezoito anos. Mesmo assim, havia luz na janela mais alta.',
      'Mira subiu os degraus contando-os, como Ilsa ensinara quando ela era pequena. Trezentos e doze.',
      'Lá dentro, Ilsa esperava por ela.',
    ],
    { povId: mira.id, placeId: torre.id, date: { year: 359, day: 12 }, presentIds: [mira.id, ilsa.id], status: 'rascunho', synopsis: 'Mira encontra a guardiã que deveria estar morta.' },
  )
  const c3 = scene(
    'Nas brumas',
    [
      'No Vale das Brumas, Kael encontrou as marcas de uma forja antiga. O vidro negro ainda estava quente.',
      'Alguém tinha feito outra lâmina.',
    ],
    { povId: kael.id, placeId: brumas.id, date: { year: 359, day: 12 }, presentIds: [kael.id], status: 'ideia' },
  )
  let loose
  ;[u, loose] = addScene(u, null, 'Fragmento: a canção da maré')
  u = updateScene(u, loose.id, {
    doc: docFromParagraphs(['Os mortos voltam com a maré, diziam os sacerdotes da Fé da Maré. Ninguém em Ostria acreditava — até agora.']),
    text: 'Os mortos voltam com a maré, diziam os sacerdotes da Fé da Maré. Ninguém em Ostria acreditava — até agora.',
    status: 'ideia',
  })

  // Fatos e conhecimento
  const fact = (fields: Parameters<typeof draftFact>[0]) => {
    const [next, f] = insert(u, 'facts', draftFact(fields))
    u = next
    return f
  }
  const fOlhos = fact({ subjectId: vaelor.id, predicate: 'tem olhos', value: 'cinzentos', speakerId: mira.id, sourceSceneId: c1.id, quote: 'Mira jurou que o homem tinha olhos cinzentos', canon: 'estabelecido', editorial: 'definido' })
  const fVivo = fact({ subjectId: vaelor.id, predicate: 'sobreviveu à', objectId: null, value: 'Queda', canon: 'secreto', editorial: 'definido', note: 'O grande segredo do Livro I.' })
  const fHerdeira = fact({ subjectId: mira.id, predicate: 'é herdeira de', objectId: casa.id, canon: 'secreto', editorial: 'nao-decidido' })
  fact({ subjectId: ilsa.id, predicate: 'está', value: 'morta desde a Queda', canon: 'estabelecido', editorial: 'definido' })
  fact({ subjectId: ilsa.id, predicate: 'está', value: 'viva na Torre', speakerId: mira.id, sourceSceneId: c2.id, quote: 'Lá dentro, Ilsa esperava por ela.', canon: 'estabelecido', editorial: 'provisorio' })
  fact({ subjectId: fe.id, predicate: 'acredita que', value: 'os mortos voltam com a maré', sourceSceneId: loose.id, canon: 'lenda' })

  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(kael.id, fOlhos.id), state: 'suspeita', sinceSceneId: c1.id })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(ilsa.id, fVivo.id), state: 'sabe' })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(mira.id, fHerdeira.id), state: 'suspeita', sinceSceneId: c2.id })

  // Sementes e mistérios
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('A espada embrulhada'),
    description: 'A espada do estranho só é revelada no fim do Livro I.',
    setupSceneId: c1.id,
    entityIds: [vaelor.id, lamina.id],
  })
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('Quem é o Homem Pálido?', 'misterio'),
    status: 'parcial',
    description: 'Pistas apontam para a Casa de Vaelor.',
    setupSceneId: c1.id,
    entityIds: [vaelor.id],
    clues: [
      { id: crypto.randomUUID(), text: 'Olha para as torres como quem reconhece uma casa.', sceneId: c1.id },
      { id: crypto.randomUUID(), text: 'Olhos cinzentos, como os retratos da casa real.', sceneId: c1.id },
    ],
  })
  ;[u] = insert(u, 'seeds', { ...draftSeed('Os trezentos e doze degraus'), status: 'aberta', setupSceneId: c2.id, entityIds: [mira.id, ilsa.id] })

  // RPG: o mesmo mundo como campanha
  let grupo
  ;[u, grupo] = insert(u, 'groups', draftGroup('Mesa de sexta'))
  let s1
  ;[u, s1] = insert(u, 'sessions', {
    ...draftSession(1, grupo.id),
    title: 'Sessão 1 — Neblina no porto',
    status: 'encerrada',
    playedOn: '2026-10-09',
    prep: 'Abrir no porto à noite. O estranho desce do navio. Se perguntarem, ninguém sabe de onde veio o navio.',
    log: [
      { id: crypto.randomUUID(), at: '20:14', text: 'Os jogadores seguiram o estranho até a taverna.' },
      { id: crypto.randomUUID(), at: '21:02', text: 'Bardo tentou ler a mente dele; falhou feio.' },
    ],
  })
  ;[u] = insert(u, 'sessions', { ...draftSession(2, grupo.id), title: 'Sessão 2 — A Torre', prep: 'Luz na janela da Torre de Marfim. Ilsa pode aparecer se forem até lá.' })
  for (const [target, id, depth] of [
    ['entidade', ostria.id, 'completo'],
    ['entidade', kael.id, 'resumo'],
    ['entidade', vaelor.id, 'nome'],
    ['entidade', torre.id, 'resumo'],
  ] as const) {
    ;[u] = insert(u, 'revelations', { ...draftRevelation(grupo.id, target, id, s1.id), depth })
  }
  ;[u] = insert(u, 'revelations', draftRevelation(grupo.id, 'fato', fOlhos.id, s1.id))

  // Inbox
  ;[u] = insert(u, 'inbox', {
    text: 'Ideia: o navio do Pale Man não tem nome no casco. Os marinheiros do porto se recusam a chegar perto.',
    source: 'captura',
    sourceName: '',
    status: 'aberto',
  })

  void c3
  return u
}
