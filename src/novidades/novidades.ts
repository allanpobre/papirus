/*
 * O que mudou no Papirus, para quem usa (não é o changelog técnico). A mais nova primeiro. Ao mudar o app de um
 * jeito que a pessoa note, acrescente uma entrada no alto (com um id novo): quem abrir depois vê o aviso.
 */
export interface Novidade {
  /** Único e crescente (a data, e uma letra se houver duas no mesmo dia). */
  id: string
  /** Quando, como se lê ("19 de novembro"). */
  when: string
  title: string
  items: string[]
}

export const NOVIDADES: Novidade[] = [
  {
    id: '2026-11-19e',
    when: '19 de novembro',
    title: 'Culturas vivas',
    items: [
      'Numa cultura, a “Oficina da cultura” traz cartas sobre o dia a dia: comida, roupa, cumprimento, tabu, mortos, o que é belo, trabalho e como se vira adulto.',
      'Toque numa carta e escolha uma ideia ou escreva a sua: a resposta vira um campo da ficha.',
      '“Um dia na vida”: um texto curto montado com as respostas (e o “olá” na língua do povo), para pôr na descrição.',
      'Festas de todo ano, com mês e dia do calendário do mundo, aparecem no alto da Linha do tempo.',
    ],
  },
  {
    id: '2026-11-19d',
    when: '19 de novembro',
    title: 'Línguas de verdade',
    items: [
      'Num povo ou cultura, a parte “Língua” começa com cartas de som (áspero, macio, muitas vogais…) que montam as sílabas.',
      'Nomes de pessoa, de lugar (com um fim como “-heim”) e de família (com um começo como “Mac”).',
      'Um dicionário pequeno, com “Gerar” palavra, e uma frase traduzida palavra a palavra.',
      'Lugares sugeridos no estilo de um povo já saem com o fim de lugar dele.',
    ],
  },
  {
    id: '2026-11-19c',
    when: '19 de novembro',
    title: 'Rolar no mundo',
    items: [
      'No Mundo, o botão “Rolar” sorteia boatos, encontros na estrada, nomes de taverna, segredos, o clima do dia e festas.',
      'O sorteio usa o seu mundo: lugares, povos, personagens e grupos que já existem (nunca os secretos), e nomes novos na língua de um povo.',
      'Gostou? “Virar pista” leva para a Trama; “Virar ideia” guarda em Ideias. As tabelas que você cria na Mesa também aparecem.',
    ],
  },
  {
    id: '2026-11-19b',
    when: '19 de novembro',
    title: 'Cada ficha é dos seus livros',
    items: [
      'Escolhendo um livro no alto, só aparecem as fichas daquele livro: as que estão no texto dele e as que você pôs nele.',
      'Ficha criada com um livro escolhido já nasce dele. Ficha sem livro e sem cena fica em “Todos os livros”.',
      'Para dizer de qual livro é: na ficha, “Livros desta ficha”; para várias de uma vez, “Selecionar” → “Livro”.',
      'Consertado: textos do “Quem é” que ficavam um em cima do outro no celular.',
      'Esta janela de novidades: ela aparece depois de cada atualização e fica no Menu.',
    ],
  },
  {
    id: '2026-11-19a',
    when: '19 de novembro',
    title: 'Nova cara (teste)',
    items: [
      'Cada mundo pode ter o seu clima: fantasia, ficção científica, terror ou caderno, em escuro ou claro. Ligue em Ajustes › Universo › “Nova cara (teste)”.',
      'Escolha o livro pelas capas; uma faixa no alto mostra sempre em qual livro você está.',
      'Barra de baixo com lugares fixos: Escrever, Mundo, História, Mesa e Menu. A Linha do tempo foi para a História.',
      'A ficha vira tela de personagem: retrato em moldura, atributos em volta, selos do “Quem é” e abas.',
      'Personagem novo abre num criador: papel e espécie (ou povo) escolhidos em cartas.',
      'Poderes como constelação: as estrelas acendem conforme a história; arraste uma até outra para ligar.',
      'Fichas como cartas com rosto; o Mundo abre no mapa e cada país mostra quem vive lá.',
      'Ligações como mural: uma ficha no centro e só as ligações dela, seguindo a régua da história.',
    ],
  },
  {
    id: '2026-11-18',
    when: '18 de novembro',
    title: 'A ficha acompanha a história',
    items: [
      'Régua “Até onde na história”: veja a ficha como ela está numa cena, e “Ver como o leitor” esconde o que ele ainda não sabe.',
      'Fases: o personagem muda ao longo da história (nome, campos, retrato), com o porquê.',
      'Revelações: o leitor só descobre a espécie, uma ligação ou um trecho numa cena; até lá, vê uma máscara.',
      'A ficha é uma página de blocos editada no lugar; “Aparece em” mostra o nome em destaque.',
      'Referências (o que inspirou a ficha), poderes e magia em árvore, e sugestões tiradas do texto.',
      'Série: vários livros juntos no seletor; “Ouvir o livro” para no fim do livro e lembra onde parou.',
      'Backup completo, com as versões guardadas; histórias inteiras do universo alternativo podem virar canon.',
    ],
  },
]

const KEY = 'papirus:novidades-vistas'

/** A última novidade que esta pessoa já viu (neste aparelho). */
export function lastSeen(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function markSeen() {
  try {
    localStorage.setItem(KEY, NOVIDADES[0].id)
  } catch {
    // Sem armazenamento: o aviso volta na próxima vez (sem problema).
  }
}

let warned = false
/** Avisar uma vez só por abertura do app (e já marcar como visto: o aviso não volta a cada abertura). */
export function takeUnseen(): boolean {
  if (warned || !hasUnseen()) return false
  warned = true
  markSeen()
  return true
}

/** Há novidade que ainda não viu? Na primeira vez no app (nunca viu nada), não incomoda: só marca. */
export function hasUnseen(): boolean {
  const seen = lastSeen()
  if (seen === null) {
    markSeen()
    return false
  }
  return seen < NOVIDADES[0].id
}
