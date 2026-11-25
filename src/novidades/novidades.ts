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
    id: '2026-11-25a',
    when: '25 de novembro',
    title: 'Duas abas não apagam mais o texto uma da outra',
    items: [
      'Abriu o mesmo universo em outra aba (ou no app instalado e no navegador)? A mais nova fica com ele; a outra salva o que tinha e fica só para ler, com o aviso “Este universo está aberto em outra aba”.',
      '“Continuar aqui” traz o universo de volta, já com o que foi escrito na outra aba.',
    ],
  },
  {
    id: '2026-11-24a',
    when: '24 de novembro',
    title: 'Versões do personagem na própria ficha',
    items: [
      'No alto da ficha, a barra “Versões”: o começo, cada versão do personagem e “+ Nova versão”.',
      'A versão nova já vem com a ficha de antes preenchida: troque só o que muda (nome, retrato, resumo, cada campo) e diga desde qual cena, ou deixe planejada.',
      'Tocar numa versão mostra a ficha inteira como ela é ali; “Editar esta versão” e “Voltar para agora” ficam no aviso.',
    ],
  },
  {
    id: '2026-11-21c',
    when: '21 de novembro',
    title: 'A ficha nasce em cartas',
    items: [
      'Ao criar e abrir uma ficha, ela nasce em cartas na cor do tipo: o rosto (retrato, uma linha e as referências), as faíscas e o lugar no mundo.',
      'Faíscas: uma pergunta por carta. Sem ideia? “Sortear do meu mundo” inventa uma resposta com os lugares, grupos e pessoas que já existem.',
      'Lugar no mundo: toque numa ficha e escolha como se ligam (“nasceu em”, “rival de”…). No fim, a carta vira a ficha pronta.',
      'Prefere o jeito rápido? “Pular” em qualquer carta, ou desligue em Ajustes › Escrita.',
    ],
  },
  {
    id: '2026-11-21b',
    when: '21 de novembro',
    title: 'Referências à vista',
    items: [
      'As referências saíram do fim da ficha: agora ficam numa faixa logo abaixo do nome, em Ler e em Editar.',
      'No +, cole um link, uma frase, o nome de um personagem de outra obra ou uma imagem (colada ou solta): o Papirus entende o que é.',
      'Tocar numa referência abre em grande, para marcar o que você pegou dela. Continuam só suas: nunca vão para a wiki nem para o leitor.',
    ],
  },
  {
    id: '2026-11-21a',
    when: '21 de novembro',
    title: 'Fases planejadas',
    items: [
      'Uma fase do personagem pode existir antes da cena: “Fase planejada”, com um “quando” em texto livre (“Livro 2”, “depois da guerra”).',
      'Ela aparece em “Ao longo da história”, com como a ficha ficaria, e só você vê: não vai para o leitor, a wiki nem o link de leitura.',
      'Quando a cena existir, escolha-a na fase e ela passa a valer dali em diante.',
    ],
  },
  {
    id: '2026-11-20c',
    when: '20 de novembro',
    title: 'As oficinas do mundo na wiki',
    items: [
      'A wiki agora mostra as festas de cada cultura e as palavras do dicionário da língua.',
      'Na linha do tempo da wiki, cada evento diz por causa de quê aconteceu.',
      'Os mapas da wiki mostram as rotas, com os dias de viagem.',
    ],
  },
  {
    id: '2026-11-20b',
    when: '20 de novembro',
    title: 'Poder e tensões',
    items: [
      'Num lugar, reino ou grupo, “Poder e tensões”: quem manda, com “E se cair?” (quem sente o golpe e quem pode herdar).',
      'O que produz e o que precisa: o Papirus sugere comércio entre quem produz e quem precisa, e cria a ligação com um toque.',
      'Tensões num medidor (calmo, tenso, em guerra), que aparecem no mapa como linhas amarelas ou vermelhas (camada “Tensões”).',
      'As oficinas do mundo (cultura, panteão e poder) agora aparecem também na leitura da ficha, para quem escreve.',
    ],
  },
  {
    id: '2026-11-20a',
    when: '20 de novembro',
    title: 'Panteão e crenças',
    items: [
      'Numa religião, “Panteão e crenças”: os deuses viram estrelas num céu, com o domínio de cada um e linhas de quem é filho de quem.',
      '“Nova lenda” cria uma lenda ligada ao deus (ou à fé), pronta para o mito.',
      '“Quem acredita”: povos, grupos e pessoas que seguem a fé, com o que ela promete, proíbe e o ritual.',
      'Tudo vira ligação comum entre fichas: aparece em Ligações, no grafo e na wiki.',
    ],
  },
  {
    id: '2026-11-19g',
    when: '19 de novembro',
    title: 'Linha do tempo em faixas',
    items: [
      'Na Linha do tempo, “Faixas”: uma faixa por personagem, por reino ou grupo, ou por lugar, com as eras no fundo.',
      'Arraste um evento para o lado para mudar o ano (com “Desfazer”).',
      'Causa e consequência: no evento, “Causado por”. Nas faixas, uma seta liga os dois, e um aviso aparece se a consequência ficar antes da causa.',
      'Com a régua da história numa cena, uma linha mostra em que ano a história está.',
    ],
  },
  {
    id: '2026-11-19f',
    when: '19 de novembro',
    title: 'Mapas com rotas e dias de viagem',
    items: [
      'No mapa, “Rota” liga dois lugares: estrada, trilha, rio ou mar, com os dias de viagem a pé, a cavalo ou de barco.',
      'Dê a escala do mapa (dias a pé de ponta a ponta) e as rotas calculam os dias sozinhas; ou escreva os dias.',
      'No “Caminho de” um personagem, aparece quanto leva cada trecho e um aviso quando a história o faz viajar rápido demais.',
      'Camadas: mostre ou esconda fronteiras, povos e línguas, crenças e rotas. Regiões agora também podem ser de um povo ou de uma religião.',
      'Sem mapa? “Gerar” cria um continente (costa, montanhas, rios e florestas) para marcar os lugares por cima.',
    ],
  },
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
