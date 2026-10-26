/**
 * Oficina: guias curtos de escrita por gênero, com livros para estudar, curiosidades
 * e exercícios. Os livros aparecem por descrição (sem citar trechos de obras protegidas).
 */
export type GuideId = 'fundamentos' | 'fantasia' | 'ficcao' | 'misterio' | 'romance' | 'terror' | 'realismo'

export interface Guide {
  id: GuideId
  label: string
  lede: string
  /** O que quem lê o gênero espera encontrar. */
  expect: string
  works: { title: string; text: string }[]
  traps: string[]
  books: { title: string; author: string; what: string }[]
  facts: string[]
  exercises: { title: string; prompt: string }[]
}

export const GUIDES: Guide[] = [
  {
    id: 'fundamentos',
    label: 'Fundamentos',
    lede: 'O que vale para qualquer história, do conto de fadas ao policial.',
    expect: 'Quem lê quer alguém para acompanhar, alguém que quer algo e encontra obstáculos. O resto (mundo, estilo, reviravoltas) serve a isso.',
    works: [
      { title: 'Desejo e obstáculo', text: 'Toda cena fica mais viva quando alguém quer algo e alguma coisa atrapalha. Antes de escrever, pergunte: quem quer o quê aqui, e o que impede?' },
      { title: 'Mostrar e contar', text: '“Ela estava nervosa” conta. “Ela dobrou o guardanapo pela quarta vez” mostra. Mostre os momentos importantes; conte o que é só passagem.' },
      { title: 'Ponto de vista firme', text: 'Escolha de quem são os olhos em cada cena e fique com essa pessoa. Pular de cabeça em cabeça no mesmo parágrafo confunde.' },
      { title: 'Entre tarde, saia cedo', text: 'Comece a cena quando a coisa já está acontecendo e termine assim que o ponto foi feito. Chegadas, cumprimentos e despedidas quase sempre sobram.' },
      { title: 'Diálogo que faz duas coisas', text: 'Uma boa fala revela quem fala e move a história. Se só passa informação que os dois já sabem, corte ou transforme em conflito.' },
    ],
    traps: [
      'Explicar tudo no primeiro capítulo. O leitor aguenta não saber; é isso que o faz virar a página.',
      'Revisar o começo sem parar e nunca chegar ao fim. Termine o rascunho; revise depois.',
      'Personagens que concordam em tudo. Sem atrito, não há cena.',
    ],
    books: [
      { title: 'Sobre a Escrita', author: 'Stephen King', what: 'Metade memória, metade manual: hábitos, revisão e a “caixa de ferramentas” de quem escreve.' },
      { title: 'A Jornada do Escritor', author: 'Christopher Vogler', what: 'A jornada do herói adaptada para quem conta histórias: os estágios e os papéis que se repetem.' },
      { title: 'Salve o Gato!', author: 'Blake Snyder', what: 'Escrito para roteiro, mas muito usado por romancistas: uma estrutura em batidas que ajuda a organizar o meio da história.' },
    ],
    facts: [
      'Hemingway contou à revista Paris Review que reescreveu o final de “Adeus às Armas” 39 vezes antes de ficar satisfeito.',
      'Stephen King conta em “Sobre a Escrita” que tenta escrever cerca de 2.000 palavras por dia, todos os dias.',
      'Machado de Assis foi o primeiro presidente da Academia Brasileira de Letras, fundada em 1897.',
    ],
    exercises: [
      { title: 'A mesma cena, outro par de olhos', prompt: 'Pegue uma cena que você já escreveu e reescreva pelos olhos de outra personagem presente. O que ela nota que a primeira não notaria?' },
      { title: 'Só mostrar', prompt: 'Escreva uma cena em que uma personagem está com muito medo, sem usar a palavra “medo” nem sinônimos. Só gestos, corpo e ações.' },
      { title: 'Diálogo com subtexto', prompt: 'Dois personagens discutem quem vai lavar a louça, mas a briga de verdade é sobre outra coisa, que nenhum dos dois diz em voz alta.' },
    ],
  },
  {
    id: 'fantasia',
    label: 'Fantasia',
    lede: 'Mundos inventados, magia e povos que nunca existiram, com regras que o leitor acredita.',
    expect: 'Maravilha e coerência: um mundo que parece maior do que o livro e uma magia que tem custo. O leitor perdoa dragões, não perdoa trapaças.',
    works: [
      { title: 'Magia com preço', text: 'Uma magia que resolve tudo acaba com a tensão. Decida o que ela custa, o que não consegue fazer e quem não pode usar.' },
      { title: 'Mundo pelos olhos de alguém', text: 'Apresente o mundo pelo que a personagem nota e sente, não por aulas de história. Um detalhe estranho tratado como normal vale mais que uma página de explicação.' },
      { title: 'Nomes com família', text: 'Nomes do mesmo povo devem soar parecidos entre si. Isso dá unidade sem precisar inventar uma língua inteira.' },
      { title: 'O pequeno dentro do grande', text: 'Guerras e profecias importam mais quando mexem com uma pessoa que o leitor ama. Mantenha o foco na escala humana.' },
    ],
    traps: [
      'Abrir com o prólogo sobre a criação do mundo. Comece com uma personagem num problema.',
      'Encher o texto de nomes e termos inventados nas primeiras páginas.',
      'Resolver o clímax com um poder que nunca apareceu antes.',
    ],
    books: [
      { title: 'O Senhor dos Anéis', author: 'J. R. R. Tolkien', what: 'Um mundo com camadas de história e línguas, que parece existir além das páginas.' },
      { title: 'Harry Potter', author: 'J. K. Rowling', what: 'O leitor descobre as regras da magia junto com o protagonista, que também é novato.' },
      { title: 'As Crônicas de Gelo e Fogo', author: 'George R. R. Martin', what: 'Vários pontos de vista, cada capítulo com uma personagem, e consequências que ninguém escapa.' },
      { title: 'Mistborn', author: 'Brandon Sanderson', what: 'Um sistema de magia com regras claras, usado de forma criativa nas cenas de ação.' },
    ],
    facts: [
      'Tolkien escreveu que inventar línguas era a base de tudo: as histórias foram feitas para dar um mundo às línguas, e não o contrário.',
      'A primeira frase de “O Hobbit” foi rabiscada por Tolkien numa folha em branco de uma prova que estava corrigindo.',
      'J. K. Rowling teve a ideia de Harry Potter em 1990, num trem atrasado entre Manchester e Londres. O primeiro livro foi recusado por cerca de doze editoras.',
      'George R. R. Martin se inspirou na Guerra das Rosas, a disputa pelo trono inglês no século XV, para criar Westeros.',
    ],
    exercises: [
      { title: 'O preço da magia', prompt: 'Escreva uma cena em que usar magia resolve um problema, mas custa algo importante para quem usou.' },
      { title: 'Estranho e normal', prompt: 'Mostre uma manhã comum no seu mundo. Inclua um detalhe que seria impossível no nosso, tratado pelas personagens como a coisa mais normal do mundo.' },
    ],
  },
  {
    id: 'ficcao',
    label: 'Ficção científica',
    lede: '“E se…?” levado a sério: tecnologia, futuro e outras formas de sociedade.',
    expect: 'Uma ideia forte e suas consequências. O leitor quer pensar: o que essa tecnologia ou sociedade muda nas pessoas?',
    works: [
      { title: 'Uma grande ideia, bem explorada', text: 'Uma única mudança (viver 300 anos, ler pensamentos) pode render um livro inteiro. Siga as consequências em cadeia: economia, família, crime, amor.' },
      { title: 'Ciência na medida', text: 'Explique o suficiente para o leitor acreditar. Detalhes técnicos funcionam quando aparecem na ação, não em palestras.' },
      { title: 'O futuro tem cotidiano', text: 'Gírias, propagandas, comida, tédio. O dia a dia faz um futuro parecer vivido, e não um cenário.' },
      { title: 'Gente no centro', text: 'A ideia é o palco; a história é de alguém. Pergunte o que essa pessoa perde ou ganha por viver nesse mundo.' },
    ],
    traps: [
      'Personagens que explicam uns aos outros coisas que ambos já sabem (“como você sabe, o hiperespaço…”).',
      'Tecnologia que resolve qualquer problema na hora certa.',
      'Esquecer que a sociedade inteira reagiria à grande ideia, não só o protagonista.',
    ],
    books: [
      { title: 'Duna', author: 'Frank Herbert', what: 'Ecologia, religião e política se misturando num planeta deserto, com um mundo apresentado aos poucos.' },
      { title: '1984', author: 'George Orwell', what: 'Uma ideia (vigilância total) levada até o fim, vista por um homem comum.' },
      { title: 'Fundação', author: 'Isaac Asimov', what: 'A história em escala de séculos, contada em episódios com personagens diferentes.' },
      { title: 'Jogos Vorazes', author: 'Suzanne Collins', what: 'Distopia em primeira pessoa, no presente, com capítulos que terminam em gancho.' },
    ],
    facts: [
      '“Frankenstein” nasceu de um desafio entre amigos para escrever uma história de fantasma, no verão chuvoso de 1816. Mary Shelley tinha 18 anos.',
      'A palavra “robô” surgiu na peça “R.U.R.” (1920), do tcheco Karel Čapek. Quem sugeriu o nome foi o irmão dele, Josef.',
      'As Três Leis da Robótica apareceram em 1942, no conto “Runaround”, de Isaac Asimov (depois reunido em “Eu, Robô”).',
      '“Duna” foi recusado por cerca de vinte editoras antes de ser publicado por uma editora conhecida por manuais de conserto de automóveis.',
    ],
    exercises: [
      { title: 'E se…?', prompt: 'Escolha uma mudança tecnológica e escreva a cena de um café da manhã em família no mundo onde ela existe há 50 anos.' },
      { title: 'Propaganda do futuro', prompt: 'Escreva o anúncio de um produto do seu mundo, e depois uma cena em que alguém sofre por causa dele.' },
    ],
  },
  {
    id: 'misterio',
    label: 'Mistério',
    lede: 'Um enigma, pistas e uma resposta que surpreende e, ao mesmo tempo, parece inevitável.',
    expect: 'Jogo limpo: o leitor quer ter tido a chance de adivinhar. A solução surpreende, mas, relendo, as pistas estavam lá.',
    works: [
      { title: 'Comece pelo fim', text: 'Decida quem fez, como e por quê antes de escrever. Depois espalhe as pistas de trás para frente.' },
      { title: 'Pista à vista de todos', text: 'Esconda a pista certa no meio de outros detalhes, ou faça o leitor olhar para ela pelo motivo errado.' },
      { title: 'Suspeitos com segredos', text: 'Cada suspeito deve esconder alguma coisa, mesmo que não seja o crime. Isso cria pistas falsas honestas.' },
      { title: 'Ritmo de revelação', text: 'Responda uma pergunta e abra outra. Termine capítulos com uma descoberta ou uma dúvida nova.' },
    ],
    traps: [
      'Culpado que aparece só no fim, ou solução baseada numa informação que o leitor nunca teve.',
      'Detetive que descobre tudo por sorte ou coincidência.',
      'Explicar o crime num monólogo enorme no último capítulo.',
    ],
    books: [
      { title: 'E Não Sobrou Nenhum', author: 'Agatha Christie', what: 'Lugar fechado, poucos suspeitos e uma contagem regressiva que só aumenta a tensão.' },
      { title: 'O Cão dos Baskervilles', author: 'Arthur Conan Doyle', what: 'Atmosfera e uma explicação racional para o que parece sobrenatural.' },
      { title: 'Garota Exemplar', author: 'Gillian Flynn', what: 'Dois narradores que não são confiáveis, e uma virada no meio do livro que muda tudo.' },
      { title: 'O Código Da Vinci', author: 'Dan Brown', what: 'Capítulos curtíssimos que terminam em gancho: difícil parar de ler.' },
    ],
    facts: [
      'Agatha Christie é, segundo o Guinness, a autora de ficção mais vendida de todos os tempos.',
      '“Os Assassinatos da Rua Morgue” (1841), de Edgar Allan Poe, é considerado o primeiro conto policial moderno.',
      'Arthur Conan Doyle matou Sherlock Holmes em 1893. A pressão dos leitores foi tanta que ele trouxe o detetive de volta em 1903.',
      'Em dezembro de 1926, Agatha Christie desapareceu por onze dias. O mistério real nunca foi totalmente explicado.',
    ],
    exercises: [
      { title: 'Três pistas', prompt: 'Escreva uma cena num lugar comum (cozinha, escritório) com três detalhes: um que é pista de verdade, um que parece pista e não é, e um que só faz sentido no fim.' },
      { title: 'O álibi', prompt: 'Um suspeito conta onde estava na hora do crime. Escreva a fala dele de um jeito que pareça verdade, mas com uma pequena contradição.' },
    ],
  },
  {
    id: 'romance',
    label: 'Romance',
    lede: 'Duas pessoas, o que as aproxima e o que as separa.',
    expect: 'Química e obstáculo. O leitor quer torcer pelo casal e sentir que o caminho até eles ficarem juntos (ou não) é merecido.',
    works: [
      { title: 'O obstáculo vem de dentro', text: 'Mal-entendidos rendem pouco. Os melhores obstáculos são medos, orgulho, feridas antigas ou valores que se chocam.' },
      { title: 'Tensão nos detalhes', text: 'Um olhar, um quase toque, o que não é dito. A tensão cresce mais nos pequenos gestos que nas declarações.' },
      { title: 'Os dois mudam', text: 'Cada um precisa crescer para merecer o outro. Se só um muda, o romance fica desequilibrado.' },
      { title: 'Vida além do casal', text: 'Amigos, trabalho e família dão textura e criam conflitos que o casal precisa atravessar.' },
    ],
    traps: [
      'Um problema que se resolveria com uma conversa de cinco minutos.',
      'Interesse amoroso perfeito demais, sem defeitos nem vontade própria.',
      'Declarações grandiosas sem ações que provem o sentimento.',
    ],
    books: [
      { title: 'Orgulho e Preconceito', author: 'Jane Austen', what: 'O obstáculo é o próprio caráter dos dois; diálogos afiados e ironia.' },
      { title: 'Dom Casmurro', author: 'Machado de Assis', what: 'Um narrador apaixonado e ciumento que não é confiável: o leitor decide em que acreditar.' },
      { title: 'Como Eu Era Antes de Você', author: 'Jojo Moyes', what: 'Dois mundos muito diferentes e um prazo que pesa sobre cada cena.' },
      { title: 'Pessoas Normais', author: 'Sally Rooney', what: 'Anos na vida de um casal que se encontra e se perde, com o que não é dito no centro.' },
    ],
    facts: [
      'A primeira versão de “Orgulho e Preconceito” se chamava “Primeiras Impressões”.',
      'Os romances de Jane Austen saíram sem o nome dela; o primeiro foi assinado só como “por uma dama”.',
      'Até hoje leitores discutem se Capitu traiu ou não Bentinho em “Dom Casmurro” (1899): o livro só tem a versão dele.',
      'A história de Romeu e Julieta já existia antes de Shakespeare; ele se baseou num poema inglês de 1562.',
    ],
    exercises: [
      { title: 'O quase', prompt: 'Escreva uma cena em que os dois quase se beijam, quase se declaram ou quase se tocam, e algo interrompe. Faça o leitor sentir a frustração.' },
      { title: 'Briga com amor', prompt: 'Os dois brigam por um motivo pequeno. Por baixo, a briga revela o medo de cada um.' },
    ],
  },
  {
    id: 'terror',
    label: 'Terror',
    lede: 'Medo, inquietação e aquilo que não deveria estar ali.',
    expect: 'Tensão crescente. O leitor quer ter medo junto com a personagem, e o pior costuma ser o que ainda não apareceu.',
    works: [
      { title: 'O que não se vê', text: 'Sons, sombras, uma porta que estava fechada. Mostrar pouco assusta mais; a imaginação do leitor completa.' },
      { title: 'O normal que se torce', text: 'Comece no cotidiano e deixe o estranho entrar aos poucos. O medo cresce quando o lugar seguro deixa de ser seguro.' },
      { title: 'Personagens que o leitor ama', text: 'Só dá medo se o leitor se importa com quem está em perigo. Gaste tempo com elas antes do susto.' },
      { title: 'Ritmo de respiração', text: 'Alterne frases longas (calma, espera) e curtas (perigo). Dê momentos de alívio antes de apertar de novo.' },
    ],
    traps: [
      'Mostrar o monstro inteiro cedo demais.',
      'Personagens que fazem escolhas sem sentido só para o susto acontecer.',
      'Explicar demais a origem do mal; um pouco de mistério mantém o medo.',
    ],
    books: [
      { title: 'Drácula', author: 'Bram Stoker', what: 'Contado só por cartas, diários e recortes de jornal: o leitor monta o horror aos poucos.' },
      { title: 'O Iluminado', author: 'Stephen King', what: 'O lugar e a própria família viram a ameaça, num isolamento que só piora.' },
      { title: 'A Assombração da Casa da Colina', author: 'Shirley Jackson', what: 'O medo que nasce dentro da cabeça da personagem: nunca se sabe o que é real.' },
      { title: 'Frankenstein', author: 'Mary Shelley', what: 'O horror com pena: a criatura também sofre, e o leitor fica dividido.' },
    ],
    facts: [
      '“Drácula” (1897) é contado inteiro por documentos: cartas, diários, telegramas e notícias de jornal.',
      'Stephen King jogou no lixo o começo de “Carrie”. A esposa, Tabitha, tirou as folhas da lixeira e o convenceu a terminar.',
      'A ideia de “O Iluminado” veio de uma noite em que Stephen King e a esposa ficaram no quarto 217 de um hotel quase vazio, no Colorado.',
      '“A Assombração da Casa da Colina”, de Shirley Jackson, saiu em 1959 e ainda é citado como um dos melhores livros de casa assombrada.',
    ],
    exercises: [
      { title: 'Algo fora do lugar', prompt: 'Uma personagem chega em casa e um único objeto está fora do lugar. Escreva a cena sem revelar o que aconteceu.' },
      { title: 'Só sons', prompt: 'Escreva uma cena no escuro, em que a personagem só ouve. Use apenas o que ela escuta para criar o medo.' },
    ],
  },
  {
    id: 'realismo',
    label: 'Drama e realismo',
    lede: 'Gente como a gente: família, trabalho, cidade e as escolhas difíceis do dia a dia.',
    expect: 'Verdade. O leitor quer se reconhecer, ou reconhecer alguém, e sair do livro olhando a vida de outro jeito.',
    works: [
      { title: 'Detalhe específico', text: 'Não “uma cozinha”, mas a cozinha com o calendário de farmácia de 2019. O detalhe certo faz o leitor acreditar.' },
      { title: 'Conflitos pequenos, apostas grandes', text: 'Uma conversa no jantar pode decidir o destino de uma família. O drama está em quanto aquilo importa para a personagem.' },
      { title: 'Ninguém é só bom ou mau', text: 'Dê razões compreensíveis até para quem erra. Personagens contraditórios parecem gente.' },
      { title: 'Confie no leitor', text: 'Não explique o que a cena já mostrou. O que fica por dizer costuma ser o mais forte (a “teoria do iceberg”).' },
    ],
    traps: [
      'Personagens que dizem exatamente o que sentem, como num consultório.',
      'Final que amarra tudo com uma lição de moral.',
      'Descrever o dia inteiro: escolha os momentos em que algo muda.',
    ],
    books: [
      { title: 'Memórias Póstumas de Brás Cubas', author: 'Machado de Assis', what: 'Um narrador morto, irônico e sem pressa, que conversa com o leitor.' },
      { title: 'Vidas Secas', author: 'Graciliano Ramos', what: 'Frases secas como a paisagem; capítulos que quase se sustentam sozinhos.' },
      { title: 'A Hora da Estrela', author: 'Clarice Lispector', what: 'Um narrador que hesita em contar a história de Macabéa, e isso vira parte do livro.' },
      { title: 'O Sol é Para Todos', author: 'Harper Lee', what: 'Um tema duro visto pelos olhos de uma criança, que entende aos poucos.' },
    ],
    facts: [
      '“Memórias Póstumas de Brás Cubas” (1881) é narrado por um defunto, que se apresenta como “defunto autor”.',
      'Um capítulo de “Vidas Secas”, “Baleia”, foi publicado antes como conto. Rubem Braga chamou o livro de “romance desmontável”.',
      'Em “A Hora da Estrela” (1977), Clarice Lispector criou um narrador, Rodrigo S.M., que conta a história de Macabéa.',
      'Hemingway defendia a “teoria do iceberg”: mostrar só a ponta e deixar o resto implícito, como a parte do gelo que fica embaixo d’água.',
    ],
    exercises: [
      { title: 'O jantar', prompt: 'Uma família janta junta. Todos sabem de uma notícia ruim, mas ninguém fala dela. Escreva a cena.' },
      { title: 'Um objeto, uma vida', prompt: 'Descreva o quarto de uma personagem que acabou de ir embora. Pelos objetos, o leitor deve entender quem ela era.' },
    ],
  },
]

/** O guia que combina com o universo (pelos campos do modelo escolhido ao criar). */
export function guessGuide(fieldTemplates: Record<string, string[]>): GuideId {
  const all = Object.values(fieldTemplates).flat().join('|')
  if (fieldTemplates.magia) return 'fantasia'
  if (/Implantes|Tipo \(planeta/.test(all)) return 'ficcao'
  if (/Álibi/.test(all)) return 'misterio'
  if (/O que deseja|O que a machucou/.test(all)) return 'realismo'
  return 'fundamentos'
}
