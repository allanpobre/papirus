import { draftSheet } from '../rpg/sheets'
import { systemFromTemplate } from '../rpg/systems'
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
/** Descrição do universo de exemplo; também serve para reconhecê-lo (se o autor mudar, vira dele). */
export const SAMPLE_DESCRIPTION =
  'Universo de exemplo. Um reino em ruínas, um estranho de rosto pálido, um regente com medo e uma herdeira que não sabe quem é.'

/** Descrições de versões antigas do exemplo: ao abrir, o exemplo é trocado pelo atual. */
const OLD_SAMPLE_DESCRIPTIONS = ['Universo de exemplo. Um reino em ruínas, um estranho de rosto pálido e uma herdeira que não sabe quem é.']

export const isSample = (u: Universe) => u.description === SAMPLE_DESCRIPTION || OLD_SAMPLE_DESCRIPTIONS.includes(u.description)
export const isOutdatedSample = (u: Universe) => OLD_SAMPLE_DESCRIPTIONS.includes(u.description)

export function sampleUniverse(): Universe {
  let u = createUniverse('Exemplo — As Cinzas de Ostria')
  u = {
    ...u,
    description: SAMPLE_DESCRIPTION,
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
    aliases: ['o Príncipe Perdido'],
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
  // O que a cidade vê: um estranho. Quem ele é de verdade (Vaelor) é segredo do autor.
  const homem = ent('personagem', 'Homem Pálido', {
    aliases: ['Pale Man', 'o estranho'],
    summary: 'Estranho de rosto sem cor que desceu de um navio sem nome, com uma espada embrulhada em pano.',
    description:
      'Fala pouco e paga em vidro negro. [a partir de "O retrato"]Tem os mesmos olhos cinzentos do retrato do príncipe, dado como morto na Queda.[/a partir] [segredo]É Vaelor.[/segredo]',
    editorial: 'definido',
    tags: ['estrangeiro', 'mistério'],
    fields: [
      { key: 'Olhos', value: '[a partir de "A chegada"]Cinzentos, segundo Mira[/a partir]' },
      { key: 'Arma', value: '[a partir de "A maré volta"]Lâmina de vidro negro[/a partir]' },
    ],
  })
  const kael = ent('personagem', 'Kael', {
    summary: 'Contrabandista do porto. Desconfia de todo mundo, menos da irmã.',
    description: 'Conhece cada beco das docas. [a partir de "Nas brumas"]Achou a forja de vidro negro no Vale das Brumas: alguém fez outra lâmina.[/a partir]',
    editorial: 'provisorio',
    startYear: 318,
    tags: ['porto'],
  })
  const mira = ent('personagem', 'Mira', {
    aliases: ['Mira das Docas'],
    summary: 'Irmã de Kael. Cresceu nas docas, sem saber de onde veio.',
    description:
      '[a partir de "A Torre fechada"]Foi criada por Ilsa, que a tirou da corte depois da Queda.[/a partir] [segredo]É a herdeira escondida da Casa de Vaelor.[/segredo]',
    canon: 'estabelecido',
    editorial: 'nao-decidido',
    startYear: 322,
  })
  const ilsa = ent('personagem', 'Ilsa', {
    summary: 'Guardiã da Torre de Marfim. Morreu na Queda.',
    startYear: 280,
    endYear: 341,
    editorial: 'definido',
  })
  const rhea = ent('personagem', 'Rhea', {
    summary: 'Capitã do navio sem nome. Não faz perguntas a quem paga bem.',
    description: 'Já levou e trouxe contrabando de Kael por anos. Os dois fingem que não se conhecem na frente da guarda.',
    editorial: 'provisorio',
    tags: ['mar'],
    fields: [{ key: 'Navio', value: 'Sem nome, sem bandeira' }],
  })
  const cassian = ent('personagem', 'Cassian', {
    aliases: ['o regente'],
    summary: 'Regente de Ostria desde a Queda. Nunca se sentou no trono.',
    description: 'Governa do antigo salão real. É cuidadoso, paciente e tem medo de navios sem nome. [segredo]Foi ele quem mandou incendiar o salão na noite do solstício.[/segredo]',
    editorial: 'definido',
    startYear: 305,
    tags: ['nobreza', 'antagonista'],
  })
  const odo = ent('personagem', 'Odo', {
    aliases: ['Irmão Odo'],
    summary: 'Sacerdote da Fé da Maré. Conselheiro do regente.',
    description: 'Diz em voz alta o que o povo sussurra. [a partir de "A maré volta"]Na noite da tempestade, foi visto rezando na praia, de frente para a Torre.[/a partir]',
    editorial: 'rascunho',
  })
  const anzol = ent('lugar', 'Taverna do Anzol', {
    summary: 'Taverna do porto. Cerveja ruim, conversa boa, duas portas.',
    parentId: ostria.id,
    editorial: 'definido',
  })
  const paco = ent('lugar', 'Paço do Regente', {
    summary: 'O antigo salão da casa real, hoje sede da regência.',
    parentId: ostria.id,
    editorial: 'provisorio',
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
    { povId: kael.id, placeId: ostria.id, date: { year: 359, day: 12 }, presentIds: [kael.id, vaelor.id, homem.id, mira.id], status: 'revisao', synopsis: 'O Homem Pálido chega ao porto.' },
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
  const c4 = scene(
    'O navio sem nome',
    [
      'O navio continuava no fim do cais, sem nome no casco e sem bandeira. Nenhum estivador chegava perto.',
      'Kael subiu pela corda da âncora, como nos tempos de contrabando. No convés, a capitã Rhea afiava uma faca e não pareceu surpresa.',
      '— Você é o irmão da moça das docas — disse ela. — Ele avisou que você viria.',
      '— Quem é ele?',
      'Rhea deu de ombros. — Pagou a viagem em vidro negro. Pedra que não reflete luz. Num porto como este, isso compra silêncio.',
      'Antes de descer, Kael viu no porão um baú com o brasão raspado a faca. Sobrava só a ponta de uma torre.',
    ],
    { povId: kael.id, placeId: ostria.id, date: { year: 359, day: 13 }, presentIds: [kael.id, rhea.id], status: 'rascunho', synopsis: 'Kael sobe no navio e descobre como o estranho pagou a viagem.' },
  )
  const c5 = scene(
    'O regente',
    [
      'O Paço do Regente ficava onde antes era o salão da casa real. Cassian governava dali havia dezessete anos e nunca tinha se sentado no trono.',
      'Mira entregava as redes consertadas da guarda quando ouviu o apelido que a cidade inteira repetia: o Homem Pálido.',
      '— Encontrem esse estranho antes da maré cheia — disse Cassian. — Vivo, se puderem.',
      'Ao lado dele, o Irmão Odo sorria como quem já sabe o fim de uma história. — Os mortos voltam com a maré, senhor. Eu avisei.',
      'Cassian não respondeu. Mas Mira viu a mão dele tremer sobre a mesa.',
    ],
    { povId: mira.id, placeId: paco.id, date: { year: 359, day: 13 }, presentIds: [mira.id, cassian.id, odo.id], status: 'rascunho', synopsis: 'O regente manda caçar o estranho. Mira ouve tudo.' },
  )
  const c6 = scene(
    'O retrato',
    [
      'Ilsa guardava as chaves dos andares de cima num cordão, junto ao peito. Naquela noite, deixou Mira subir sozinha.',
      'No último andar, coberto por um lençol, havia um retrato: um rapaz de olhos cinzentos, segurando uma espada escura como o fundo de um poço.',
      '— O príncipe — disse Ilsa da escada. — Morreu na Queda. Ou foi o que contaram.',
      'Mira olhou de novo para os olhos do retrato. Já tinha visto aqueles olhos. Na taverna, sob a neblina, num rosto sem cor.',
    ],
    { povId: mira.id, placeId: torre.id, date: { year: 359, day: 14 }, presentIds: [mira.id, ilsa.id], status: 'revisao', synopsis: 'Mira encontra o retrato do príncipe e reconhece os olhos.' },
  )
  const c7 = scene(
    'Duas portas',
    [
      'A guarda do regente fechou as duas portas da Taverna do Anzol ao mesmo tempo. Kael contou seis homens e nenhuma saída.',
      'Foi o Homem Pálido quem se levantou. Não sacou a espada embrulhada: só tirou o capuz. Os guardas recuaram um passo, como se tivessem visto um fantasma.',
      'Na confusão, Kael puxou o estranho pela cozinha, para o beco das redes.',
      '— Por que me ajudou? — perguntou o Homem Pálido.',
      '— Não ajudei você. Ajudei quem o regente quer pegar. — Kael cuspiu no chão. — Nesta cidade, isso é quase todo mundo de quem eu gosto.',
    ],
    { povId: kael.id, placeId: anzol.id, date: { year: 359, day: 14 }, presentIds: [kael.id, homem.id], status: 'rascunho', synopsis: 'A guarda cerca a taverna. Kael escolhe um lado.' },
  )
  const c8 = scene(
    'A maré volta',
    [
      'A tempestade chegou com a maré cheia. Kael trouxe o estranho pela trilha das falésias, e Mira abriu a porta da Torre de Marfim antes que batessem.',
      'Ilsa desceu os trezentos e doze degraus devagar, com a lamparina no alto.',
      'O Homem Pálido desembrulhou a espada. A lâmina era de vidro negro e não refletia a chama.',
      '— Alteza — disse Ilsa, e se ajoelhou.',
      'Mira olhou para Kael. Pela primeira vez desde que eram crianças, o irmão não tinha nada a dizer.',
    ],
    { povId: mira.id, placeId: torre.id, date: { year: 359, day: 15 }, presentIds: [mira.id, kael.id, ilsa.id, homem.id], status: 'ideia', synopsis: 'Na Torre, a espada é revelada e Ilsa se ajoelha.' },
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
  fact({ subjectId: homem.id, predicate: 'tem olhos', value: 'cinzentos', speakerId: mira.id, sourceSceneId: c1.id, quote: 'Mira jurou que o homem tinha olhos cinzentos', canon: 'estabelecido', editorial: 'definido' })
  fact({ subjectId: homem.id, predicate: 'pagou a viagem em', value: 'vidro negro', speakerId: rhea.id, sourceSceneId: c4.id, quote: 'Pagou a viagem em vidro negro.', canon: 'estabelecido', editorial: 'definido' })
  fact({ subjectId: cassian.id, predicate: 'quer', objectId: homem.id, value: '', sourceSceneId: c5.id, quote: 'Encontrem esse estranho antes da maré cheia', canon: 'estabelecido', editorial: 'definido', note: 'Vivo, se puderem.' })
  fact({ subjectId: homem.id, predicate: 'é', value: 'um morto que voltou com a maré', speakerId: odo.id, sourceSceneId: c5.id, quote: 'Os mortos voltam com a maré, senhor.', canon: 'rumor', editorial: 'provisorio' })
  fact({ subjectId: homem.id, predicate: 'tem os olhos do', value: 'retrato do príncipe', speakerId: mira.id, sourceSceneId: c6.id, quote: 'Já tinha visto aqueles olhos.', canon: 'estabelecido', editorial: 'definido' })
  fact({ subjectId: homem.id, predicate: 'carrega', objectId: lamina.id, value: '', sourceSceneId: c8.id, quote: 'A lâmina era de vidro negro e não refletia a chama.', canon: 'estabelecido', editorial: 'definido' })
  fact({ subjectId: ilsa.id, predicate: 'chama o estranho de', value: 'Alteza', sourceSceneId: c8.id, quote: '— Alteza — disse Ilsa, e se ajoelhou.', canon: 'estabelecido', editorial: 'definido' })
  fact({ subjectId: cassian.id, predicate: 'mandou incendiar', value: 'o salão real na noite da Queda', canon: 'secreto', editorial: 'definido', note: 'Só aparece no Livro II.' })

  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(kael.id, fOlhos.id), state: 'suspeita', sinceSceneId: c1.id })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(ilsa.id, fVivo.id), state: 'sabe' })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(mira.id, fHerdeira.id), state: 'suspeita', sinceSceneId: c2.id })

  // Sementes e mistérios
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('A espada embrulhada'),
    description: 'A espada do estranho só é revelada no fim do Livro I.',
    status: 'resolvida',
    setupSceneId: c1.id,
    payoffSceneId: c8.id,
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
      { id: crypto.randomUUID(), text: 'O baú no navio tem um brasão raspado: sobrou a ponta de uma torre.', sceneId: c4.id },
      { id: crypto.randomUUID(), text: 'O retrato do príncipe tem os mesmos olhos.', sceneId: c6.id },
      { id: crypto.randomUUID(), text: 'Ilsa o chama de “Alteza”.', sceneId: c8.id },
    ],
  })
  ;[u] = insert(u, 'seeds', { ...draftSeed('Os trezentos e doze degraus'), status: 'aberta', setupSceneId: c2.id, entityIds: [mira.id, ilsa.id] })

  // RPG: o mesmo mundo como campanha
  let sistema
  ;[u, sistema] = insert(u, 'systems', systemFromTemplate('d20-5e'))
  let grupo
  ;[u, grupo] = insert(u, 'groups', draftGroup('Mesa de sexta', sistema.id))
  const attr = (abbr: string) => sistema.attributes.find((a) => a.abbr === abbr)!.id
  const skill = (name: string) => sistema.skills.find((k) => k.name === name)!.id
  const pv = sistema.resources[0].id
  const ca = sistema.resources[1].id
  const pc = (name: string, player: string, attrs: Record<string, number>, skills: Record<string, number>, hp: number, armor: number, fields: Record<string, string>) => {
    const base = draftSheet(name, sistema, { role: 'pj', player, groupId: grupo.id })
    ;[u] = insert(u, 'sheets', {
      ...base,
      attributes: { ...base.attributes, ...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [attr(k), v])) },
      skills: { ...base.skills, ...Object.fromEntries(Object.entries(skills).map(([k, v]) => [skill(k), v])) },
      resources: { ...base.resources, [pv]: { current: hp, max: hp }, [ca]: { current: armor, max: armor } },
      fields: { ...base.fields, ...fields },
    })
  }
  pc('Brisa', 'Ana', { FOR: 8, DES: 16, CON: 12, INT: 13, SAB: 10, CAR: 14 }, { Furtividade: 4, Prestidigitação: 2, Percepção: 2, Enganação: 2 }, 22, 14, { 'Classe e nível': 'Ladina 3', Raça: 'Meio-elfa', Antecedente: 'Criminosa' })
  pc('Taren', 'Bruno', { FOR: 16, DES: 10, CON: 15, INT: 8, SAB: 12, CAR: 10 }, { Atletismo: 2, Intimidação: 2, Sobrevivência: 2 }, 31, 17, { 'Classe e nível': 'Guerreiro 3', Raça: 'Humano', Antecedente: 'Soldado' })
  pc('Ilmar', 'Carla', { FOR: 9, DES: 12, CON: 13, INT: 17, SAB: 12, CAR: 10 }, { Arcanismo: 2, História: 2, Investigação: 2 }, 17, 12, { 'Classe e nível': 'Mago 3', Raça: 'Elfo', Antecedente: 'Sábio' })
  {
    const base = draftSheet('Kael (contrabandista)', sistema, { role: 'npc', groupId: grupo.id, entityId: kael.id })
    ;[u] = insert(u, 'sheets', {
      ...base,
      attributes: { ...base.attributes, [attr('DES')]: 14, [attr('CAR')]: 12 },
      skills: { ...base.skills, [skill('Enganação')]: 2, [skill('Furtividade')]: 2 },
      resources: { ...base.resources, [pv]: { current: 18, max: 18 }, [ca]: { current: 13, max: 13 } },
      notes: 'Desconfiado. Ajuda os jogadores se envolverem a irmã dele.',
    })
  }
  ;[u] = insert(u, 'tables', {
    name: 'Rumores do porto',
    entries: [
      'Um navio sem nome atracou ontem à noite.',
      'A luz na Torre de Marfim voltou a acender.',
      'Os sacerdotes da Maré dizem que os mortos estão voltando.',
      'Alguém está comprando vidro negro no mercado.',
      'A guarda da cidade dobrou as rondas perto das falésias.',
      'Uma menina das docas foi vista com um anel da casa real.',
    ],
  })
  let s1
  ;[u, s1] = insert(u, 'sessions', {
    ...draftSession(1, grupo.id),
    title: 'Sessão 1 — Neblina no porto',
    status: 'encerrada',
    playedOn: '2026-10-09',
    prep: 'Abrir no porto à noite. O estranho desce do navio. Se perguntarem, ninguém sabe de onde veio o navio.',
    log: [
      { id: crypto.randomUUID(), at: '20:14', text: 'Os jogadores seguiram o estranho até a taverna.', kind: 'nota' },
      { id: crypto.randomUUID(), at: '21:02', text: 'Bardo tentou ler a mente dele; falhou feio.', kind: 'nota' },
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
  // O que muda ao longo da história: no grafo, "Num ponto da história" mostra cada momento.
  const cenas = (...ids: string[]) => ({ kind: 'cenas' as const, fromYear: null, toYear: null, storyIds: [], sceneIds: ids })
  const scoped = (a: string, b: string, type: string, scope: ReturnType<typeof cenas>, extra: Partial<ReturnType<typeof draftRelation>> = {}) => {
    ;[u] = insert(u, 'relations', { ...draftRelation(a, b, type), scope, ...extra })
  }
  scoped(rhea.id, homem.id, 'trouxe', cenas(c1.id, c4.id))
  scoped(kael.id, homem.id, 'desconfia de', cenas(c1.id, c3.id, c4.id, c5.id, c6.id))
  scoped(kael.id, homem.id, 'protege', cenas(c7.id, c8.id), { note: 'Desde a briga na Taverna do Anzol.' })
  scoped(cassian.id, homem.id, 'caça', cenas(c5.id, c6.id, c7.id, c8.id), { via: [{ entityId: odo.id, role: 'com ajuda de' }] })
  scoped(mira.id, homem.id, 'reconhece', cenas(c6.id, c8.id))
  scoped(ilsa.id, homem.id, 'jura lealdade a', cenas(c8.id))
  rel(odo.id, cassian.id, 'aconselha')
  rel(kael.id, rhea.id, 'contrabandeava com')
  rel(odo.id, fe.id, 'sacerdote de')
  rel(homem.id, vaelor.id, 'é na verdade', 'secreto')
  ;[u] = insert(u, 'relations', {
    ...draftRelation(cassian.id, ostria.id, 'governa'),
    scope: { kind: 'periodo', fromYear: 341, toYear: null, storyIds: [], sceneIds: [] },
  })
  ev('Cassian assume a regência', 342, { importance: 2, entityIds: [cassian.id], placeId: paco.id, description: 'Sem herdeiro vivo, o conselho entrega a cidade ao primo distante da casa real.' })
  ev('Chegada do navio sem nome', 359, { importance: 2, entityIds: [homem.id, rhea.id], placeId: ostria.id, description: 'Um navio sem bandeira atraca no fim do cais, numa noite de neblina.' })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(mira.id, fOlhos.id), state: 'suspeita', sinceSceneId: c6.id })
  // Relações indiretas e com tempo: quem está por trás, e quando valem.
  ;[u] = insert(u, 'relations', {
    ...draftRelation(ilsa.id, mira.id, 'escondeu'),
    via: [{ entityId: casa.id, role: 'a mando de' }],
    scope: { kind: 'periodo', fromYear: 341, toYear: 358, storyIds: [], sceneIds: [] },
    note: 'Depois da Queda, Ilsa levou a menina para longe da corte.',
  })
  ;[u] = insert(u, 'relations', {
    ...draftRelation(mira.id, vaelor.id, 'teme'),
    scope: { kind: 'historia', fromYear: null, toYear: null, storyIds: [story.id], sceneIds: [] },
  })
  return u
}
