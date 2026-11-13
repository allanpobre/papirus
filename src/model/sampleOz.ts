import { draftSheet } from '../rpg/sheets'
import { systemFromTemplate } from '../rpg/systems'
import { addBook, updateBook } from '../export/shelf'
import { addDefiner, choose, setPasses } from '../logic/definers'
import { docFromParagraphs } from './doc'
import { OZ_DESCRIPTION } from './sample'
import { OZ_MAP, OZ_MAP_H, OZ_MAP_W, OZ_REGIONS } from './sampleOzMap'
import type { Universe } from './schema'
import { addScene, addStory, createUniverse, draftEntity, draftEvent, draftFact, draftGroup, draftKnowledge, draftRelation, draftRevelation, draftSeed, draftSession, insert, patch, updateScene } from './universe'


const plain = (paragraphs: string[]) => paragraphs.join('\n\n')

/**
 * O exemplo principal: a Terra de Oz, com "O Mágico de Oz" inteiro e tudo o que o Papirus faz
 * com um mundo. Os anos são do Papirus (o livro não dá datas): servem para a linha do tempo.
 */
type Chapter = { titulo: string; paragrafos: string[] }

export function buildOz(chapters: Chapter[], outros?: { terra: Chapter[]; ozma: Chapter[]; zixi: Chapter[] }): Universe {
  let u = createUniverse('Exemplo — Terra de Oz')
  u = {
    ...u,
    description: OZ_DESCRIPTION,
    settings: {
      ...u.settings,
      calendarSuffix: '',
      dailyWordGoal: 500,
      fieldTemplates: { personagem: ['O que quer', 'Do que tem medo', 'O que esconde'], lugar: ['Cor', 'Quem vive ali'] },
    },
  }

  const ent = (kind: string, name: string, extra: Partial<ReturnType<typeof draftEntity>> = {}) => {
    const [next, e] = insert(u, 'entities', { ...draftEntity(kind, name), editorial: 'definido', ...extra })
    u = next
    return e
  }

  // ─── Lugares ─────────────────────────────────────────────────────────
  const oz = ent('reino', 'Terra de Oz', {
    summary: 'Um país cercado de deserto por todos os lados, isolado do resto do mundo. Por isso ainda tem bruxas e mágicos.',
    description: 'Quatro países em volta de uma cidade: os Munchkins no Leste, os Winkies no Oeste, os Quadlings no Sul e a Terra do Norte. No centro, a Cidade das Esmeraldas.',
    tags: ['país', 'magia'],
    fields: [{ key: 'Quem vive ali', value: 'Munchkins, Winkies, Quadlings, a gente do Norte e a da Cidade' }],
  })
  const leste = ent('reino', 'Terra dos Munchkins', {
    aliases: ['terra do Leste', 'país dos Munchkins'],
    summary: 'O país do Leste. Tudo é azul: as cercas, as casas redondas de cúpula, as roupas.',
    description: 'Governado pela Bruxa Má do Leste, que escravizava o povo. [a partir de "O conselho com os Munchkins"]Livre desde que a casa de Dorothy caiu sobre ela.[/a partir]',
    parentId: oz.id,
    fields: [{ key: 'Cor', value: 'azul' }],
  })
  const oeste = ent('reino', 'Terra dos Winkies', {
    aliases: ['Terra do Oeste', 'Terra Amarela do Oeste', 'país dos Winkies'],
    summary: 'O país do Oeste, sem estradas nem fazendas perto da fronteira. Tudo é amarelo.',
    description: 'A Bruxa Má do Oeste fez dos Winkies seus escravos com a ajuda dos Macacos Alados. [a partir de "O resgate"]Livres, eles fazem do dia da morte da Bruxa um feriado para sempre.[/a partir]',
    parentId: oz.id,
    fields: [{ key: 'Cor', value: 'amarelo' }],
  })
  const sul = ent('reino', 'Terra dos Quadlings', {
    aliases: ['Terra do Sul', 'país dos Quadlings'],
    summary: 'O país do Sul, rico e feliz, governado por Glinda. Tudo é vermelho.',
    parentId: oz.id,
    fields: [{ key: 'Cor', value: 'vermelho' }],
  })
  const norte = ent('reino', 'Terra do Norte', {
    summary: 'O país da Bruxa do Norte, a velhinha que beijou a testa de Dorothy.',
    description: 'O livro quase não fala dele. Muito antes de Oz, ali viveu a princesa Gayelette, no seu palácio de rubi.',
    parentId: oz.id,
  })
  const cidade = ent('lugar', 'Cidade das Esmeraldas', {
    aliases: ['Cidade de Oz', 'a Cidade'],
    summary: 'A cidade no centro de Oz: mármore verde, esmeraldas, até o sol parece verde.',
    description:
      'Quem entra recebe óculos verdes trancados com uma chave, “para não ficar cego com o brilho”. [a partir de "A descoberta de Oz, o Terrível"]Não é mais verde que qualquer outra cidade: o verde está nos óculos, por ordem de Oz.[/a partir]',
    parentId: oz.id,
    tags: ['capital'],
    fields: [{ key: 'Cor', value: 'verde' }],
  })
  const palacio = ent('lugar', 'Palácio de Oz', { aliases: ['o Palácio', 'Sala do Trono'], summary: 'No meio da Cidade. Na Sala do Trono, Oz aparece cada dia numa forma.', parentId: cidade.id })
  const estrada = ent('lugar', 'Estrada de tijolos amarelos', { aliases: ['a estrada amarela', 'estrada de tijolos amarelos'], summary: 'Liga a terra dos Munchkins à Cidade das Esmeraldas. Não tem como errar.', parentId: oz.id })
  const floresta = ent('lugar', 'Floresta dos Kalidahs', { summary: 'A mata fechada do caminho, com dois abismos e as feras de corpo de urso e cabeça de tigre.', parentId: leste.id })
  const papoulas = ent('lugar', 'Campo de papoulas', { aliases: ['as papoulas', 'canteiro de papoulas'], summary: 'Um prado vermelho cujo perfume faz dormir para sempre quem é de carne e osso.', parentId: oz.id })
  const castelo = ent('lugar', 'Castelo Amarelo', { aliases: ['castelo da Bruxa', 'o castelo'], summary: 'O castelo da Bruxa Má do Oeste, vigiado pelos Winkies.', parentId: oeste.id })
  const casteloGlinda = ent('lugar', 'Castelo de Glinda', { summary: 'Na beira do deserto do Sul, guardado por três moças de uniforme vermelho.', parentId: sul.id })
  const porcelana = ent('lugar', 'País de Porcelana', { summary: 'Um chão liso como prato, casinhas, vacas e princesas de porcelana. Cercado por muralhas.', parentId: sul.id })
  const morro = ent('lugar', 'Morro dos Cabeças-de-Martelo', { summary: 'Um morro de pedras na entrada do Sul. Quem tenta subir leva uma cabeçada.', parentId: sul.id })
  const florestaLeao = ent('lugar', 'Grande floresta do Sul', { summary: 'Uma floresta velha e linda, onde os animais fizeram do Leão o seu Rei.', parentId: sul.id })
  const deserto = ent('lugar', 'Grande Deserto', { aliases: ['o deserto'], summary: 'Cerca a Terra de Oz por todos os lados. Ninguém o atravessa com vida.' })
  const kansas = ent('lugar', 'Kansas', {
    summary: 'As grandes pradarias cinzentas onde Dorothy mora com os tios. Fora de Oz, além do deserto.',
    description: 'O sol cozeu a terra, o capim e até a pintura da casa: tudo é cinzento.',
    tags: ['mundo de fora'],
  })
  const omaha = ent('lugar', 'Omaha', { summary: 'Cidade do mundo de fora, “não muito longe do Kansas”.', tags: ['mundo de fora'] })

  // ─── Quem é: o povo e de que cada um é feito ─────────────────────────
  let povo
  ;[u, povo] = addDefiner(u, 'Povo', ['personagem'])
  let feito
  ;[u, feito] = addDefiner(u, 'Feito de', ['personagem'])
  const munchkins = ent(povo.kind, 'Munchkins', { summary: 'O povo do Leste: mais ou menos da altura de uma criança, de chapéu pontudo com sininhos.' })
  const winkies = ent(povo.kind, 'Winkies', { summary: 'O povo do Oeste. Não é valente, mas tem os melhores funileiros e ourives de Oz.' })
  const quadlings = ent(povo.kind, 'Quadlings', { summary: 'O povo do Sul: baixos, gordos e bonachões.' })
  const verdes = ent(povo.kind, 'Gente da Cidade', { summary: 'Quem mora na Cidade das Esmeraldas: roupa verde e pele esverdeada.' })
  const gentePorcelana = ent(povo.kind, 'Gente de porcelana', { summary: 'Do País de Porcelana. Se quebra fácil e fica feia depois de consertada.' })
  u = setPasses(u, munchkins.id, povo, [
    { key: 'Cor', value: 'azul' },
    { key: 'Casa', value: 'redonda, com cúpula' },
  ])
  u = setPasses(u, winkies.id, povo, [
    { key: 'Cor', value: 'amarelo' },
    { key: 'Ofício', value: 'funileiros e ourives' },
  ])
  u = setPasses(u, quadlings.id, povo, [{ key: 'Cor', value: 'vermelho' }])
  u = setPasses(u, verdes.id, povo, [
    { key: 'Cor', value: 'verde' },
    { key: 'Usa', value: 'óculos verdes trancados' },
  ])
  u = setPasses(u, gentePorcelana.id, povo, [{ key: 'Fora de casa', value: 'endurece e só serve de enfeite' }])
  const carne = ent(feito.kind, 'Carne e osso', { summary: 'Come, dorme, se cansa e sente o perfume das papoulas.' })
  const palha = ent(feito.kind, 'Palha', {
    summary: 'Recheado de palha: leve, não se machuca, mas o fogo é o fim.',
    game: { traits: ['Não sente dor', 'Pode ser recheado de novo'], mods: { FOR: -2 } },
  })
  const lata = ent(feito.kind, 'Lata', {
    summary: 'Feito de lata pelo funileiro: não se cansa, mas a água enferruja as juntas.',
    game: { traits: ['Armadura natural', 'Enferruja com água'], mods: { CON: 2 } },
  })
  u = setPasses(u, carne.id, feito, [
    { key: 'Come e dorme', value: 'sim' },
    { key: 'Papoulas', value: 'fazem dormir' },
  ])
  u = setPasses(u, palha.id, feito, [
    { key: 'Come e dorme', value: 'não' },
    { key: 'Cansa', value: 'nunca' },
    { key: 'Medo', value: 'fogo (um fósforo aceso)' },
  ])
  u = setPasses(u, lata.id, feito, [
    { key: 'Come e dorme', value: 'não' },
    { key: 'Fraqueza', value: 'enferruja com água, até com as próprias lágrimas' },
    { key: 'Coração', value: 'não tem' },
  ])

  // ─── Criaturas ───────────────────────────────────────────────────────
  const kalidah = ent('especie', 'Kalidah', {
    summary: 'Fera monstruosa com corpo de urso e cabeça de tigre. Garras capazes de partir um leão.',
    game: { traits: ['Garras longas', 'Caça em dupla'], mods: { FOR: 3 } },
  })
  const macacos = ent('faccao', 'Macacos Alados', {
    aliases: ['os Macacos', 'bando de Macacos Alados'],
    summary: 'Macacos com asas imensas. Travessos, mas presos ao Barrete de Ouro: obedecem três vezes a quem o tiver.',
    description: '[a partir de "Os Macacos Alados"]Foram livres até pregarem uma peça em Quelala, noivo da princesa Gayelette.[/a partir]',
  })
  const cabecas = ent('especie', 'Cabeças-de-Martelo', {
    aliases: ['Cabeça-de-Martelo'],
    summary: 'Homens baixos, sem braços, de cabeça achatada que dispara num pescoço que estica.',
    game: { traits: ['Cabeçada a distância'], mods: {} },
  })
  const ratos = ent('faccao', 'Ratos-do-campo', { aliases: ['os ratos'], summary: 'Milhares de ratinhos cinzentos que obedecem à sua Rainha.' })
  const animais = ent('faccao', 'Animais da grande floresta', { summary: 'Tigres, elefantes, ursos, lobos, raposas: fizeram do Leão o seu Rei.' })

  // ─── Coisas e magias ─────────────────────────────────────────────────
  const sapatos = ent('artefato', 'Sapatos de Prata', {
    aliases: ['os sapatos de prata', 'sapatos de prata'],
    summary: 'Eram da Bruxa Má do Leste. Há algum encanto ligado a eles; ninguém sabe qual.',
    description: '[a partir de "Glinda, a Bruxa Boa, realiza o desejo de Dorothy"]Levam quem os calça a qualquer lugar do mundo em três passos: basta bater os calcanhares três vezes.[/a partir]',
  })
  const barrete = ent('artefato', 'Barrete de Ouro', {
    aliases: ['o Barrete', 'Barrete'],
    summary: 'Um barrete de ouro com diamantes e rubis. Quem o tem pode chamar os Macacos Alados três vezes.',
    description: 'Feito por Gayelette como presente de casamento para Quelala; dizem que custou metade do reino dela.',
  })
  const beijo = ent('magia', 'Beijo da Bruxa do Norte', {
    summary: 'Uma marca redonda e brilhante na testa. Ninguém se atreve a fazer mal a quem a tem.',
    description: 'Protege pelo Poder do Bem, “maior que o Poder do Mal”: nem os Macacos Alados nem a Bruxa do Oeste tocam em Dorothy.',
  })
  const lousa = ent('documento', 'A lousa da Bruxa do Norte', {
    summary: 'O chapéu da velhinha vira lousa e escreve, em giz branco: “QUE DOROTHY VÁ À CIDADE DAS ESMERALDAS”.',
    fields: [{ key: 'Tipo', value: 'profecia' }],
  })
  const encanto = ent('documento', 'O encanto do Barrete', {
    summary: 'Escrito no forro do Barrete de Ouro. Um pé de cada vez, e depois os dois.',
    description: '“Ep-pe, pep-pe, kak-ke!” (no pé esquerdo). “Hil-lo, hol-lo, hel-lo!” (no pé direito). “Ziz-zy, zuz-zy, zik!” (nos dois pés).',
    fields: [{ key: 'Tipo', value: 'feitiço' }],
  })

  // ─── Personagens ─────────────────────────────────────────────────────
  const dorothy = ent('personagem', 'Dorothy', {
    aliases: ['a menina', 'a Pequena e Humilde'],
    summary: 'Menina órfã do Kansas, levada a Oz por um ciclone. Só quer voltar para casa.',
    description: 'Não há lugar como o nosso lar: por mais cinzento que seja o Kansas, é lá que ela quer viver.',
    fields: [
      { key: 'O que quer', value: 'voltar para a Tia Em e o Tio Henry' },
      { key: 'Do que tem medo', value: 'de nunca mais voltar' },
    ],
  })
  const toto = ent('personagem', 'Totó', { summary: 'Cachorrinho preto de olhinhos brilhantes. É ele que faz Dorothy rir.', tags: ['cachorro'] })
  const henry = ent('personagem', 'Tio Henry', { summary: 'Fazendeiro do Kansas. Trabalha de manhã à noite e nunca ri.' })
  const em = ent('personagem', 'Tia Em', { summary: 'Mulher do Tio Henry. O sol e o vento levaram o brilho dos olhos dela.' })
  const espantalho = ent('personagem', 'Espantalho', {
    aliases: ['o homem de palha', 'Sábio Espantalho'],
    summary: 'Feito anteontem por um lavrador Munchkin para espantar corvos. Quer miolos.',
    description:
      'Tropeça em todo buraco, mas é ele quem tem as ideias que salvam o grupo. [a partir de "A arte mágica do Grande Farsante"]Ganha de Oz miolos de farelo, alfinetes e agulhas.[/a partir] [a partir de "Como o balão foi lançado"]Passa a governar a Cidade das Esmeraldas.[/a partir]',
    fields: [
      { key: 'O que quer', value: 'miolos' },
      { key: 'Do que tem medo', value: 'de um fósforo aceso' },
    ],
  })
  const lenhador = ent('personagem', 'Lenhador de Lata', {
    aliases: ['o homem de lata', 'o Lenhador'],
    summary: 'Era um lenhador Munchkin de carne e osso. Um machado enfeitiçado o trocou por lata, pedaço por pedaço. Quer um coração.',
    description: 'Chora por um besouro pisado e enferruja. [a partir de "A arte mágica do Grande Farsante"]Ganha de Oz um coração de seda recheado de serragem.[/a partir]',
    fields: [
      { key: 'O que quer', value: 'um coração, para voltar a amar' },
      { key: 'Coração', value: 'de seda e serragem, presente de Oz', exception: true },
    ],
  })
  const leao = ent('personagem', 'Leão Covarde', {
    aliases: ['o Leão', 'Rei dos Animais'],
    summary: 'Do tamanho de um cavalo pequeno, ruge para não ter de brigar. Quer coragem.',
    description: 'Salta os abismos e enfrenta os Kalidahs tremendo de medo. [a partir de "O Leão se torna o Rei dos Animais"]Mata a grande aranha e vira Rei da floresta do Sul.[/a partir]',
    fields: [{ key: 'O que quer', value: 'coragem' }],
  })
  const magico = ent('personagem', 'O Mágico de Oz', {
    aliases: ['Oz', 'o Mágico', 'Grande Mágico', 'Oz, o Grande e Terrível', 'o Grande Farsante'],
    summary: 'O Grande Mágico que governa a Cidade das Esmeraldas. Ninguém o vê; cada um que o visita vê uma forma.',
    description:
      'Uma Cabeça, uma Dama alada, uma Fera de cinco olhos, uma Bola de Fogo. [a partir de "A descoberta de Oz, o Terrível"]Atrás do biombo, um velhinho careca: ventríloquo e balonista de circo, nascido em Omaha.[/a partir] [a partir de "A Princesa Ozma de Oz"]E não só: tomou o trono do pai de Ozma e deu a bebê para a velha Mombi esconder.[/a partir]',
    fields: [{ key: 'O que esconde', value: 'que não tem poder mágico nenhum' }],
  })
  const bruxaNorte = ent('personagem', 'Bruxa do Norte', { aliases: ['Bruxa Boa do Norte', 'a velhinha'], summary: 'Bruxa boa, velhinha, de vestido branco estrelado. Não tão poderosa quanto a do Leste.' })
  const bruxaLeste = ent('personagem', 'Bruxa Má do Leste', {
    aliases: ['Bruxa do Leste'],
    summary: 'Escravizou os Munchkins por muitos anos. Enfeitiçou o machado do lenhador.',
    endYear: 1900,
    description: '[a partir de "O conselho com os Munchkins"]Morreu esmagada pela casa de Dorothy; de tão velha, secou ao sol e só sobraram os sapatos.[/a partir]',
  })
  const bruxaOeste = ent('personagem', 'Bruxa Má do Oeste', {
    aliases: ['Bruxa do Oeste', 'a Bruxa Má'],
    summary: 'Tem um olho só, que enxerga como um telescópio. Governa os Winkies e tem o Barrete de Ouro.',
    description: 'Tem medo do escuro e mais ainda de água. [a partir de "À procura da Bruxa Má"]Um balde de água a derrete como açúcar mascavo.[/a partir]',
    endYear: 1900,
  })
  const glinda = ent('personagem', 'Glinda', {
    aliases: ['Bruxa do Sul', 'Glinda, a Boa', 'Bruxa Boa do Sul'],
    summary: 'A mais poderosa das Bruxas. Governa os Quadlings e sabe se manter jovem.',
    description: 'Cabelo ruivo, vestido branco, olhos azuis. Sabe o que os sapatos de prata fazem.',
  })
  const boq = ent('personagem', 'Boq', { summary: 'Munchkin rico que recebe Dorothy na festa da libertação.' })
  const guardiao = ent('personagem', 'Guardião dos Portões', { aliases: ['Guardião do Portão'], summary: 'Homenzinho verde que tranca os óculos de quem entra na Cidade. Tem a única chave.' })
  const soldado = ent('personagem', 'Soldado das suíças verdes', { aliases: ['o soldado'], summary: 'Guarda a porta do Palácio. Nunca viu Oz; fala com ele atrás do biombo.' })
  const mocaVerde = ent('personagem', 'Moça verde', { summary: 'Criada do Palácio, de cabelo e olhos verdes. Muito boa com os viajantes.' })
  const rainhaRatos = ent('personagem', 'Rainha dos Ratos-do-Campo', { aliases: ['a Rainha dos Ratos'], summary: 'Salva pelo Lenhador de um gato-do-mato. Dá a Dorothy um apito para chamá-la.' })
  const reiMacacos = ent('personagem', 'Rei dos Macacos Alados', { summary: 'Chefe do bando. Neto do macaco que jogou Quelala no rio.' })
  const gayelette = ent('personagem', 'Gayelette', { summary: 'Princesa e feiticeira do Norte, muito antes de Oz. Morava num palácio de rubi.', startYear: 1740, endYear: null })
  const quelala = ent('personagem', 'Quelala', { summary: 'O noivo de Gayelette. O primeiro dono do Barrete de Ouro.' })
  const mocaMunchkin = ent('personagem', 'A moça Munchkin', { summary: 'A noiva do lenhador, antes de ele ser de lata. Talvez ainda espere por ele.' })
  const cegonha = ent('personagem', 'Cegonha', { summary: 'Tira o Espantalho do meio do rio. Tem filhotes esperando no ninho.' })
  const princesa = ent('personagem', 'Princesa de porcelana', { summary: 'Não corre para não se quebrar. Não quer ir para a lareira da Tia Em.' })
  const gaiato = ent('personagem', 'Sr. Gaiato', { summary: 'Palhaço de porcelana, consertado em cem lugares de tanto plantar bananeira.' })

  // Quem é cada um (as listas das opções): o que herdam e as exceções.
  for (const [who, option] of [
    [boq.id, munchkins.id],
    [mocaMunchkin.id, munchkins.id],
    [guardiao.id, verdes.id],
    [soldado.id, verdes.id],
    [mocaVerde.id, verdes.id],
    [princesa.id, gentePorcelana.id],
    [gaiato.id, gentePorcelana.id],
  ] as const)
    u = choose(u, who, povo, option)
  for (const [who, option] of [
    [dorothy.id, carne.id],
    [henry.id, carne.id],
    [em.id, carne.id],
    [magico.id, carne.id],
    [espantalho.id, palha.id],
    [lenhador.id, lata.id],
  ] as const)
    u = choose(u, who, feito, option)

  // ─── Linha do tempo (anos do Papirus: o livro não dá datas) ─────────
  const ev = (title: string, year: number, extra: Partial<ReturnType<typeof draftEvent>> = {}) => {
    const [next, e] = insert(u, 'events', { ...draftEvent(title, year), ...extra })
    u = next
    return e
  }
  ev('Tempo de Gayelette', 1740, { kind: 'era', endYear: 1800, importance: 2, description: 'Muito antes de Oz. O Norte é governado por uma princesa feiticeira.' })
  ev('Reinado de Oz, o Mágico', 1850, { kind: 'era', endYear: 1900, importance: 3, description: 'Da chegada do balão à partida do balão.' })
  ev('Governo do Espantalho', 1900, { kind: 'era', endYear: null, importance: 2 })
  ev('O Barrete de Ouro prende os Macacos Alados', 1770, { importance: 2, entityIds: [gayelette.id, quelala.id, macacos.id, barrete.id], placeId: norte.id })
  ev('Oz chega de balão', 1850, { importance: 3, entityIds: [magico.id], placeId: cidade.id, description: 'Moço, preso num balão de circo. O povo o toma por um grande Mágico.' })
  ev('Construção da Cidade das Esmeraldas', 1852, { importance: 2, entityIds: [magico.id], placeId: cidade.id })
  ev('A Bruxa do Oeste escraviza os Winkies', 1860, { importance: 2, entityIds: [bruxaOeste.id, winkies.id, macacos.id], placeId: oeste.id, description: 'Primeira ordem do Barrete de Ouro.' })
  ev('A Bruxa do Oeste expulsa Oz do Oeste', 1865, { importance: 1, entityIds: [bruxaOeste.id, magico.id, macacos.id], placeId: oeste.id, description: 'Segunda ordem do Barrete de Ouro.' })
  ev('O ciclone leva Dorothy', 1900, { importance: 3, entityIds: [dorothy.id, toto.id], placeId: kansas.id })
  ev('Morte da Bruxa Má do Leste', 1900, { importance: 3, entityIds: [bruxaLeste.id, dorothy.id], placeId: leste.id })
  ev('Morte da Bruxa Má do Oeste', 1900, { importance: 3, entityIds: [bruxaOeste.id, dorothy.id], placeId: castelo.id })
  ev('Oz parte de balão', 1900, { importance: 2, entityIds: [magico.id, espantalho.id], placeId: cidade.id })
  ev('Dorothy volta para o Kansas', 1900, { importance: 3, entityIds: [dorothy.id, glinda.id], placeId: kansas.id })

  // ─── O livro: os vinte e quatro capítulos ───────────────────────────
  let story
  ;[u, story] = addStory(u, 'O Mágico de Oz')
  u = patch(u, 'stories', story.id, {
    synopsis: 'Um ciclone leva Dorothy do Kansas para a Terra de Oz. Para voltar, ela segue a estrada de tijolos amarelos até o Grande Mágico, com um Espantalho, um Lenhador de Lata e um Leão Covarde.',
    structure: 'jornada',
  })
  const T = [dorothy.id, toto.id]
  const G = [dorothy.id, toto.id, espantalho.id, lenhador.id, leao.id]
  type Meta = { place: string; day: number; present: string[]; synopsis: string }
  const META: Meta[] = [
    { place: kansas.id, day: 130, present: [...T, henry.id, em.id], synopsis: 'Um ciclone arranca a casa da pradaria, com Dorothy e Totó dentro.' },
    { place: leste.id, day: 131, present: [...T, bruxaNorte.id, bruxaLeste.id, munchkins.id, sapatos.id, lousa.id, beijo.id], synopsis: 'A casa cai sobre a Bruxa Má do Leste. A Bruxa do Norte manda Dorothy à Cidade das Esmeraldas.' },
    { place: leste.id, day: 132, present: [...T, boq.id, espantalho.id, estrada.id, sapatos.id], synopsis: 'Na festa de Boq, Dorothy é tomada por feiticeira. No milharal, tira o Espantalho da estaca.' },
    { place: estrada.id, day: 132, present: [...T, espantalho.id, kansas.id], synopsis: 'O Espantalho conta como foi feito, anteontem. A estrada entra na floresta.' },
    { place: floresta.id, day: 133, present: [...T, espantalho.id, lenhador.id, bruxaLeste.id, mocaMunchkin.id], synopsis: 'Uma lata de óleo salva o Lenhador, que conta como a Bruxa do Leste o fez de lata.' },
    { place: floresta.id, day: 133, present: [...G], synopsis: 'Um leão ataca, leva um tapa no focinho e confessa que é covarde.' },
    { place: floresta.id, day: 134, present: [...G, kalidah.id], synopsis: 'Dois abismos e os Kalidahs. Do outro lado, um rio.' },
    { place: papoulas.id, day: 135, present: [...G, cegonha.id], synopsis: 'O rio leva o Espantalho; a Cegonha o salva. As papoulas fazem Dorothy e o Leão dormirem.' },
    { place: papoulas.id, day: 135, present: [...G, rainhaRatos.id, ratos.id], synopsis: 'O Lenhador salva a Rainha dos Ratos; milhares de ratos tiram o Leão das papoulas.' },
    { place: cidade.id, day: 137, present: [...G, guardiao.id], synopsis: 'Na porta da Cidade das Esmeraldas, todos recebem óculos verdes trancados.' },
    { place: palacio.id, day: 138, present: [...G, magico.id, soldado.id, mocaVerde.id], synopsis: 'Oz recebe cada um numa forma diferente e pede a mesma coisa: matar a Bruxa Má do Oeste.' },
    { place: castelo.id, day: 143, present: [...G, bruxaOeste.id, winkies.id, macacos.id, barrete.id, beijo.id, encanto.id], synopsis: 'Lobos, corvos, abelhas e os Macacos Alados. Dorothy derrete a Bruxa com um balde de água.' },
    { place: castelo.id, day: 145, present: [...G, winkies.id, barrete.id], synopsis: 'Os Winkies, livres, consertam o Lenhador e recheiam o Espantalho de novo.' },
    { place: oeste.id, day: 150, present: [...G, rainhaRatos.id, reiMacacos.id, macacos.id, gayelette.id, quelala.id, barrete.id, encanto.id], synopsis: 'Perdidos, chamam os Macacos Alados. O Rei conta a história de Gayelette.' },
    { place: palacio.id, day: 154, present: [...G, magico.id, guardiao.id, omaha.id], synopsis: 'Totó derruba o biombo: o Grande Mágico é um homem de Omaha.' },
    { place: palacio.id, day: 155, present: [espantalho.id, lenhador.id, leao.id, magico.id], synopsis: 'Farelo e alfinetes, um coração de seda, uma dose de coragem.' },
    { place: cidade.id, day: 158, present: [...G, magico.id, soldado.id], synopsis: 'O balão sobe sem Dorothy. O Espantalho passa a governar a Cidade.' },
    { place: palacio.id, day: 159, present: [...G, reiMacacos.id, soldado.id, glinda.id], synopsis: 'Os Macacos não podem atravessar o deserto. O soldado fala de Glinda.' },
    { place: sul.id, day: 160, present: [...G, guardiao.id, mocaVerde.id], synopsis: 'Árvores que agarram e, depois delas, uma muralha de porcelana.' },
    { place: porcelana.id, day: 161, present: [...G, princesa.id, gaiato.id, gentePorcelana.id], synopsis: 'Uma vaca de perna quebrada, uma princesa que não quer ir ao Kansas, uma igreja derrubada.' },
    { place: florestaLeao.id, day: 162, present: [...G, animais.id], synopsis: 'O Leão mata a grande aranha e vira Rei da floresta.' },
    { place: morro.id, day: 163, present: [...G, cabecas.id, reiMacacos.id, quadlings.id], synopsis: 'Os Cabeças-de-Martelo barram o morro; a última ordem do Barrete leva todos por cima.' },
    { place: casteloGlinda.id, day: 164, present: [...G, glinda.id, barrete.id, sapatos.id], synopsis: 'Glinda revela o poder dos sapatos. Três batidas de calcanhar e Dorothy está no Kansas.' },
    { place: kansas.id, day: 164, present: [...T, em.id, henry.id], synopsis: 'A Tia Em abraça a menina que voltou da Terra de Oz.' },
  ]
  const STATUS: Universe['scenes'][number]['status'][] = ['pronta', 'pronta', 'pronta', 'pronta', 'pronta', 'pronta', 'pronta', 'revisao', 'pronta', 'pronta', 'pronta', 'pronta', 'pronta', 'revisao', 'pronta', 'pronta', 'pronta', 'pronta', 'rascunho', 'revisao', 'pronta', 'pronta', 'pronta', 'pronta']
  const scenes = chapters.map((ch, i) => {
    let s
    ;[u, s] = addScene(u, story.id, ch.titulo)
    const m = META[i] ?? META[META.length - 1]
    u = updateScene(u, s.id, {
      doc: docFromParagraphs(ch.paragrafos),
      text: plain(ch.paragrafos),
      placeId: m.place,
      date: { year: 1900, day: m.day },
      presentIds: m.present,
      synopsis: m.synopsis,
      status: STATUS[i] ?? 'rascunho',
    })
    return s
  })
  const at = (n: number) => scenes[Math.min(n, scenes.length) - 1].id
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  const cenas = (...n: number[]) => ({ kind: 'cenas' as const, fromYear: null, toYear: null, storyIds: [], sceneIds: n.filter((x) => x <= scenes.length).map(at) })

  // ─── Ligações: as de sempre e as que mudam capítulo a capítulo ──────
  const rel = (a: string, b: string, type: string, extra: Partial<ReturnType<typeof draftRelation>> = {}) => {
    const [next, r] = insert(u, 'relations', { ...draftRelation(a, b, type), ...extra })
    u = next
    return r
  }
  rel(em.id, henry.id, 'esposa de')
  rel(dorothy.id, em.id, 'sobrinha de')
  const rDona = rel(toto.id, dorothy.id, 'cachorro de')
  const rAmigos = rel(espantalho.id, dorothy.id, 'amigo de', { scope: cenas(...range(3, 24)) })
  rel(lenhador.id, dorothy.id, 'amigo de', { scope: cenas(...range(5, 24)) })
  rel(leao.id, dorothy.id, 'amigo de', { scope: cenas(...range(6, 24)) })
  rel(lenhador.id, mocaMunchkin.id, 'era noivo de', { note: 'Antes de ser de lata. Sem coração, deixou de amá-la.' })
  rel(bruxaLeste.id, leste.id, 'governa', { scope: { kind: 'periodo', fromYear: 1870, toYear: 1900, storyIds: [], sceneIds: [] } })
  const rEscraviza = rel(bruxaOeste.id, oeste.id, 'governa', { scope: cenas(...range(1, 12)), via: [{ entityId: macacos.id, role: 'com a ajuda dos' }] })
  rel(bruxaNorte.id, norte.id, 'governa')
  rel(glinda.id, sul.id, 'governa')
  const rGoverna = rel(magico.id, cidade.id, 'governa', { scope: cenas(...range(1, 17)) })
  rel(espantalho.id, cidade.id, 'governa', { scope: cenas(...range(17, 24)), note: 'Deixado no lugar de Oz. O povo tem orgulho: nenhuma outra cidade é governada por um homem de palha.' })
  rel(leao.id, animais.id, 'é rei de', { scope: cenas(21, 22, 23, 24) })
  rel(dorothy.id, sapatos.id, 'calça', { scope: cenas(...range(3, 23)) })
  rel(dorothy.id, barrete.id, 'tem', { scope: cenas(...range(13, 23)) })
  rel(glinda.id, barrete.id, 'tem', { scope: cenas(23, 24) })
  rel(bruxaOeste.id, barrete.id, 'tem', { scope: cenas(...range(1, 12)) })
  rel(macacos.id, barrete.id, 'obedecem ao dono do')
  rel(gayelette.id, quelala.id, 'esposa de')
  rel(dorothy.id, bruxaLeste.id, 'matou sem querer', { scope: cenas(...range(2, 24)), via: [{ entityId: kansas.id, role: 'com a casa do' }] })
  rel(dorothy.id, bruxaOeste.id, 'derreteu', { scope: cenas(...range(12, 24)) })
  rel(bruxaOeste.id, dorothy.id, 'escraviza', { scope: cenas(12) })
  rel(lenhador.id, rainhaRatos.id, 'salvou', { scope: cenas(...range(9, 24)) })
  rel(deserto.id, oz.id, 'cerca')
  rel(guardiao.id, magico.id, 'serve a')
  rel(soldado.id, magico.id, 'serve a')
  // O segredo do mundo: só os quatro e o próprio Oz sabem.
  rel(magico.id, omaha.id, 'nasceu em', { canon: 'secreto' })

  // ─── Fatos ───────────────────────────────────────────────────────────
  const fact = (fields: Parameters<typeof draftFact>[0]) => {
    const [next, f] = insert(u, 'facts', draftFact({ canon: 'estabelecido', editorial: 'definido', ...fields }))
    u = next
    return f
  }
  fact({ subjectId: bruxaLeste.id, predicate: 'morreu debaixo da', value: 'casa de Dorothy', speakerId: bruxaNorte.id, sourceSceneId: at(2), quote: 'Lá estão os dois pés dela, ainda aparecendo debaixo de uma tora de madeira.' })
  fact({ subjectId: sapatos.id, predicate: 'têm', value: 'algum encanto', sourceSceneId: at(2), quote: 'há algum encanto ligado a eles; mas qual é, nunca soubemos', canon: 'rumor', editorial: 'provisorio' })
  fact({ subjectId: espantalho.id, predicate: 'foi feito', value: 'anteontem', speakerId: espantalho.id, sourceSceneId: at(4), quote: 'Fui feito só anteontem.' })
  fact({ subjectId: magico.id, predicate: 'tem', value: 'uma coleção de corações', speakerId: null, sourceSceneId: at(10), quote: 'Oz tem uma grande coleção de corações, de todos os tamanhos e formatos', canon: 'rumor', editorial: 'provisorio', note: 'É o que diz um lavrador que nunca viu Oz.' })
  fact({ subjectId: bruxaOeste.id, predicate: 'tem', value: 'um olho só, que vê como telescópio', sourceSceneId: at(12), quote: 'tinha um olho só, mas ele era tão poderoso quanto um telescópio' })
  const fAgua = fact({ subjectId: bruxaOeste.id, predicate: 'nunca toca em', value: 'água', sourceSceneId: at(12), quote: 'a velha Bruxa nunca tocava em água' })
  const fFarsante = fact({ subjectId: magico.id, predicate: 'é', value: 'um farsante, sem poder mágico nenhum', speakerId: magico.id, sourceSceneId: at(15), quote: 'Eu sou um farsante.', canon: 'secreto', note: 'O povo da Cidade não sabe. Oz pede aos quatro que guardem o segredo.' })
  fact({ subjectId: magico.id, predicate: 'nasceu em', objectId: omaha.id, value: '', speakerId: magico.id, sourceSceneId: at(15), quote: 'Eu nasci em Omaha' })
  fact({ subjectId: magico.id, predicate: 'acha que a coragem é', value: 'enfrentar o perigo com medo', speakerId: magico.id, sourceSceneId: at(15), quote: 'A verdadeira coragem é enfrentar o perigo quando se tem medo' })
  fact({ subjectId: sapatos.id, predicate: 'levam a', value: 'qualquer lugar do mundo em três passos', speakerId: glinda.id, sourceSceneId: at(23), quote: 'podem levar você a qualquer lugar do mundo em três passos' })

  for (const who of [dorothy.id, espantalho.id, lenhador.id, leao.id]) {
    ;[u] = insert(u, 'knowledge', { ...draftKnowledge(who, fFarsante.id), state: 'sabe', sinceSceneId: at(15) })
  }
  ;[u] = insert(u, 'knowledge', { ...draftKnowledge(bruxaOeste.id, fAgua.id), state: 'sabe', sinceSceneId: at(12) })

  // ─── Tramas ──────────────────────────────────────────────────────────
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('O encanto dos sapatos de prata'),
    description: 'Os Munchkins sabem que há um encanto; ninguém sabe qual. A Bruxa do Oeste treme quando os vê.',
    status: 'resolvida',
    setupSceneId: at(2),
    payoffSceneId: at(23),
    entityIds: [sapatos.id, dorothy.id],
  })
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('As três ordens do Barrete de Ouro'),
    description: 'A Bruxa usou duas. Dorothy usa as três dela; Glinda, as três seguintes. E depois?',
    status: 'resolvida',
    setupSceneId: at(12),
    payoffSceneId: at(23),
    entityIds: [barrete.id, macacos.id],
  })
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('Quem é o verdadeiro Oz?', 'misterio'),
    status: 'resolvida',
    description: 'Ninguém o vê. Cada um conta uma forma.',
    setupSceneId: at(2),
    payoffSceneId: at(15),
    entityIds: [magico.id],
    clues: [
      { id: crypto.randomUUID(), text: 'A Bruxa do Norte: “Se é homem ou não, não sei dizer.”', sceneId: at(2) },
      { id: crypto.randomUUID(), text: 'O lavrador: Oz pode tomar a forma que quiser.', sceneId: at(10) },
      { id: crypto.randomUUID(), text: 'Quatro visitas, quatro formas. E sempre a mesma pergunta.', sceneId: at(11) },
      { id: crypto.randomUUID(), text: 'A Voz treme ao saber que a Bruxa morreu.', sceneId: at(15) },
    ],
  })
  ;[u] = insert(u, 'seeds', {
    ...draftSeed('A moça Munchkin que espera'),
    description: 'O Lenhador ganhou um coração. Vai voltar para a noiva?',
    status: 'aberta',
    setupSceneId: at(5),
    entityIds: [lenhador.id, mocaMunchkin.id],
  })

  // ─── Mesa de RPG: aventuras na Terra de Oz ──────────────────────────
  let sistema
  ;[u, sistema] = insert(u, 'systems', systemFromTemplate('d20-5e'))
  let grupo
  ;[u, grupo] = insert(u, 'groups', draftGroup('Grupo de sábado', sistema.id))
  const attr = (abbr: string) => sistema.attributes.find((a) => a.abbr === abbr)!.id
  const skill = (name: string) => sistema.skills.find((k) => k.name === name)!.id
  const pv = sistema.resources[0].id
  const ca = sistema.resources[1].id
  const weapon = (name: string, bonus: number, damage: string, critical = '') => ({ id: crypto.randomUUID(), name, bonus, damage, critical })
  const pc = (name: string, player: string, attrs: Record<string, number>, skills: Record<string, number>, hp: number, armor: number, fields: Record<string, string>, attacks: ReturnType<typeof weapon>[]) => {
    const base = draftSheet(name, sistema, { role: 'pj', player, groupId: grupo.id })
    ;[u] = insert(u, 'sheets', {
      ...base,
      attacks,
      attributes: { ...base.attributes, ...Object.fromEntries(Object.entries(attrs).map(([k, v]) => [attr(k), v])) },
      skills: { ...base.skills, ...Object.fromEntries(Object.entries(skills).map(([k, v]) => [skill(k), v])) },
      resources: { ...base.resources, [pv]: { current: hp, max: hp }, [ca]: { current: armor, max: armor } },
      fields: { ...base.fields, ...fields },
    })
  }
  pc('Tila', 'Ana', { FOR: 9, DES: 15, CON: 12, INT: 12, SAB: 13, CAR: 14 }, { Furtividade: 2, Percepção: 2, Persuasão: 2 }, 18, 13, { 'Classe e nível': 'Ladina 2', Raça: 'Munchkin', Antecedente: 'Pastora de sinos' }, [weapon('Funda', 4, '1d4+{mod:DES}')])
  pc('Bolt', 'Bruno', { FOR: 15, DES: 10, CON: 16, INT: 10, SAB: 10, CAR: 8 }, { Atletismo: 2, Intimidação: 2 }, 24, 16, { 'Classe e nível': 'Guerreiro 2', Raça: 'Homem de lata', Antecedente: 'Funileiro Winkie' }, [weapon('Martelo de funileiro', 4, '1d8+{mod:FOR}')])
  pc('Pena', 'Carla', { FOR: 8, DES: 12, CON: 12, INT: 16, SAB: 13, CAR: 12 }, { Arcanismo: 2, História: 2, Investigação: 2 }, 14, 12, { 'Classe e nível': 'Maga 2', Raça: 'Gente da Cidade', Antecedente: 'Aprendiz de Glinda' }, [weapon('Faísca verde', 4, '1d10')])
  {
    const base = draftSheet('Guardião dos Portões', sistema, { role: 'npc', groupId: grupo.id, entityId: guardiao.id })
    ;[u] = insert(u, 'sheets', {
      ...base,
      attributes: { ...base.attributes, [attr('SAB')]: 14, [attr('CAR')]: 12 },
      skills: { ...base.skills, [skill('Intuição')]: 2 },
      resources: { ...base.resources, [pv]: { current: 9, max: 9 }, [ca]: { current: 11, max: 11 } },
      notes: 'Tem a única chave dos óculos. Desconfia de quem pede para ver Oz.',
    })
  }
  const atk = (name: string, bonus: number, damage: string, critical = '') => ({ id: crypto.randomUUID(), name, bonus, damage, critical })
  ;[u] = insert(u, 'monsters', { name: 'Kalidah', hp: 34, defense: 13, initiative: 1, attacks: [atk('Garras', 6, '2d6+4'), atk('Mordida de tigre', 6, '1d10+4')], notes: 'Caçam em dupla. Uma ponte cortada resolve.' })
  ;[u] = insert(u, 'monsters', { name: 'Lobo da Bruxa', hp: 11, defense: 13, initiative: 2, attacks: [atk('Mordida', 4, '2d4+2')], notes: 'Vêm quarenta de uma vez, ao som do apito de prata.' })
  ;[u] = insert(u, 'monsters', { name: 'Macaco Alado', hp: 13, defense: 12, initiative: 3, attacks: [atk('Agarrar e voar', 4, '1d6+2')], notes: 'Só ataca a mando de quem tem o Barrete de Ouro. Não toca em quem tem o beijo da Bruxa do Norte.' })
  ;[u] = insert(u, 'tables', {
    name: 'Rumores da Cidade das Esmeraldas',
    entries: [
      'Dizem que o Mágico tem uma coleção de corações, de todos os tamanhos.',
      'A moça verde jura que ouviu um miado na Sala do Trono, e não há gatos no Palácio.',
      'O Guardião dos Portões perdeu a chave dos óculos uma vez. Ninguém sabe o que viu quem ficou sem eles.',
      'Um mensageiro Quadling atravessou o morro dos Cabeças-de-Martelo. Ninguém sabe como.',
      'Os Winkies estão comprando lata e óleo como nunca.',
      'Viram um balão de seda verde sendo costurado no Palácio.',
    ],
  })
  let s1
  ;[u, s1] = insert(u, 'sessions', {
    ...draftSession(1, grupo.id),
    title: 'Sessão 1 — Os óculos trancados',
    status: 'encerrada',
    playedOn: '2026-10-10',
    prep: 'Abrir no portão da Cidade. O Guardião tranca os óculos de todos. Um deles volta sem lente verde e vê a cidade como ela é.',
    log: [
      { id: crypto.randomUUID(), at: '19:40', text: 'Tila tentou abrir a fechadura dos óculos com um grampo. Quase conseguiu.', kind: 'nota' },
      { id: crypto.randomUUID(), at: '20:55', text: 'Bolt foi confundido com o Lenhador de Lata na rua. Aceitou os elogios.', kind: 'nota' },
    ],
  })
  const beat = (title: string, mood: string) => ({ id: crypto.randomUUID(), title, mood, done: false })
  let s2
  ;[u, s2] = insert(u, 'sessions', {
    ...draftSession(2, grupo.id),
    title: 'Sessão 2 — A estrada para o Oeste',
    prep: 'Não há estrada para o Oeste. Quem vai, é a Bruxa que encontra.',
    strongStart: 'Um corvo de um olho só pousa no ombro de Pena e fica olhando. Longe, um apito de prata soa duas vezes.',
    beats: [
      beat('Campos de botões-de-ouro', 'Sol forte, nenhuma árvore, nenhuma sombra.'),
      beat('Os quarenta lobos', 'Uivos ao entardecer e um lenhador que não está ali para ajudar.'),
      beat('A ponte dos Kalidahs', 'Uma árvore atravessada, duas feras do outro lado.'),
      beat('O castelo amarelo', 'Winkies de lança na mão, que não querem lutar.'),
    ],
  })
  for (const [id, depth, session] of [
    [cidade.id, 'completo', s1.id],
    [guardiao.id, 'resumo', s1.id],
    [magico.id, 'resumo', s1.id],
    [oeste.id, 'resumo', s2.id],
    [bruxaOeste.id, 'nome', s2.id],
    [macacos.id, 'nome', s2.id],
  ] as const) {
    ;[u] = insert(u, 'revelations', { ...draftRevelation(grupo.id, 'entidade', id, session), depth })
  }
  for (const [id, session] of [
    [rGoverna.id, s1.id],
    [rDona.id, s1.id],
    [rAmigos.id, s1.id],
    [rEscraviza.id, s2.id],
  ] as const) {
    ;[u] = insert(u, 'revelations', draftRevelation(grupo.id, 'relacao', id, session))
  }

  // ─── Atlas: os quatro países, com fronteiras e lugares ──────────────
  {
    const pin = (entityId: string, x: number, y: number, label: string) => ({ id: crypto.randomUUID(), entityId, x, y, label })
    const region = (entityId: string, points: [number, number][]) => ({ id: crypto.randomUUID(), entityId, points, fromYear: null, toYear: null })
    ;[u] = insert(u, 'maps', {
      name: 'A Terra de Oz',
      image: OZ_MAP,
      width: OZ_MAP_W,
      height: OZ_MAP_H,
      pins: [
        pin(cidade.id, 0.5, 0.43, 'Cidade das Esmeraldas'),
        pin(leste.id, 0.78, 0.36, 'Onde a casa caiu'),
        pin(papoulas.id, 0.6, 0.6, 'Campo de papoulas'),
        pin(castelo.id, 0.22, 0.74, 'Castelo Amarelo'),
        pin(porcelana.id, 0.36, 0.8, 'País de Porcelana'),
        pin(casteloGlinda.id, 0.64, 0.84, 'Castelo de Glinda'),
        pin(kansas.id, 0.94, 0.08, 'Kansas'),
      ],
      regions: [region(norte.id, OZ_REGIONS.norte), region(leste.id, OZ_REGIONS.leste), region(sul.id, OZ_REGIONS.sul), region(oeste.id, OZ_REGIONS.oeste)],
    })
  }

  // ─── Os outros livros: a série continua, e um livro do mesmo mundo que não se liga às outras histórias ─
  const stories: { id: string; title: string; author: string; year: string; blurb: string }[] = [
    {
      id: story.id,
      title: 'O Mágico de Oz',
      author: 'L. Frank Baum',
      year: '1900',
      blurb: 'Um ciclone leva Dorothy do Kansas para uma terra de bruxas, povos coloridos e um Grande Mágico que ninguém vê. Para voltar, ela vai precisar de um Espantalho sem miolos, um Lenhador sem coração e um Leão sem coragem.',
    },
  ]
  if (outros) {
    // Cenas de uma história nova, com o lugar, o ano e quem aparece.
    const addTale = (title: string, synopsis: string, chs: Chapter[], meta: { place: string; year: number; day: number; present: string[]; synopsis: string }[]) => {
      let st
      ;[u, st] = addStory(u, title)
      u = patch(u, 'stories', st.id, { synopsis })
      const ids = chs.map((ch, i) => {
        let sc
        ;[u, sc] = addScene(u, st.id, ch.titulo)
        const m = meta[i]
        u = updateScene(u, sc.id, { doc: docFromParagraphs(ch.paragrafos), text: plain(ch.paragrafos), placeId: m.place, date: { year: m.year, day: m.day }, presentIds: m.present, synopsis: m.synopsis, status: 'pronta' })
        return sc.id
      })
      return { story: st, scenes: ids }
    }
    const ev2 = (id: string) => ({ kind: 'cenas' as const, fromYear: null, toYear: null, storyIds: [], sceneIds: [id] })

    // Livro 2: o segredo de Tip.
    const tip = ent('personagem', 'Tip', {
      aliases: ['Tippetarius', 'o menino'],
      summary: 'Menino da Terra dos Gillikins, criado pela velha Mombi. Não se lembra dos pais.',
      description: 'Faz Jack Cabeça-de-Abóbora para assustar Mombi. [a partir de "A Princesa Ozma de Oz"]Era a princesa Ozma, transformada em menino por Mombi.[/a partir]',
    })
    const ozma = ent('personagem', 'Ozma', {
      aliases: ['Princesa Ozma', 'Ozma de Oz', 'a Governante de Oz'],
      summary: 'A governante legítima da Terra de Oz, filha do antigo rei.',
      description: '[a partir de "A Princesa Ozma de Oz"]Escondida desde bebê por Mombi, a pedido do Mágico. Vira Rainha da Cidade das Esmeraldas.[/a partir] [a partir de "Ozma de Oz ao resgate"]Atravessa o deserto num tapete mágico para salvar a família real de Ev.[/a partir]',
    })
    const mombi = ent('personagem', 'Mombi', {
      aliases: ['a velha Mombi'],
      summary: 'Velha da Terra dos Gillikins, de má fama. Não pode ser Bruxa: só Feiticeira.',
      description: '[a partir de "A Princesa Ozma de Oz"]Perde a magia: bebe a poção de Glinda que faz esquecer tudo o que aprendeu.[/a partir]',
    })
    const jack = ent('personagem', 'Jack Cabeça-de-Abóbora', {
      aliases: ['Jack', 'o Cabeça-de-Abóbora'],
      summary: 'Boneco de galhos com cabeça de abóbora, feito por Tip. Chama Tip de "pai".',
    })
    const cavalete = ent('personagem', 'Cavalete', { aliases: ['o Cavalete'], summary: 'Cavalete de madeira que ganhou vida. Corre dias sem se cansar.' })
    const tiktok = ent('personagem', 'Tiktok', { summary: 'Homem-máquina de cobre, de corda. Pensa com miolos de aço; não está vivo.' })
    const langwidere = ent('personagem', 'Langwidere', { aliases: ['Princesa Langwidere'], summary: 'Princesa de Ev que coleciona cabeças e troca de cabeça como quem troca de chapéu.' })
    const ev = ent('reino', 'Terra de Ev', { summary: 'Reino do outro lado do deserto, fora de Oz, perto do mar.' })
    // Ix e Nolândia: o mesmo mundo, do outro lado do deserto, sem ninguém das outras histórias.
    const ix = ent('reino', 'Ix', { summary: 'Reino de torres de mármore, do outro lado do deserto, governado há séculos pela mesma rainha.' })
    const nolandia = ent('reino', 'Nolândia', { aliases: ['Noland'], summary: 'Reino vizinho de Ix, além de uma cordilheira, de um rio e de uma floresta escura. A capital é Nole.' })
    const burzee = ent('lugar', 'Floresta de Burzee', { summary: 'Floresta antiga onde as fadas dançam na lua cheia.' })
    const zixi = ent('personagem', 'Zixi', {
      aliases: ['Rainha Zixi', 'a Rainha-Bruxa'],
      summary: 'Rainha de Ix: parece ter dezesseis anos, mas tem seiscentos e oitenta e três. Bruxa, mas não má.',
      description: 'Governa com sabedoria e é mais temida que amada. O espelho é a única coisa que a magia dela não engana: nele, ela se vê velha.',
      fields: [{ key: 'O que quer', value: 'a capa mágica, para ver no espelho o rosto que os outros veem' }],
    })
    const lulea = ent('personagem', 'Lulea', { aliases: ['Rainha Lulea'], summary: 'Rainha das fadas da Floresta de Burzee.' })
    const capa = ent('artefato', 'Capa Mágica', {
      aliases: ['a capa mágica', 'capa mágica'],
      summary: 'Tecida pelas fadas numa noite de lua: realiza um desejo de cada dono, menos de quem a roubar.',
    })
    // A Terra dos Gillikins é a Terra do Norte (o livro 2 dá o nome).
    u = patch(u, 'entities', norte.id, { aliases: ['Terra dos Gillikins', 'Gillikins'], summary: 'O país do Norte, dos Gillikins. A cor é o roxo.' })
    for (const [who, option] of [
      [ozma.id, carne.id],
      [tip.id, carne.id],
      [mombi.id, carne.id],
    ] as const)
      u = choose(u, who, feito, option)

    const terra = addTale('A Maravilhosa Terra de Oz (trechos)', 'Tip foge da velha Mombi com Jack Cabeça-de-Abóbora, o Espantalho perde o trono para a revolta de Jinjur, e Glinda descobre o que o Mágico escondeu.', outros.terra, [
      { place: norte.id, year: 1901, day: 280, present: [tip.id, mombi.id, jack.id], synopsis: 'Para assustar Mombi, Tip faz um homem de galhos com cabeça de abóbora.' },
      { place: cidade.id, year: 1902, day: 40, present: [glinda.id, mombi.id, tip.id, ozma.id, jack.id, espantalho.id, lenhador.id, cavalete.id, magico.id], synopsis: 'A pérola de Glinda arranca a verdade de Mombi: Tip é Ozma.' },
    ])
    const ozmaBook = addTale('Ozma de Oz (trechos)', 'Anos depois, uma tempestade joga Dorothy no mar. Do outro lado do deserto, ela reencontra os amigos, agora com Ozma no trono.', outros.ozma, [
      { place: ev.id, year: 1907, day: 120, present: [dorothy.id, henry.id, em.id], synopsis: 'A caminho da Austrália, uma tempestade leva Dorothy num galinheiro para o mar.' },
      { place: ev.id, year: 1907, day: 122, present: [dorothy.id, ozma.id, espantalho.id, lenhador.id, leao.id, cavalete.id, tiktok.id, langwidere.id, sapatos.id], synopsis: 'Ozma atravessa o deserto num tapete mágico e tira Dorothy da torre de Langwidere.' },
    ])
    const zixiBook = addTale('A Rainha Zixi de Ix (trechos)', 'Do outro lado do deserto, as fadas tecem uma capa que realiza um desejo, e a rainha-bruxa de Ix quer a capa para si. Nenhum personagem dos outros livros: só o mesmo mundo.', outros.zixi, [
      { place: burzee.id, year: 1903, day: 100, present: [lulea.id, capa.id, nolandia.id], synopsis: 'As fadas de Burzee tecem a capa mágica e a mandam para o primeiro infeliz de Nolândia.' },
      { place: ix.id, year: 1904, day: 60, present: [zixi.id, capa.id, nolandia.id], synopsis: 'Um menestrel canta a capa no banquete de Zixi, e a rainha jura que vai tê-la.' },
    ])

    // O que liga os livros (e o que muda de um para o outro).
    rel(mombi.id, tip.id, 'criou')
    rel(tip.id, jack.id, 'fez')
    rel(tip.id, ozma.id, 'é na verdade', { scope: ev2(terra.scenes[1]) })
    rel(magico.id, ozma.id, 'deu a bebê para Mombi esconder', { scope: ev2(terra.scenes[1]), via: [{ entityId: mombi.id, role: 'com a ajuda de' }] })
    rel(ozma.id, cidade.id, 'governa', { scope: { kind: 'cenas', fromYear: null, toYear: null, storyIds: [], sceneIds: [terra.scenes[1], ...ozmaBook.scenes] } })
    rel(espantalho.id, cidade.id, 'governa', { scope: ev2(terra.scenes[0]), note: 'No começo do livro 2, ainda é o Espantalho.' })
    rel(dorothy.id, ozma.id, 'amiga de', { scope: ev2(ozmaBook.scenes[1]) })
    rel(langwidere.id, dorothy.id, 'prende na torre', { scope: ev2(ozmaBook.scenes[1]) })
    rel(tiktok.id, dorothy.id, 'acompanha', { scope: ev2(ozmaBook.scenes[1]) })
    rel(lulea.id, capa.id, 'teceu')
    rel(zixi.id, ix.id, 'governa')
    rel(zixi.id, capa.id, 'quer', { scope: ev2(zixiBook.scenes[1]) })
    rel(ix.id, nolandia.id, 'vizinho de')
    // A única ponte com Oz é o mapa: o mesmo mundo, além do deserto.
    rel(ix.id, deserto.id, 'fica do outro lado do')
    fact({ subjectId: magico.id, predicate: 'deu a Mombi', value: 'a bebê Ozma, para esconder', speakerId: mombi.id, sourceSceneId: terra.scenes[1], quote: 'O Mágico me trouxe a menina Ozma, que naquele tempo não passava de um bebê' })
    fact({ subjectId: tip.id, predicate: 'é', objectId: ozma.id, value: '', speakerId: mombi.id, sourceSceneId: terra.scenes[1], quote: 'aquela é a Princesa Ozma' })
    ;[u] = insert(u, 'events', { ...draftEvent('Tip volta a ser a Princesa Ozma', 1902), importance: 3, entityIds: [tip.id, ozma.id, glinda.id, mombi.id], placeId: cidade.id })
    ;[u] = insert(u, 'events', { ...draftEvent('Reinado de Ozma', 1902), kind: 'era', endYear: null, importance: 3 })
    ;[u] = insert(u, 'events', { ...draftEvent('Dorothy volta a Oz pelo mar', 1907), importance: 2, entityIds: [dorothy.id, ozma.id], placeId: ev.id })
    ;[u] = insert(u, 'seeds', {
      ...draftSeed('Quem são os pais de Tip?', 'misterio'),
      description: 'Tip não se lembra dos pais. O livro 1 nunca disse de quem era o trono que o Mágico ocupava.',
      status: 'resolvida',
      setupSceneId: terra.scenes[0],
      payoffSceneId: terra.scenes[1],
      entityIds: [tip.id, ozma.id, magico.id],
    })
    stories.push(
      { id: terra.story.id, title: 'A Maravilhosa Terra de Oz', author: 'L. Frank Baum', year: '1904', blurb: 'O segundo livro de Oz: um menino, uma cabeça de abóbora e o segredo que o Mágico guardou.' },
      { id: ozmaBook.story.id, title: 'Ozma de Oz', author: 'L. Frank Baum', year: '1907', blurb: 'O terceiro livro de Oz: Dorothy volta, agora pelo mar, e conhece a nova governante.' },
      { id: zixiBook.story.id, title: 'A Rainha Zixi de Ix', author: 'L. Frank Baum', year: '1905', blurb: 'No mesmo mundo, do outro lado do deserto: uma capa mágica, um rei menino e uma rainha-bruxa que não suporta o espelho.' },
    )
  }

  // ─── Livros: prontos na estante, para ver a diagramação (a série com o mesmo estilo) ─
  {
    let first: string | null = null
    for (const st of stories) {
      let book
      ;[u, book] = addBook(u, { title: st.title, storyIds: [st.id], styleFrom: first })
      u = updateBook(u, book.id, {
        author: st.author,
        year: st.year,
        blurb: st.blurb,
        ...(first ? {} : { epigraph: 'Não há lugar como o nosso lar.', epigraphSource: 'Dorothy', chapterStyle: 'ornamentado' as const, ornament: '✦' }),
      })
      first ??= book.id
    }
  }

  // ─── Ideias ──────────────────────────────────────────────────────────
  ;[u] = insert(u, 'inbox', {
    text: 'Ideia: e se a moça Munchkin ainda esperasse o Lenhador, e não soubesse que ele é de lata?',
    source: 'captura',
    sourceName: '',
    status: 'aberto',
  })
  u = { ...u, settings: { ...u.settings, playersLinked: true } }
  return u
}
