import { draftSheet } from '../rpg/sheets'
import { systemFromTemplate } from '../rpg/systems'
import { addBook, updateBook } from '../export/shelf'
import { docFromParagraphs } from './doc'
import { ITAGUAI_MAP, ITAGUAI_MAP_H, ITAGUAI_MAP_W } from './sampleMap'
import type { Universe } from './schema'
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

export { docFromParagraphs }

const plain = (paragraphs: string[]) =>
  paragraphs
    .filter((p) => p !== '---')
    .map((p) => p.replace(/_([^_]+)_/g, '$1'))
    .join('\n\n')

/** Descrição do universo de exemplo; também serve para reconhecê-lo (se o autor mudar, vira dele). */
export const SAMPLE_DESCRIPTION =
  'Universo de exemplo: O Alienista, de Machado de Assis (1882, domínio público), com a grafia de hoje. Fichas, relações, linha do tempo e mesa de RPG montadas a partir do livro.'

/** Exemplos de versões antigas do Papirus: ao abrir, são trocados pelo atual. */
const OLD_SAMPLE_DESCRIPTIONS = [
  'Universo de exemplo. Um reino em ruínas, um estranho de rosto pálido e uma herdeira que não sabe quem é.',
  'Universo de exemplo. Um reino em ruínas, um estranho de rosto pálido, um regente com medo e uma herdeira que não sabe quem é.',
]

/** Exemplo de fantasia que os testes usam (`?exemplo=ostria`): é exemplo, mas não é trocado. */
const TEST_SAMPLE_DESCRIPTION = 'Exemplo de fantasia (base dos testes). Um reino em ruínas, um estranho de rosto pálido e uma herdeira que não sabe quem é.'

export const isSample = (u: Universe) => [SAMPLE_DESCRIPTION, TEST_SAMPLE_DESCRIPTION, ...OLD_SAMPLE_DESCRIPTIONS].includes(u.description)
/** O exemplo fica só neste aparelho: sem conta, estante, compartilhar ou metas. O de testes não (é a base dos testes disso). */
export const isLocalOnly = (u: Universe) => isSample(u) && u.description !== TEST_SAMPLE_DESCRIPTION
export const isOutdatedSample = (u: Universe) => OLD_SAMPLE_DESCRIPTIONS.includes(u.description)

/**
 * Universo de exemplo, para conhecer o Papirus sem começar do zero: O Alienista inteiro,
 * com tudo o que o Papirus faz montado a partir dele. Pode ser apagado a qualquer momento.
 * O texto (cerca de 100 KB) só é baixado quando alguém abre o exemplo.
 */
export async function sampleUniverse(): Promise<Universe> {
  const { ALIENISTA } = await import('./alienistaTexto')
  return buildSample(ALIENISTA)
}

/** Abre o exemplo pedido no endereço (`?exemplo`; `?exemplo=ostria` abre o antigo, usado nos testes). */
export async function sampleFor(which: string | null): Promise<Universe> {
  if (which === 'ostria') return (await import('./sampleOstria')).ostriaUniverse()
  return sampleUniverse()
}

export function buildSample(chapters: { titulo: string; paragrafos: string[] }[]): Universe {
  let u = createUniverse('Exemplo — O Alienista')
  u = {
    ...u,
    description: SAMPLE_DESCRIPTION,
    settings: {
      ...u.settings,
      calendarSuffix: '',
      dailyWordGoal: 500,
      fieldTemplates: { personagem: ['Ofício', 'Mania (segundo o alienista)', 'O que esconde'], lugar: ['Onde fica', 'Quem frequenta'] },
    },
  }

  const ent = (kind: string, name: string, extra: Partial<ReturnType<typeof draftEntity>> = {}) => {
    const [next, e] = insert(u, 'entities', { ...draftEntity(kind, name), editorial: 'definido', ...extra })
    u = next
    return e
  }

  // ─── Lugares ─────────────────────────────────────────────────────────
  const itaguai = ent('lugar', 'Itaguaí', {
    summary: 'Vila do Brasil colonial, perto do Rio de Janeiro. Sem imprensa: as notícias correm por cartaz ou matraca.',
    tags: ['vila', 'Brasil colônia'],
    fields: [{ key: 'Onde fica', value: 'Capitania do Rio de Janeiro' }],
  })
  const casaVerde = ent('lugar', 'Casa Verde', {
    aliases: ['o hospício', 'o asilo', 'casa de Orates'],
    summary: 'O hospício do Dr. Bacamarte, na rua Nova. Cinquenta janelas verdes por lado e um pátio no centro.',
    description:
      'O nome vem da cor das janelas, as primeiras verdes de Itaguaí. [a partir de "O terror"]Para a vila, virou “cárcere privado”.[/a partir] [a partir de "O assombro de Itaguaí"]Um dia, quatro quintos da população estavam lá dentro.[/a partir]',
    parentId: itaguai.id,
    tags: ['hospício'],
    fields: [{ key: 'Quem frequenta', value: 'Os loucos de Itaguaí, segundo a teoria do momento' }],
  })
  const ruaNova = ent('lugar', 'Rua Nova', { summary: 'A rua mais bela de Itaguaí naquele tempo. Ali fica a Casa Verde.', parentId: itaguai.id })
  const botica = ent('lugar', 'Botica de Crispim Soares', { aliases: ['a botica'], summary: 'Onde o boticário ouve tudo e não decide nada.', parentId: itaguai.id })
  const casaCamara = ent('lugar', 'Casa da Câmara', { summary: 'Onde os vereadores se reúnem. Porfírio a toma depois da revolta.', parentId: itaguai.id })
  const matriz = ent('lugar', 'Igreja Matriz', { summary: 'A igreja do padre Lopes, no largo.', parentId: itaguai.id })
  const rio = ent('lugar', 'Rio de Janeiro', {
    summary: 'Sede do governo. D. Evarista sonhava conhecê-lo.',
    description: '[a partir de "O terror"]Ela volta encantada: o Passeio Público, a rua das Belas Noites, o chafariz das Marrecas.[/a partir]',
  })

  // ─── Grupos ──────────────────────────────────────────────────────────
  const camara = ent('faccao', 'Câmara de Itaguaí', {
    aliases: ['a câmara', 'os vereadores', 'a vereança'],
    summary: 'Os vereadores da vila. Aprovam a Casa Verde e o imposto dos penachos nos enterros.',
  })
  const canjicas = ent('faccao', 'Os Canjicas', {
    aliases: ['revolta dos Canjicas', 'Canjicas'],
    summary: 'Os revoltosos que marcharam contra a Casa Verde, chamados pelo apelido do barbeiro que os liderava.',
  })
  const dragoes = ent('faccao', 'Dragões', {
    aliases: ['os dragões', 'corpo de dragões'],
    summary: 'A tropa mandada contra os revoltosos.',
    description: '[a partir de "O inesperado"]Um terço deles passa para o lado da rebelião; depois, o resto.[/a partir]',
  })

  // ─── Ideias ──────────────────────────────────────────────────────────
  const teoria1 = ent('conceito', 'Teoria do equilíbrio', {
    aliases: ['a teoria nova', 'teoria nova'],
    summary: '“A razão é o perfeito equilíbrio de todas as faculdades; fora daí, insânia, insânia, e só insânia.”',
    description: 'A loucura deixa de ser uma ilha perdida no oceano da razão: é um continente.',
  })
  const teoria2 = ent('conceito', 'Teoria do desequilíbrio', {
    summary: 'O normal é o desequilíbrio das faculdades; louco é quem tem o equilíbrio perfeito.',
    description: 'Aprovada pela câmara por um ano, “para o fim de ser experimentada a nova teoria psicológica”.',
  })

  // ─── Personagens ─────────────────────────────────────────────────────
  const bacamarte = ent('personagem', 'Simão Bacamarte', {
    aliases: ['Bacamarte', 'Dr. Bacamarte', 'o alienista', 'Simão'],
    summary: 'Médico, filho da nobreza da terra. Estudou em Coimbra e Pádua e voltou a Itaguaí para estudar a ciência.',
    description:
      '“A ciência é o meu emprego único; Itaguaí é o meu universo.” [a partir de "Uma teoria nova"]Desconfia de que a loucura é um continente, não uma ilha.[/a partir] [a partir de "O assombro de Itaguaí"]Inverte a teoria: louco é quem tem o equilíbrio perfeito.[/a partir] [a partir de "Plus ultra!"]Achou em si todas as qualidades de um “acabado mentecapto” e recolheu-se à Casa Verde.[/a partir] [segredo]Machado deixa no ar se ele foi o único louco de Itaguaí. Não resolva isso pelo leitor.[/segredo]',
    startYear: 1738,
    tags: ['médico', 'ciência'],
    fields: [
      { key: 'Ofício', value: 'Médico; alienista' },
      { key: 'Formação', value: 'Coimbra e Pádua' },
      { key: 'Divisa', value: '[a partir de "Plus ultra!"]Plus ultra![/a partir]' },
    ],
  })
  const evarista = ent('personagem', 'D. Evarista', {
    aliases: ['Evarista', 'D. Evarista da Costa e Mascarenhas'],
    summary: 'Esposa de Simão Bacamarte, viúva de um juiz de fora. “Não bonita nem simpática”, segundo os cronistas.',
    description:
      '[a partir de "Deus sabe o que faz!"]Definha de solidão e ganha do marido uma viagem ao Rio de Janeiro.[/a partir] [a partir de "A restauração"]É recolhida à Casa Verde por não decidir entre um colar de granada e um de safira.[/a partir]',
    fields: [{ key: 'Vestidos trazidos do Rio', value: '[a partir de "A rebelião"]Trinta e sete[/a partir]' }],
  })
  const crispim = ent('personagem', 'Crispim Soares', {
    aliases: ['Crispim', 'o boticário'],
    summary: 'Boticário da vila, amigo e confidente do alienista. Concorda com tudo.',
    description:
      '[a partir de "As angústias do boticário"]Na revolta, finge-se doente e acaba indo apoiar o barbeiro, por medo.[/a partir] [a partir de "A restauração"]É recolhido: “o terror também é pai da loucura”.[/a partir]',
    tags: ['botica'],
    fields: [{ key: 'Ofício', value: 'Boticário' }],
  })
  const cesaria = ent('personagem', 'D. Cesária', {
    aliases: ['Cesária', 'a mulher do boticário'],
    summary: 'Mulher de Crispim Soares e amiga de D. Evarista. Vai com ela ao Rio.',
    description: '[a partir de "O final do § 4º"]Recolhida pela nova teoria: tinha beleza moral demais.[/a partir]',
  })
  const lopes = ent('personagem', 'Padre Lopes', {
    aliases: ['o vigário', 'padre Lopes', 'vigário Lopes'],
    summary: 'Vigário de Itaguaí. Cultiva Dante, ri das teorias do alienista e conta a vida dos papas no almoço.',
    description:
      '[a partir de "Plus ultra!"]É ele quem diz a Bacamarte que ele tem ainda uma qualidade que realça as outras: a modéstia.[/a partir] [segredo]O boato de que nunca houve outro louco além do alienista é atribuído a ele.[/segredo]',
    fields: [{ key: 'Ofício', value: 'Vigário' }],
  })
  const porfirio = ent('personagem', 'Porfírio', {
    aliases: ['Porfírio Caetano das Neves', 'o barbeiro', 'o Canjica', 'Canjica'],
    summary: 'Barbeiro da vila. Lucrava com as sanguessugas que a Casa Verde pedia.',
    description:
      '[a partir de "A rebelião"]O apelido dele, Canjica, deu nome à revolta.[/a partir] [a partir de "O inesperado"]Torna-se “Protetor da vila em nome de Sua Majestade e do povo”.[/a partir] [a partir de "Dois lindos casos"]No poder, propõe ao alienista um meio-termo em vez de demolir a Casa Verde.[/a partir]',
    tags: ['barbearia'],
    fields: [{ key: 'Ofício', value: 'Barbeiro' }],
  })
  const pina = ent('personagem', 'João Pina', {
    aliases: ['Pina'],
    summary: 'Outro barbeiro, rival de navalha de Porfírio.',
    fields: [{ key: 'Ofício', value: 'Barbeiro' }],
  })
  const costa = ent('personagem', 'Costa', {
    summary: 'Herdou quatrocentos mil cruzados, emprestou tudo sem juros e perdoou as dívidas.',
    fields: [{ key: 'Mania (segundo o alienista)', value: 'Dissipar os cabedais' }],
  })
  const prima = ent('personagem', 'Prima do Costa', {
    summary: 'Foi interceder pelo primo e contou a praga do “sino salamão”.',
  })
  const mateus = ent('personagem', 'Mateus', {
    aliases: ['o albardeiro'],
    summary: 'Enriqueceu fazendo albardas. Passava as tardes à janela da casa nova, para ser admirado.',
    fields: [{ key: 'Mania (segundo o alienista)', value: 'Amor das pedras' }],
  })
  const martim = ent('personagem', 'Martim Brito', {
    summary: 'Rapaz de vinte e cinco anos, orador de ideias “arrojadas e sublimes”.',
    fields: [{ key: 'Mania (segundo o alienista)', value: 'Lesão cerebral (fenômeno sem gravidade)' }],
  })
  const gil = ent('personagem', 'Gil Bernardes', { summary: 'Tão cortês que levava o chapéu ao chão. Tentou fugir da vila.' })
  const coelho = ent('personagem', 'Coelho', { summary: 'Amava a palestra comprida; os conhecidos dobravam a esquina ao vê-lo.' })
  const freitas = ent('personagem', 'Sebastião Freitas', {
    aliases: ['Freitas', 'o vereador Freitas'],
    summary: 'Vereador que se apaixonou pela expressão “Bastilha da razão humana”.',
  })
  const galvao = ent('personagem', 'Galvão', {
    aliases: ['vereador Galvão'],
    summary: 'Vereador sensato: diz que a câmara não pode se excluir das próprias leis.',
    description: '[a partir de "O final do § 4º"]Por ser moderado e justo demais, é o primeiro recolhido pela nova teoria.[/a partir]',
  })
  const presidente = ent('personagem', 'Presidente da câmara', { summary: 'Defende a Casa Verde contra os revoltosos e quer “trinta almudes de sangue” como desforra.' })
  const benedita = ent('personagem', 'Benedita', { summary: 'Mucama de D. Evarista.' })
  const salustiano = ent('personagem', 'Salustiano', { summary: 'Advogado de qualidades morais e mentais perigosas: provou verdadeiro um testamento falso.' })

  // ─── Linha do tempo ──────────────────────────────────────────────────
  const ev = (title: string, year: number, extra: Partial<ReturnType<typeof draftEvent>> = {}) => {
    const [next, e] = insert(u, 'events', { ...draftEvent(title, year), ...extra })
    u = next
    return e
  }
  ev('Primeira teoria', 1783, { kind: 'era', endYear: 1785, importance: 3, description: 'Louco é quem não tem o perfeito equilíbrio das faculdades.' })
  ev('Segunda teoria', 1785, { kind: 'era', endYear: 1786, importance: 2, description: 'Louco é quem tem o perfeito equilíbrio das faculdades.' })
  ev('Nascimento de Simão Bacamarte', 1738, { importance: 1, entityIds: [bacamarte.id] })
  ev('Bacamarte volta ao Brasil', 1772, { importance: 1, entityIds: [bacamarte.id], placeId: itaguai.id, description: 'Aos trinta e quatro anos, recusando ficar em Coimbra ou em Lisboa.' })
  ev('Casamento com D. Evarista', 1778, { importance: 1, entityIds: [bacamarte.id, evarista.id] })
  ev('Inauguração da Casa Verde', 1783, { importance: 3, entityIds: [bacamarte.id], placeId: casaVerde.id, description: 'Sete dias de festa. Gente até do Rio de Janeiro.' })
  ev('Viagem de D. Evarista ao Rio', 1784, { entityIds: [evarista.id, cesaria.id], placeId: rio.id })
  ev('Revolta dos Canjicas', 1784, { importance: 3, entityIds: [porfirio.id, canjicas.id, dragoes.id], placeId: ruaNova.id, description: 'Trezentas pessoas marcham contra a Casa Verde. Onze mortos e vinte e cinco feridos.' })
  ev('João Pina derruba Porfírio', 1784, { entityIds: [pina.id, porfirio.id], placeId: itaguai.id })
  ev('Ofício: todos os loucos vão para a rua', 1785, { importance: 3, entityIds: [bacamarte.id, camara.id], placeId: casaVerde.id })
  ev('Bacamarte recolhe-se à Casa Verde', 1786, { importance: 3, entityIds: [bacamarte.id, teoria2.id], placeId: casaVerde.id })

  // ─── O livro: os treze capítulos ─────────────────────────────────────
  let story
  ;[u, story] = addStory(u, 'O Alienista')
  u = patch(u, 'stories', story.id, { synopsis: 'Um médico abre um hospício em Itaguaí e descobre loucos por toda parte. Até não sobrar ninguém.' })

  type Meta = { place: string; year: number; day?: number; present: string[]; synopsis: string }
  const META: Meta[] = [
    { place: itaguai.id, year: 1783, present: [bacamarte.id, evarista.id, crispim.id, lopes.id, camara.id, casaVerde.id], synopsis: 'Bacamarte volta a Itaguaí, casa-se e convence a câmara a construir a Casa Verde.' },
    { place: casaVerde.id, year: 1783, present: [bacamarte.id, crispim.id, lopes.id, casaVerde.id], synopsis: 'Os loucos chegam de toda parte. O alienista classifica cada caso.' },
    { place: itaguai.id, year: 1784, day: 120, present: [bacamarte.id, evarista.id, crispim.id, cesaria.id, rio.id], synopsis: 'D. Evarista definha; o marido lhe dá o Rio de Janeiro.' },
    { place: matriz.id, year: 1784, day: 140, present: [bacamarte.id, crispim.id, lopes.id, cesaria.id, teoria1.id], synopsis: 'A teoria nova: a loucura é um continente.' },
    { place: itaguai.id, year: 1784, day: 160, present: [bacamarte.id, costa.id, prima.id, mateus.id, martim.id, gil.id, coelho.id, porfirio.id, evarista.id, lopes.id, crispim.id, cesaria.id, rio.id], synopsis: 'Costa, a prima, o albardeiro, Martim Brito: a Casa Verde se enche, e a vila tem medo.' },
    { place: ruaNova.id, year: 1784, day: 170, present: [porfirio.id, freitas.id, presidente.id, camara.id, canjicas.id, evarista.id, benedita.id, bacamarte.id], synopsis: 'O barbeiro leva trezentas pessoas à porta da Casa Verde.' },
    { place: casaCamara.id, year: 1784, day: 170, present: [porfirio.id, canjicas.id, dragoes.id, camara.id, freitas.id, presidente.id, lopes.id], synopsis: 'Os dragões mudam de lado. Porfírio toma a câmara.' },
    { place: botica.id, year: 1784, day: 171, present: [crispim.id, cesaria.id, porfirio.id], synopsis: 'Crispim Soares entre o amigo e o vencedor.' },
    { place: casaVerde.id, year: 1784, day: 171, present: [bacamarte.id, porfirio.id], synopsis: 'O barbeiro propõe um acordo; o alienista vê dois casos.' },
    { place: casaVerde.id, year: 1784, day: 180, present: [pina.id, porfirio.id, freitas.id, crispim.id, presidente.id, evarista.id, lopes.id, camara.id, canjicas.id], synopsis: 'A ordem volta, e a Casa Verde recolhe quem quer, até D. Evarista.' },
    { place: casaVerde.id, year: 1785, present: [bacamarte.id, camara.id, casaVerde.id], synopsis: 'Quatro quintos da vila estão na Casa Verde. O alienista solta todos.' },
    { place: casaVerde.id, year: 1785, day: 60, present: [porfirio.id, pina.id, galvao.id, freitas.id, martim.id, crispim.id, cesaria.id, lopes.id, salustiano.id, evarista.id, teoria2.id], synopsis: 'A teoria ao contrário: agora são recolhidos os equilibrados.' },
    { place: casaVerde.id, year: 1786, present: [bacamarte.id, lopes.id, galvao.id, cesaria.id, crispim.id, evarista.id, teoria2.id], synopsis: 'Todos curados. Resta um caso perfeito.' },
  ]
  const STATUS: Universe['scenes'][number]['status'][] = ['pronta', 'pronta', 'pronta', 'pronta', 'pronta', 'pronta', 'revisao', 'revisao', 'pronta', 'pronta', 'rascunho', 'rascunho', 'pronta']
  const scenes = chapters.map((ch, i) => {
    let s
    ;[u, s] = addScene(u, story.id, ch.titulo)
    const m = META[i] ?? META[META.length - 1]
    u = updateScene(u, s.id, {
      doc: docFromParagraphs(ch.paragrafos),
      text: plain(ch.paragrafos),
      placeId: m.place,
      date: { year: m.year, day: m.day ?? null },
      presentIds: m.present,
      synopsis: m.synopsis,
      status: STATUS[i] ?? 'rascunho',
    })
    return s
  })
  const at = (n: number) => scenes[n - 1].id
  const cenas = (...n: number[]) => ({ kind: 'cenas' as const, fromYear: null, toYear: null, storyIds: [], sceneIds: n.map(at) })
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

  // ─── Relações: as que valem sempre e as que mudam capítulo a capítulo ─
  const rel = (a: string, b: string, type: string, extra: Partial<ReturnType<typeof draftRelation>> = {}) => {
    const [next, r] = insert(u, 'relations', { ...draftRelation(a, b, type), ...extra })
    u = next
    return r
  }
  const rEsposa = rel(evarista.id, bacamarte.id, 'esposa de')
  rel(cesaria.id, crispim.id, 'esposa de')
  rel(bacamarte.id, casaVerde.id, 'dirige')
  rel(lopes.id, itaguai.id, 'vigário de')
  const rRival = rel(porfirio.id, pina.id, 'rival de')
  rel(prima.id, costa.id, 'prima de')
  rel(evarista.id, cesaria.id, 'amiga de')
  rel(camara.id, itaguai.id, 'governa', { scope: cenas(...range(1, 6), ...range(10, 13)) })
  const rApoia = rel(crispim.id, bacamarte.id, 'concorda com', { scope: cenas(...range(1, 7), 12, 13) })
  rel(crispim.id, porfirio.id, 'adere a', { scope: cenas(8), note: 'Por medo, não por convicção.' })
  rel(lopes.id, bacamarte.id, 'desconfia de', { scope: cenas(1, 2, 4, 5) })
  rel(lopes.id, bacamarte.id, 'louva', { scope: cenas(13) })
  const rLidera = rel(porfirio.id, canjicas.id, 'lidera', { scope: cenas(6, 7) })
  rel(freitas.id, canjicas.id, 'simpatiza com', { scope: cenas(6, 7) })
  rel(dragoes.id, canjicas.id, 'passam para o lado de', { scope: cenas(7) })
  rel(porfirio.id, itaguai.id, 'governa', { scope: cenas(7, 8, 9) })
  rel(pina.id, itaguai.id, 'governa', { scope: cenas(10), via: [{ entityId: canjicas.id, role: 'com a gente mais resoluta' }] })
  rel(bacamarte.id, teoria1.id, 'defende', { scope: cenas(...range(4, 10)) })
  rel(bacamarte.id, teoria2.id, 'defende', { scope: cenas(11, 12, 13) })
  // Quem foi recolhido, e quando.
  const internou = (who: string, n: number[], note = '') => rel(bacamarte.id, who, 'recolheu à Casa Verde', { scope: cenas(...n), note })
  internou(costa.id, range(5, 10))
  internou(prima.id, range(5, 10))
  internou(mateus.id, range(5, 10), 'Amor das pedras.')
  internou(martim.id, range(5, 10))
  internou(gil.id, range(5, 10))
  internou(coelho.id, range(5, 10))
  internou(porfirio.id, [10, 12], 'Na primeira vez pelos “sintomas de duplicidade”; na segunda, por ter se emendado.')
  internou(freitas.id, [10])
  internou(crispim.id, [10])
  internou(evarista.id, [10], 'Mania suntuária.')
  internou(galvao.id, [12])
  internou(lopes.id, [12])
  internou(cesaria.id, [12])
  internou(salustiano.id, [12])
  rel(bacamarte.id, casaVerde.id, 'recolhe-se à', { scope: cenas(13), note: 'Único caso da teoria definitiva.' })

  // ─── Fatos ───────────────────────────────────────────────────────────
  const fact = (fields: Parameters<typeof draftFact>[0]) => {
    const [next, f] = insert(u, 'facts', draftFact({ canon: 'estabelecido', editorial: 'definido', ...fields }))
    u = next
    return f
  }
  fact({ subjectId: bacamarte.id, predicate: 'estudou em', value: 'Coimbra e Pádua', sourceSceneId: at(1), quote: 'Estudara em Coimbra e Pádua.' })
  fact({ subjectId: casaVerde.id, predicate: 'tem', value: 'cinquenta janelas por lado', sourceSceneId: at(1), quote: 'tinha cinquenta janelas por lado, um pátio no centro' })
  const fContinente = fact({ subjectId: bacamarte.id, predicate: 'acha que a loucura é', value: 'um continente', speakerId: bacamarte.id, sourceSceneId: at(4), quote: 'começo a suspeitar que é um continente.' })
  fact({ subjectId: casaVerde.id, predicate: 'é', value: 'um cárcere privado', speakerId: null, sourceSceneId: at(5), quote: '— A Casa Verde é um cárcere privado, disse um médico sem clínica.', canon: 'rumor', editorial: 'provisorio' })
  fact({ subjectId: canjicas.id, predicate: 'deixaram', value: 'onze mortos e vinte e cinco feridos', speakerId: porfirio.id, sourceSceneId: at(9), quote: 'onze mortos e vinte e cinco feridos.' })
  fact({ subjectId: evarista.id, predicate: 'hesitava entre', value: 'um colar de granada e um de safira', speakerId: bacamarte.id, sourceSceneId: at(10), quote: 'só hesitava entre um colar de granada e outro de safira.' })
  const fQuatro = fact({ subjectId: casaVerde.id, predicate: 'abrigava', value: 'quatro quintos da população', speakerId: bacamarte.id, sourceSceneId: at(11), quote: 'quatro quintos da população estavam aposentados naquele estabelecimento' })
  fact({ subjectId: bacamarte.id, predicate: 'tem, segundo o padre Lopes,', value: 'a modéstia', speakerId: lopes.id, sourceSceneId: at(13), quote: 'É porque tem ainda uma qualidade que realça as outras: — a modéstia.' })
  const fBoato = fact({ subjectId: bacamarte.id, predicate: 'foi', value: 'o único louco de Itaguaí', speakerId: lopes.id, sourceSceneId: at(13), quote: 'nunca houve outro louco, além dele, em Itaguaí', canon: 'rumor', editorial: 'nao-decidido', note: 'Boato. O texto não confirma nem nega.' })

  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(crispim.id, fContinente.id), state: 'sabe', sinceSceneId: at(4) })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(lopes.id, fContinente.id), state: 'suspeita', sinceSceneId: at(4) })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(camara.id, fQuatro.id), state: 'sabe', sinceSceneId: at(11) })
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(lopes.id, fBoato.id), state: 'acredita', sinceSceneId: at(13) })

  // ─── Tramas ──────────────────────────────────────────────────────────
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('O final do § 4º'),
    description: 'Uma frase no fim do ofício à câmara, que ninguém leu com atenção.',
    status: 'resolvida',
    setupSceneId: at(11),
    payoffSceneId: at(12),
    entityIds: [bacamarte.id, camara.id],
  })
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('Plus ultra!'),
    description: 'A divisa do alienista: sempre mais além. Até onde?',
    status: 'resolvida',
    setupSceneId: at(13),
    payoffSceneId: at(13),
    entityIds: [bacamarte.id],
  })
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('Quem é louco em Itaguaí?', 'misterio'),
    status: 'parcial',
    description: 'O livro não responde. As pistas apontam para todos os lados.',
    setupSceneId: at(4),
    entityIds: [bacamarte.id, casaVerde.id],
    clues: [
      { id: crypto.randomUUID(), text: 'Costa é recolhido por emprestar sem juros.', sceneId: at(5) },
      { id: crypto.randomUUID(), text: '“Quem nos afirma que o alienado não é o alienista?”', sceneId: at(6) },
      { id: crypto.randomUUID(), text: 'Quatro quintos da população estão na Casa Verde.', sceneId: at(11) },
      { id: crypto.randomUUID(), text: 'A câmara proíbe que os vereadores sejam recolhidos.', sceneId: at(12) },
      { id: crypto.randomUUID(), text: 'O padre Lopes: a modéstia realça todas as outras qualidades.', sceneId: at(13) },
    ],
  })

  // ─── Mesa de RPG: Itaguaí, 1784 ──────────────────────────────────────
  let sistema
  ;[u, sistema] = insert(u, 'systems', systemFromTemplate('parada'))
  let grupo
  ;[u, grupo] = insert(u, 'groups', draftGroup('Mesa de sexta', sistema.id))
  const attr = (abbr: string) => sistema.attributes.find((a) => a.abbr === abbr)!.id
  const skill = (name: string) => sistema.skills.find((k) => k.name === name)!.id
  const [vit, von] = sistema.resources.map((r) => r.id)
  const pc = (name: string, player: string, attrs: Record<string, number>, skills: Record<string, number>, fields: Record<string, string>) => {
    const base = draftSheet(name, sistema, { role: 'pj', player, groupId: grupo.id })
    ;[u] = insert(u, 'sheets', {
      ...base,
      attributes: { ...base.attributes, ...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [attr(k), v])) },
      skills: { ...base.skills, ...Object.fromEntries(Object.entries(skills).map(([k, v]) => [skill(k), v])) },
      resources: { ...base.resources, [vit]: { current: 7, max: 7 }, [von]: { current: 3, max: 3 } },
      fields: { ...base.fields, ...fields },
    })
  }
  pc('Inácia', 'Ana', { FIS: 2, SOC: 4, MEN: 3 }, { Persuasão: 2, Manha: 2, Empatia: 1 }, { Conceito: 'Costureira que ouve tudo', Virtude: 'Lealdade', Vício: 'Curiosidade' })
  pc('Tomé', 'Bruno', { FIS: 4, SOC: 2, MEN: 2 }, { Briga: 2, Esportes: 1, Furtividade: 2 }, { Conceito: 'Sacristão do padre Lopes', Virtude: 'Coragem', Vício: 'Gula' })
  pc('Dr. Fagundes', 'Carla', { FIS: 1, SOC: 3, MEN: 5 }, { Medicina: 3, Investigação: 2 }, { Conceito: 'O “médico sem clínica”', Virtude: 'Paciência', Vício: 'Inveja do alienista' })
  {
    const base = draftSheet('Porfírio (barbeiro)', sistema, { role: 'npc', groupId: grupo.id, entityId: porfirio.id })
    ;[u] = insert(u, 'sheets', {
      ...base,
      attributes: { ...base.attributes, [attr('SOC')]: 4 },
      skills: { ...base.skills, [skill('Persuasão')]: 3, [skill('Manha')]: 2 },
      notes: 'Ajuda os jogadores se isso o aproximar da câmara. Muda de ideia quando o vento muda.',
    })
  }
  ;[u] = insert(u, 'tables', {
    name: 'Boatos de Itaguaí',
    entries: [
      'O alienista mandou buscar mais trinta e sete cubículos.',
      'A matraca anunciou um remédio para sezões.',
      'Viram o boticário entrar na Casa Verde de madrugada.',
      'O albardeiro não sai mais da janela.',
      'Dizem que o barbeiro anda juntando gente.',
      'Uma carta do Rio de Janeiro chegou para D. Evarista.',
    ],
  })
  let s1
  ;[u, s1] = insert(u, 'sessions', {
    ...draftSession(1, grupo.id),
    title: 'Sessão 1 — A matraca',
    status: 'encerrada',
    playedOn: '2026-10-09',
    prep: 'Abrir na festa da inauguração. Um primo de um jogador é recolhido no sétimo dia. Ninguém sabe dizer por quê.',
    log: [
      { id: crypto.randomUUID(), at: '20:14', text: 'Os jogadores tentaram visitar o primo; Crispim Soares não deixou.', kind: 'nota' },
      { id: crypto.randomUUID(), at: '21:02', text: 'Dr. Fagundes chamou a Casa Verde de cárcere privado, em voz alta demais.', kind: 'nota' },
    ],
  })
  let s2
  ;[u, s2] = insert(u, 'sessions', {
    ...draftSession(2, grupo.id),
    title: 'Sessão 2 — Bastilha da razão humana',
    prep: 'O barbeiro procura os jogadores: quer gente para a representação à câmara. Se aceitarem, estão na revolta.',
  })
  for (const [id, depth, session] of [
    [itaguai.id, 'completo', s1.id],
    [casaVerde.id, 'resumo', s1.id],
    [bacamarte.id, 'resumo', s1.id],
    [crispim.id, 'resumo', s1.id],
    [lopes.id, 'nome', s1.id],
    [porfirio.id, 'resumo', s2.id],
    [canjicas.id, 'nome', s2.id],
  ] as const) {
    ;[u] = insert(u, 'revelations', { ...draftRevelation(grupo.id, 'entidade', id, session), depth })
  }
  for (const [id, session] of [
    [rEsposa.id, s1.id],
    [rApoia.id, s1.id],
    [rRival.id, s2.id],
    [rLidera.id, s2.id],
  ] as const) {
    ;[u] = insert(u, 'revelations', draftRevelation(grupo.id, 'relacao', id, session))
  }

  // ─── Atlas: a vila desenhada, com os lugares marcados ─────────────
  {
    const pin = (entityId: string, x: number, y: number, label: string) => ({ id: crypto.randomUUID(), entityId, x, y, label })
    ;[u] = insert(u, 'maps', {
      name: 'Vila de Itaguaí',
      image: ITAGUAI_MAP,
      width: ITAGUAI_MAP_W,
      height: ITAGUAI_MAP_H,
      pins: [
        pin(itaguai.id, 0.47, 0.47, 'Itaguaí'),
        pin(casaVerde.id, 0.79, 0.23, 'Casa Verde'),
        pin(ruaNova.id, 0.66, 0.37, 'Rua Nova'),
        pin(matriz.id, 0.38, 0.33, 'Igreja Matriz'),
        pin(casaCamara.id, 0.56, 0.6, 'Casa da Câmara'),
        pin(botica.id, 0.35, 0.6, 'Botica'),
        pin(rio.id, 0.92, 0.41, 'Rio de Janeiro'),
      ],
    })
  }

  // ─── Livro: pronto na estante, para ver a diagramação ─────────────────
  {
    let book
    ;[u, book] = addBook(u, { title: 'O Alienista' })
    u = updateBook(u, book.id, {
      author: 'Machado de Assis',
      year: '1882',
      epigraph: 'A ciência é o meu emprego único; Itaguaí é o meu universo.',
      epigraphSource: 'Simão Bacamarte',
      blurb: 'Um médico abre um hospício numa vila do Brasil colonial e começa a achar loucos por toda parte. Até não sobrar ninguém, a não ser ele.',
      chapterStyle: 'ornamentado',
      ornament: '❦',
    })
  }

  // ─── Inbox ───────────────────────────────────────────────────────────
  ;[u] = insert(u, 'inbox', {
    text: 'Ideia: e se a Casa Verde tivesse um livro de registros, com o motivo de cada internação?',
    source: 'captura',
    sourceName: '',
    status: 'aberto',
  })
  return u
}
