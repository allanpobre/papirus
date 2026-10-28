import type { Guide } from './guides'

/**
 * Técnicas de escrita (valem para qualquer gênero) e guias para quem mestra RPG.
 * Mesmo formato dos gêneros: livros por descrição, curiosidades verificáveis e exercícios.
 */
export const CRAFT_GUIDES: Guide[] = [
  {
    id: 'personagem',
    section: 'tecnica',
    label: 'Personagem',
    lede: 'Gente que quer coisas, erra, escolhe e muda (ou se recusa a mudar).',
    expect: 'O leitor segue uma história por causa de alguém. Uma personagem viva tem desejo, contradições e decisões que custam caro.',
    works: [
      { title: 'Desejo e necessidade', text: 'O que a personagem quer (a vingança, o prêmio) e o que ela precisa (perdoar, pedir ajuda) quase nunca são a mesma coisa. A distância entre os dois é o arco.' },
      { title: 'Escolhas sob pressão', text: 'Dizer que alguém é corajoso não convence. Ponha a personagem numa escolha difícil, com algo a perder, e deixe a decisão mostrar quem ela é.' },
      { title: 'Uma contradição', text: 'O médico que tem medo de sangue, a ladra que nunca mente. Uma contradição bem escolhida torna a personagem memorável e cria cenas sozinha.' },
      { title: 'Voz própria', text: 'Cada personagem fala, pensa e repara nas coisas de um jeito. Tire os nomes de uma página de diálogo: ainda dá para saber quem disse o quê?' },
      { title: 'Secundários com vida', text: 'Os personagens de apoio também querem coisas. Se só existem para ajudar o protagonista, viram móveis.' },
    ],
    traps: [
      'A personagem perfeita: boa em tudo, amada por todos, sem defeito que pese.',
      'Descrição física em lista, de preferência na frente do espelho.',
      'Mudar de opinião de um capítulo para o outro sem que nada tenha acontecido para isso.',
      'Protagonista passivo, que só reage ao que os outros fazem.',
    ],
    books: [
      { title: 'Aspectos do Romance', author: 'E. M. Forster', what: 'A origem da ideia de personagens “planas” e “redondas”, em palestras curtas e bem-humoradas.' },
      { title: 'Story', author: 'Robert McKee', what: 'Escrito para roteiristas: a personagem de verdade aparece nas escolhas que faz sob pressão.' },
      { title: 'A Arte da Ficção', author: 'David Lodge', what: 'Cinquenta capítulos curtos, cada um sobre uma técnica, com exemplos tirados de romances conhecidos.' },
    ],
    facts: [
      'Em “Aspectos do Romance” (1927), E. M. Forster escreveu que o teste de uma personagem redonda é ela ser capaz de surpreender de um jeito convincente.',
      'Até hoje se discute se Capitu traiu Bentinho em “Dom Casmurro” (1899). Quem conta a história é o próprio Bentinho, ciumento, e o livro nunca responde.',
      '“Dom Quixote”, de Cervantes (a primeira parte é de 1605), costuma ser chamado de primeiro romance moderno. O herói é ao mesmo tempo ridículo e comovente.',
    ],
    exercises: [
      { title: 'Entrevista', prompt: 'Entreviste a sua personagem: do que ela tem vergonha? O que nunca contou a ninguém? O que faria por dinheiro? Escreva as respostas na voz dela.' },
      { title: 'A escolha', prompt: 'Escreva uma cena em que a personagem precisa escolher entre duas coisas que quer muito. Não pode ter as duas.' },
      { title: 'O que tem no bolso', prompt: 'Descreva o que a personagem carrega no bolso ou na bolsa hoje. Cada objeto deve contar algo sobre ela.' },
    ],
  },
  {
    id: 'estrutura',
    section: 'tecnica',
    label: 'Estrutura',
    lede: 'Começo, meio e fim, e as viradas que fazem o leitor seguir.',
    expect: 'A sensação de que a história vai a algum lugar: cada parte muda a situação, e o final responde à pergunta que o começo fez.',
    works: [
      { title: 'Viradas, não só eventos', text: 'Uma cena que não muda nada (uma relação, um plano, o que se sabe) pode ser cortada. Pergunte: o que é diferente no fim desta cena?' },
      { title: 'O ponto sem volta', text: 'Perto do meio, algo impede a personagem de voltar atrás. O meio deixa de arrastar quando o caminho fica mais estreito.' },
      { title: 'Promessa e pagamento', text: 'O que aparece no começo cria expectativa no leitor; cumpra no fim. É a ideia atribuída a Tchékhov: a arma na parede no primeiro ato tem de disparar depois.' },
      { title: 'O clímax é uma escolha', text: 'O final mais forte vem de uma decisão da personagem, e não de algo que acontece com ela.' },
      { title: 'Quatro tempos', text: 'Nem toda história precisa de conflito. O kishōtenketsu apresenta, desenvolve, vira e junta: a virada inesperada dá sentido ao que veio antes.' },
    ],
    traps: [
      'O meio que se arrasta: personagens esperando a história acontecer.',
      'Resolver o final por coincidência ou com alguém que chega de fora (o “deus ex machina”).',
      'Seguir uma fórmula de batidas à risca e esquecer a personagem. Estrutura é mapa, não trilho.',
    ],
    books: [
      { title: 'Poética', author: 'Aristóteles', what: 'O texto mais antigo sobre enredo que temos: começo, meio e fim, a virada da sorte e o reconhecimento.' },
      { title: 'O Herói de Mil Faces', author: 'Joseph Campbell', what: 'Os mitos do mundo comparados: a partida, as provas e o retorno que inspiraram a “jornada do herói”.' },
      { title: 'Morfologia do Conto Maravilhoso', author: 'Vladimir Propp', what: 'Contos populares desmontados em funções que se repetem, como peças de montar.' },
    ],
    facts: [
      'Vladimir Propp analisou cem contos populares russos e encontrou 31 “funções” que se repetem, como a partida do herói e a luta com o vilão (1928).',
      'George Lucas contou que “O Herói de Mil Faces”, de Joseph Campbell, ajudou a dar forma a “Star Wars” (1977).',
      'O kishōtenketsu vem da poesia chinesa e é muito usado no Japão, em contos e mangás: quatro tempos, com a virada no terceiro.',
    ],
    exercises: [
      { title: 'Em uma frase', prompt: 'Resuma a sua história assim: “Quando [algo acontece], [personagem] precisa [objetivo] antes que [consequência].” Se não couber, o que falta decidir?' },
      { title: 'Cartões de cena', prompt: 'Liste as cenas que você já tem, uma por linha, e escreva ao lado o que muda em cada uma. Onde não muda nada?' },
      { title: 'Do fim para o começo', prompt: 'Escreva a última cena da história agora, mesmo sem saber o meio. Depois, anote três coisas que o começo precisa prometer para ela funcionar.' },
    ],
  },
  {
    id: 'dialogo',
    section: 'tecnica',
    label: 'Diálogo',
    lede: 'Falas que soam como gente e fazem a história andar.',
    expect: 'Conversas que parecem naturais, mas são mais afiadas que as de verdade: cada fala revela alguém ou muda alguma coisa.',
    works: [
      { title: 'Subtexto', text: 'As pessoas raramente dizem o que sentem. Deixe a briga sobre a louça ser, na verdade, sobre o casamento.' },
      { title: 'Cada um fala de um jeito', text: 'Vocabulário, tamanho das frases, manias. Uma personagem que responde com perguntas, outra que nunca termina as frases.' },
      { title: 'Corte a conversa fiada', text: '“Oi.” “Oi, tudo bem?” “Tudo.” Pule os cumprimentos e entre quando a conversa fica interessante.' },
      { title: '“Disse” é invisível', text: 'O leitor nem repara em “disse”. Verbos como “exclamou” e “redarguiu” chamam atenção para o texto e tiram da cena.' },
      { title: 'Ação entre as falas', text: 'Um gesto no lugar do “disse” mostra quem fala e o que sente: “Ela empurrou o prato. — Não estou com fome.”' },
    ],
    traps: [
      '“Como você sabe…”: personagens contando um ao outro o que os dois já sabem, só para informar o leitor.',
      'Um advérbio em cada fala (“disse, irritado”). Deixe a fala mostrar a irritação.',
      'Sotaque escrito letra por letra em todas as falas. Um traço ou dois bastam.',
      'Discursos: falas enormes, sem interrupção nem reação de quem ouve.',
    ],
    books: [
      { title: 'Grande Sertão: Veredas', author: 'João Guimarães Rosa', what: 'Um único fôlego de fala: Riobaldo conta a vida a um ouvinte que nunca responde.' },
      { title: 'Colinas como Elefantes Brancos', author: 'Ernest Hemingway', what: 'Conto quase só de diálogo em que o assunto principal nunca é dito em voz alta.' },
      { title: 'O Apanhador no Campo de Centeio', author: 'J. D. Salinger', what: 'A voz de Holden é tão marcada que dá para reconhecê-la em qualquer frase.' },
    ],
    facts: [
      'Nas suas “10 regras para escrever”, Elmore Leonard aconselhava nunca usar outro verbo além de “disse” para marcar uma fala.',
      'Em português, o diálogo costuma vir com travessão; em inglês, com aspas. Saramago, em vários romances, dispensou os dois e marcou as falas só com vírgula e letra maiúscula.',
      'Em “Grande Sertão: Veredas” (1956), quem ouve Riobaldo nunca fala: só sabemos dele pelo que o narrador responde.',
    ],
    exercises: [
      { title: 'Só falas', prompt: 'Escreva uma cena só com diálogo, sem “disse” nem descrição. O leitor precisa saber quem fala pelo jeito de cada um.' },
      { title: 'O mesmo recado, três bocas', prompt: 'Uma criança, uma advogada e um avô contam a mesma notícia ruim. Escreva as três versões.' },
      { title: 'Ninguém termina a frase', prompt: 'Escreva uma discussão em que as personagens se interrompem o tempo todo. O que cada uma tenta dizer e não consegue?' },
    ],
  },
  {
    id: 'ritmo',
    section: 'tecnica',
    label: 'Ritmo e tensão',
    lede: 'Quando acelerar, quando respirar e como fazer o leitor virar a página.',
    expect: 'Variação: momentos que prendem a respiração e momentos para digerir. Tensão vem de querer saber o que acontece, e de temer o que pode acontecer.',
    works: [
      { title: 'Frases curtas na ação', text: 'Na perseguição, frases curtas. Parágrafos curtos. No respiro, as frases podem se alongar, olhar em volta, lembrar.' },
      { title: 'Cena e respiro', text: 'Depois de um acontecimento forte, dê uma cena para a personagem reagir e decidir o próximo passo. É ali que o leitor sente o peso.' },
      { title: 'Um relógio correndo', text: 'Um prazo (até o amanhecer, antes do navio partir) transforma qualquer busca em corrida.' },
      { title: 'Termine com uma pergunta', text: 'Capítulos que acabam com uma pergunta aberta (quem bateu à porta?) são os que o leitor não consegue fechar.' },
      { title: 'Suspense é saber da bomba', text: 'Mostre ao leitor o perigo que a personagem ainda não viu. A espera vira tensão.' },
    ],
    traps: [
      'Ação o tempo todo: sem respiro, o leitor cansa e nada pesa.',
      'Um flashback longo logo depois de um gancho, quando o leitor só quer saber o que vem.',
      'Descrição demorada no meio do clímax.',
    ],
    books: [
      { title: 'As Mil e Uma Noites', author: 'Anônimo', what: 'Xerazade sobrevive porque interrompe cada história no ponto mais interessante.' },
      { title: 'O Conde de Monte Cristo', author: 'Alexandre Dumas', what: 'Escrito para sair em capítulos no jornal, cada um deixando o leitor querendo o próximo.' },
      { title: 'Hitchcock/Truffaut', author: 'François Truffaut', what: 'Entrevistas em que Hitchcock explica, filme a filme, como cria suspense.' },
    ],
    facts: [
      'Na entrevista a Truffaut, Hitchcock explicou: se o público vê a bomba debaixo da mesa, uma conversa banal vira suspense; se só a vê explodir, tem alguns segundos de surpresa.',
      '“O Guarani”, de José de Alencar, saiu primeiro em folhetim no Diário do Rio de Janeiro, em 1857, um pedaço por vez.',
      '“O Conde de Monte Cristo” foi publicado em folhetim no Journal des Débats, entre 1844 e 1846.',
    ],
    exercises: [
      { title: 'Ponha um relógio', prompt: 'Reescreva uma cena calma acrescentando um prazo: algo vai acontecer em dez minutos. O que muda nas falas e nos gestos?' },
      { title: 'Curto e longo', prompt: 'Escreva uma perseguição só com frases de até oito palavras. Depois, a cena seguinte, de respiro, com frases longas.' },
      { title: 'O gancho', prompt: 'Termine o capítulo que você está escrevendo com uma pergunta que o leitor precise ver respondida.' },
    ],
  },
  {
    id: 'revisao',
    section: 'tecnica',
    label: 'Revisão',
    lede: 'O primeiro rascunho é para contar a história a você. A revisão é para o leitor.',
    expect: 'Um texto em que nada sobra: cada cena tem motivo, cada frase se lê sem tropeço.',
    works: [
      { title: 'Deixe descansar', text: 'Guarde o texto por alguns dias (ou semanas) antes de revisar. Com distância, você lê o que está escrito, e não o que quis escrever.' },
      { title: 'Leia em voz alta', text: 'O ouvido pega repetições, frases tortas e diálogos falsos que o olho deixa passar. No Papirus, o “Ouvir” do Livro ajuda.' },
      { title: 'Revise em camadas', text: 'Primeiro a história (cenas que sobram ou faltam), depois cada cena, por último as frases. Polir uma frase de uma cena que vai sair é tempo perdido.' },
      { title: 'Corte dez por cento', text: 'Quase todo rascunho fica melhor mais curto. Comece pelos advérbios, pelas explicações repetidas e pelos começos de cena.' },
      { title: 'Leitores com filtro', text: 'Quando vários leitores tropeçam no mesmo lugar, o problema é real, mesmo que a solução que sugerem não seja a melhor.' },
    ],
    traps: [
      'Revisar o primeiro capítulo vinte vezes antes de escrever o segundo.',
      'Polir frases de uma cena que talvez nem fique no livro.',
      'Aceitar toda sugestão, ou nenhuma.',
    ],
    books: [
      { title: 'Como Escrever Bem', author: 'William Zinsser', what: 'Clareza, simplicidade e corte do que sobra, com exemplos de antes e depois.' },
      { title: 'Manual de Redação e Estilo', author: 'Eduardo Martins', what: 'Referência de jornal para as dúvidas de português do dia a dia.' },
      { title: 'Sobre a Escrita', author: 'Stephen King', what: 'Mostra um trecho do próprio autor antes e depois da revisão.' },
    ],
    facts: [
      'Stephen King conta em “Sobre a Escrita” a fórmula que recebeu de um editor: segunda versão = primeira versão menos 10%.',
      'Graciliano Ramos comparava escrever ao trabalho das lavadeiras de Alagoas: molhar, torcer, bater e torcer de novo, até não pingar mais nada.',
      'Os contos de Raymond Carver em “Do Que Estamos Falando Quando Falamos de Amor” (1981) foram muito cortados pelo editor Gordon Lish. A versão original só saiu em 2009, com o título “Iniciantes”.',
    ],
    exercises: [
      { title: 'Menos dez por cento', prompt: 'Pegue uma cena sua, veja quantas palavras tem e corte 10% sem perder nada importante.' },
      { title: 'Em voz alta', prompt: 'Leia em voz alta um capítulo seu. Marque cada lugar em que você tropeçou ou perdeu o fôlego, e reescreva só esses trechos.' },
      { title: 'Uma coisa por vez', prompt: 'Releia um capítulo procurando só palavras repetidas. Depois, outra leitura só para os diálogos.' },
    ],
  },
  {
    id: 'mestrar',
    section: 'mestre',
    label: 'Mestrar',
    lede: 'Preparar situações, ouvir a mesa e deixar as escolhas pesarem.',
    expect: 'Que as escolhas dos jogadores importem. O mestre prepara situações, não roteiros, e reage ao que o grupo faz.',
    works: [
      { title: 'Sessão zero', text: 'Antes de jogar, combinem o tom, o que fica fora da mesa, a frequência e o que cada um quer da campanha. Evita mais brigas do que qualquer regra.' },
      { title: 'Situações, não enredos', text: 'Prepare quem quer o quê, o que acontece se ninguém fizer nada e onde estão as pistas. Como o grupo chega lá, ele decide.' },
      { title: 'Comece na ação', text: 'Abra a sessão com algo acontecendo: um grito na taverna, uma carroça tombada na estrada. As apresentações podem vir depois.' },
      { title: '“Sim, e…” ou “sim, mas…”', text: 'Quando um jogador tenta algo criativo, procure um jeito de dizer sim, com uma consequência. O “não” seco esfria a mesa.' },
      { title: 'Holofote para todos', text: 'Repare quem falou pouco e traga a cena para essa pessoa. Um gancho para cada personagem ajuda.' },
    ],
    traps: [
      'O trilho: tudo o que o grupo tenta dá errado até seguir o caminho que o mestre planejou.',
      'O NPC do mestre que resolve os problemas no lugar dos jogadores.',
      'Parar o jogo dez minutos para conferir uma regra. Decida na hora e confira depois da sessão.',
      'Preparar páginas que ninguém vai ver: três NPCs bons valem mais que um continente detalhado.',
    ],
    books: [
      { title: 'Guia do Mestre (D&D 5ª edição)', author: 'Wizards of the Coast', what: 'Capítulos inteiros sobre criar aventuras, conduzir a mesa e improvisar.' },
      { title: 'Tormenta20: Livro Básico', author: 'Jambô Editora', what: 'O RPG de Arton, com uma parte dedicada a quem mestra.' },
      { title: 'Return of the Lazy Dungeon Master', author: 'Michael E. Shea', what: 'Em inglês: preparar a sessão em poucos passos, só com o que faz falta na mesa.' },
    ],
    facts: [
      'Dungeons & Dragons, criado por Gary Gygax e Dave Arneson, saiu em 1974 e é considerado o primeiro RPG comercial.',
      'Tormenta nasceu em 1999, criado por Marcelo Cassaro, Rogerio Saladino e J. M. Trevisan, e virou um dos cenários de RPG mais conhecidos do Brasil.',
      'O “X-Card”, criado por John Stavropoulos, é um cartão no meio da mesa: quem tocar nele tira de cena o que incomodou, sem precisar explicar.',
    ],
    exercises: [
      { title: 'Três NPCs em três linhas', prompt: 'Crie três NPCs, cada um com um desejo, um jeito de falar e um segredo. Uma linha para cada.' },
      { title: 'Um gancho por jogador', prompt: 'Para cada personagem do grupo, anote uma coisa da história dela que pode aparecer na próxima sessão.' },
      { title: 'Primeira cena em movimento', prompt: 'Escreva o primeiro minuto da próxima sessão começando no meio de algo acontecendo.' },
    ],
  },
  {
    id: 'aventuras',
    section: 'mestre',
    label: 'Aventuras e vilões',
    lede: 'Ganchos, pistas e vilões que aguentam o encontro com os jogadores.',
    expect: 'Um mundo que reage: vilões que agem entre as sessões, NPCs com vontade própria e mistérios que dá para resolver.',
    works: [
      { title: 'Regra das três pistas', text: 'Para cada conclusão que o grupo precisa tirar, espalhe pelo menos três pistas. Eles vão perder uma, ignorar outra e entender errado a terceira.' },
      { title: 'O vilão tem um relógio', text: 'Divida o plano do vilão em etapas. Se ninguém agir, a próxima etapa acontece, e o grupo sente o mundo andar.' },
      { title: 'NPC em três traços', text: 'Um desejo, um jeito de falar e um segredo. É o bastante para improvisar qualquer conversa.' },
      { title: 'Lugares com passado', text: 'Uma ruína fica interessante quando dá para descobrir, aos poucos, o que aconteceu ali.' },
      { title: 'Recompensas que mudam o jogo', text: 'Além de ouro: aliados, segredos, títulos, inimigos novos. O que muda a história fica na memória.' },
    ],
    traps: [
      'Uma única pista que, se ninguém achar, trava a aventura inteira.',
      'Vilão que só aparece na última sessão: o grupo precisa conhecê-lo antes de odiá-lo.',
      'NPC que só existe para entregar informação.',
    ],
    books: [
      { title: 'Apocalypse World', author: 'Vincent Baker', what: 'Em inglês: “frentes” e relógios que mostram o que as ameaças fazem quando ninguém as impede.' },
      { title: 'Blades in the Dark', author: 'John Harper', what: 'Em inglês: relógios de progresso para golpes, ameaças e facções.' },
      { title: 'A Regra das Três Pistas', author: 'Justin Alexander', what: 'Artigo do blog The Alexandrian, em inglês: mistérios que não travam na mesa.' },
    ],
    facts: [
      '“Tomb of Horrors” (A Tumba dos Horrores, 1978), de Gary Gygax, foi feita para desafiar jogadores experientes e ficou famosa como uma das aventuras mais mortais de D&D.',
      'Justin Alexander parte de uma constatação: os jogadores quase nunca encontram, entendem e usam a única pista que o mestre preparou. Por isso, três.',
      'Os relógios de progresso, popularizados por “Blades in the Dark” (2017), viraram ferramenta comum em muitos outros jogos.',
    ],
    exercises: [
      { title: 'Três pistas para uma verdade', prompt: 'Escolha um segredo da sua campanha e escreva três pistas diferentes que levam a ele, em três lugares diferentes.' },
      { title: 'O relógio do vilão', prompt: 'Escreva o plano do vilão em quatro etapas. O que acontece em cada uma, se ninguém impedir?' },
      { title: 'Uma ruína com passado', prompt: 'Descreva um lugar abandonado em três camadas: o que se vê, o que se descobre procurando e o que aconteceu ali de verdade.' },
    ],
  },
]
