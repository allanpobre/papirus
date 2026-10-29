import type { GuideId } from './guides'

/** O que o app conta no texto depois de um exercício (sem IA: só contas). */
export type Focus = 'frases' | 'dialogo' | 'falas' | 'mente' | 'repeticoes'

/** Um exercício de uma técnica: a proposta, o tempo, o mínimo e o que olhar depois. */
export interface Practice {
  prompt: string
  /** Minutos de escrita (0 = sem tempo). Padrão: 10. */
  minutes?: number
  /** Mínimo de palavras. Padrão: 150 (60 nos de mestre). */
  target?: number
  /**
   * Palavras que não podem aparecer. Com 4 letras ou mais, vale o começo ("assust" pega
   * "assustada"); mais curtas, a palavra inteira; com espaço, a expressão.
   */
  forbid?: string[]
  focus?: Focus[]
  /** Perguntas para quem escreveu olhar o próprio texto (o app não responde por ela). */
  ask: string[]
  /** Um antes e depois, para a lição. */
  example?: { tell: string; show: string }
  /** Exercício de mestre que pode ir para o Roteiro da próxima sessão. */
  mesa?: 'inicio' | 'cena'
}

/** Um exercício para cada técnica de cada guia, na mesma ordem de "O que funciona". */
export const PRACTICE: Record<GuideId, Practice[]> = {
  fundamentos: [
    {
      prompt: 'Alguém quer muito uma coisa simples (um lugar no ônibus, a última fatia de bolo) e algo atrapalha. Termine a cena sem resolver.',
      ask: ['Dá para dizer em uma frase o que a personagem quer?', 'O obstáculo fica mais forte do começo para o fim?'],
    },
    {
      prompt: 'Uma personagem com muito medo, sem usar “medo” nem palavras parecidas. Só gestos, corpo e ação.',
      forbid: ['medo', 'medos', 'medros', 'pavor', 'terror', 'assust', 'apavor', 'amedront', 'receio', 'temor', 'temia', 'temeu', 'aterroriz'],
      ask: ['Dá para saber o que ela sente só pelos gestos?', 'Qual gesto ficou mais forte?'],
      example: { tell: 'Ela estava nervosa.', show: 'Ela dobrou o guardanapo pela quarta vez.' },
    },
    {
      prompt: 'Duas pessoas no mesmo jantar. Escreva só pelos olhos de uma delas: o que ela vê, ouve e imagina. A outra aparece só pelo que faz e diz.',
      ask: ['Em algum momento você entrou na cabeça da outra pessoa?', 'O que a sua narradora nota que outra pessoa não notaria?'],
    },
    {
      prompt: 'Uma briga entre irmãos. Comece no meio da discussão, sem chegada nem cumprimento, e pare logo depois da frase mais dura.',
      focus: ['dialogo'],
      ask: ['A primeira frase já está no conflito?', 'Sobrou alguma linha depois do ponto alto?'],
    },
    {
      prompt: 'Um diálogo em que cada fala mostra quem fala e faz a história andar. Nenhuma fala pode só contar o que os dois já sabem.',
      focus: ['dialogo', 'falas'],
      ask: ['Escolha uma fala: o que ela revela de quem fala?', 'Alguma fala está ali só para o leitor saber de algo?'],
    },
  ],
  fantasia: [
    {
      prompt: 'Alguém usa magia para resolver um problema pequeno e paga um preço que não esperava. Mostre o preço na cena, sem explicação.',
      ask: ['O preço dói em algo que a personagem ama?', 'O leitor entende a regra sem uma aula?'],
    },
    {
      prompt: 'Uma feira no seu mundo, pelos olhos de alguém que vai ali toda semana. Inclua três coisas impossíveis no nosso mundo, tratadas como normais.',
      ask: ['Alguma frase explica o mundo como numa aula?', 'Qual detalhe estranho ficou mais natural?'],
    },
    {
      prompt: 'Invente cinco nomes de um povo e três de outro. Depois, uma cena em que alguém de um povo erra a pronúncia de um nome do outro.',
      target: 120,
      ask: ['Os nomes de cada povo soam parentes entre si?', 'Dá para saber de que povo alguém é só pelo nome?'],
    },
    {
      prompt: 'A guerra chegou à vila. Escreva a cena pelo que ela muda numa única casa: uma refeição, uma cama vazia, um objeto.',
      ask: ['A guerra aparece pelo que muda na vida de alguém?', 'Qual objeto carrega a cena?'],
    },
  ],
  ficcao: [
    {
      prompt: 'Escolha uma mudança (ninguém mais dorme, lembranças são vendidas) e mostre três consequências em cadeia numa cena de trabalho.',
      ask: ['Cada consequência nasce da anterior?', 'Qual consequência você não tinha previsto?'],
    },
    {
      prompt: 'Uma personagem conserta uma máquina do futuro com pressa. O leitor entende o suficiente só pela ação, sem palestra.',
      ask: ['Tem algum parágrafo que só explica?', 'O leitor sabe o que acontece se o conserto falhar?'],
    },
    {
      prompt: 'Uma manhã chata daqui a cem anos: o café, o trânsito, um anúncio, uma gíria. Nada de aventura.',
      ask: ['Qual detalhe faz o futuro parecer vivido?', 'A gíria inventada se explica pelo uso?'],
    },
    {
      prompt: 'Uma pessoa perde algo por causa da tecnologia que todo mundo ama no seu mundo. Mostre a perda numa cena.',
      ask: ['O que a personagem perde, exatamente?', 'A tecnologia ficou no fundo e a pessoa na frente?'],
    },
  ],
  misterio: [
    {
      prompt: 'Escreva primeiro a revelação (quem, como e por quê) em um parágrafo. Depois, a cena em que aparece a primeira pista, sem parecer pista.',
      ask: ['A pista faz sentido quando se relê depois da revelação?', 'Ela passa despercebida numa primeira leitura?'],
    },
    {
      prompt: 'Uma sala descrita por quem procura algo. Esconda a pista certa no meio de cinco outros detalhes, todos com o mesmo peso.',
      focus: ['frases'],
      ask: ['A pista tem o mesmo tamanho de frase que os outros detalhes?', 'Algo chama atenção demais para ela?'],
    },
    {
      prompt: 'Três suspeitos num interrogatório rápido. Cada um mente sobre uma coisa que não tem nada a ver com o crime.',
      focus: ['dialogo'],
      ask: ['Cada suspeito esconde algo diferente?', 'As mentiras viram pistas falsas justas?'],
    },
    {
      prompt: 'O fim de um capítulo: responda uma pergunta que o leitor tinha e abra outra na última linha.',
      target: 120,
      ask: ['Qual pergunta foi respondida?', 'A última linha faz querer virar a página?'],
    },
  ],
  romance: [
    {
      prompt: 'Os dois estão livres para ficar juntos, mas um deles recua. Mostre o medo ou o orgulho que o faz recuar, sem dizer o nome dele.',
      ask: ['O que impede é algo de dentro, e não um acaso?', 'Dá para entender o recuo, mesmo sem concordar?'],
    },
    {
      prompt: 'Duas pessoas dividem um guarda-chuva por um quarteirão. Nenhuma declaração: só o que quase acontece.',
      forbid: ['amor', 'amava', 'apaixon', 'desej'],
      ask: ['Qual gesto pequeno carrega mais tensão?', 'Algo foi dito que devia ter ficado no ar?'],
    },
    {
      prompt: 'Duas cenas curtas, uma de cada lado do casal. Em cada uma, a pessoa faz algo que não faria no começo da história.',
      ask: ['As duas mudanças têm o mesmo peso?', 'Cada mudança custou alguma coisa?'],
    },
    {
      prompt: 'Um jantar de família em que um dos dois é apresentado. Um parente complica tudo sem querer.',
      focus: ['dialogo'],
      ask: ['O parente quer algo só dele, além de atrapalhar?', 'O conflito obriga o casal a escolher?'],
    },
  ],
  terror: [
    {
      prompt: 'Algo está no quarto, e a personagem nunca vê o que é. Só sons, cheiro, temperatura e uma porta.',
      forbid: ['monstro', 'fantasma', 'criatura', 'demônio', 'demonio'],
      ask: ['Em algum momento você mostrou demais?', 'Qual sentido (som, cheiro, frio) assusta mais?'],
      example: { tell: 'Havia um monstro horrível no corredor.', show: 'No corredor, o assoalho rangeu duas vezes. Depois uma terceira, mais perto.' },
    },
    {
      prompt: 'Uma rotina de manhã que se repete três vezes. A cada vez, um detalhe muda um pouco.',
      ask: ['O primeiro detalhe estranho é quase invisível?', 'A terceira vez assusta mais que a primeira?'],
    },
    {
      prompt: 'Antes do perigo: mostre por que vale a pena gostar de alguém. Um hábito, uma piada, um cuidado.',
      ask: ['O leitor sentiria falta dessa pessoa?', 'O carinho aparece por ação, e não por adjetivo?'],
    },
    {
      prompt: 'Uma personagem sobe a escada de uma casa vazia. Frases longas enquanto está calma; curtas quando algo se mexe.',
      focus: ['frases'],
      ask: ['Dá para ver nas barras das frases onde o perigo chega?', 'Tem um momento de alívio antes do susto?'],
    },
  ],
  realismo: [
    {
      prompt: 'A cozinha da casa de alguém, vista pela primeira vez, com três detalhes que só aquela cozinha teria.',
      ask: ['Algum detalhe é genérico (uma mesa, uma geladeira)?', 'O que os detalhes contam de quem mora ali?'],
      example: { tell: 'Era uma cozinha velha.', show: 'Na geladeira, o calendário de farmácia ainda estava em março de 2019.' },
    },
    {
      prompt: 'Uma conversa sobre quem vai buscar a avó no domingo decide algo muito maior na família. Ninguém diz o que está em jogo.',
      focus: ['dialogo'],
      ask: ['Dá para dizer o que está em jogo de verdade?', 'Alguém disse em voz alta o que devia ficar por baixo?'],
    },
    {
      prompt: 'Um pai que fez algo errado explica, do jeito dele, por que fez. O leitor pode discordar, mas precisa entender.',
      ask: ['A razão dele é compreensível?', 'Ele ficou só vilão ou só vítima?'],
    },
    {
      prompt: 'Uma notícia ruim chega por telefone. Ninguém diz qual é a notícia nem o que sente.',
      forbid: ['triste', 'tristeza', 'arrasad', 'devastad', 'chorou'],
      ask: ['O leitor sabe qual foi a notícia?', 'Alguma frase explica o que a cena já mostrou?'],
    },
  ],
  personagem: [
    {
      prompt: 'A personagem consegue o que queria e percebe que não era disso que precisava. Escreva esse momento.',
      ask: ['Dá para dizer o que ela quer e o que ela precisa?', 'A diferença entre os dois aparece na cena?'],
    },
    {
      prompt: 'Guardar um segredo ou ajudar um amigo: escreva o momento da decisão, com algo a perder dos dois lados.',
      ask: ['As duas opções custam caro?', 'A decisão mostra quem ela é?'],
    },
    {
      prompt: 'Escolha uma contradição (a ladra que nunca mente, o médico com medo de sangue) e escreva a cena em que ela atrapalha.',
      ask: ['A contradição cria um problema na cena?', 'Ficou crível, ou parece truque?'],
    },
    {
      prompt: 'Uma conversa entre três pessoas, sem dizer quem fala. Cada uma precisa ser reconhecível pelo jeito de falar.',
      focus: ['dialogo', 'falas'],
      forbid: ['disse', 'perguntou', 'respondeu'],
      ask: ['Sem os nomes, dá para saber quem disse o quê?', 'Que mania de fala marca cada uma?'],
    },
    {
      prompt: 'O garçom, a vizinha ou o motorista quer algo só dele e atrapalha o protagonista sem querer.',
      ask: ['O secundário tem um desejo próprio?', 'A cena muda alguma coisa para o protagonista?'],
    },
  ],
  estrutura: [
    {
      prompt: 'Uma cena que começa com a personagem confiante e termina com ela em dúvida. Repare na frase em que tudo vira.',
      ask: ['Qual é a frase da virada?', 'O que é diferente no fim da cena?'],
    },
    {
      prompt: 'O momento em que a personagem não pode mais voltar atrás: uma porta que se fecha, uma palavra dita.',
      ask: ['Por que voltar atrás ficou impossível?', 'O leitor sente o caminho ficar mais estreito?'],
    },
    {
      prompt: 'Uma primeira cena com um objeto que parece só cenário. Depois, numa segunda cena curta, ele muda tudo.',
      ask: ['O objeto aparece sem chamar atenção demais?', 'O pagamento parece inevitável quando chega?'],
    },
    {
      prompt: 'O clímax de uma história em que o problema só se resolve por uma decisão difícil da personagem, não por sorte.',
      ask: ['Quem resolve é a personagem?', 'A escolha custa algo que ela amava?'],
    },
    {
      prompt: 'Uma história em quatro parágrafos: apresente, desenvolva, vire (algo inesperado, sem briga) e junte tudo.',
      target: 180,
      ask: ['A virada muda o sentido do que veio antes?', 'O último parágrafo junta as partes?'],
    },
  ],
  dialogo: [
    {
      prompt: 'Um casal arruma a mala para uma viagem. A discussão é sobre o que levar; o problema de verdade é outro.',
      focus: ['dialogo'],
      ask: ['Dá para dizer qual é o problema de verdade?', 'Alguém disse o problema em voz alta?'],
    },
    {
      prompt: 'Uma avó e um neto adolescente combinam um passeio. Cada um com o próprio vocabulário e tamanho de frase.',
      focus: ['dialogo', 'frases'],
      ask: ['Sem as marcações, dá para saber quem fala?', 'Qual palavra é só da avó? E só do neto?'],
    },
    {
      prompt: 'Duas pessoas se reencontram depois de dez anos. Comece na terceira frase da conversa, sem “oi” nem “tudo bem”.',
      forbid: ['oi', 'olá', 'ola', 'tudo bem'],
      focus: ['dialogo'],
      ask: ['A primeira fala já tem tensão?', 'Sobrou algum cumprimento?'],
      example: { tell: '— Oi. — Oi, tudo bem? — Tudo. E você? — Tudo também.', show: '— Você vendeu a casa da mãe.' },
    },
    {
      prompt: 'Uma discussão em que os únicos verbos de fala são “disse” e “perguntou”.',
      forbid: ['exclam', 'redargu', 'retruc', 'berrou', 'vociferou', 'bradou', 'indagou', 'sussurrou', 'murmurou'],
      focus: ['falas'],
      ask: ['Os verbos sumiram da leitura?', 'A emoção ficou nas falas e nos gestos?'],
      example: { tell: '— Saia daqui! — vociferou ele, irado.', show: '— Saia daqui — disse ele, e abriu a porta.' },
    },
    {
      prompt: 'Uma conversa difícil à mesa sem nenhum verbo de fala: só gestos entre as falas mostram quem fala e o que sente.',
      forbid: ['disse', 'perguntou', 'respondeu', 'falou'],
      focus: ['dialogo'],
      ask: ['Cada gesto mostra quem fala?', 'Algum gesto se repetiu (suspirou, sorriu)?'],
    },
  ],
  ritmo: [
    {
      prompt: 'Uma perseguição por um mercado cheio. Frases curtas. Parágrafos curtos. Nada de explicação.',
      focus: ['frases'],
      ask: ['As frases mais curtas estão nos momentos mais rápidos?', 'Algum parágrafo longo freou a corrida?'],
      example: { tell: 'Ele correu o mais rápido que pôde pelas barracas, desviando de todas as pessoas que estavam no caminho.', show: 'Ele correu. Uma barraca. Outra. Um ombro, um grito.' },
    },
    {
      prompt: 'Depois de uma notícia forte, o respiro: a personagem sozinha, reagindo e decidindo o próximo passo.',
      focus: ['frases'],
      ask: ['Ela termina com uma decisão?', 'As frases ficaram mais longas que numa cena de ação?'],
    },
    {
      prompt: 'Alguém precisa achar um documento antes de o dono da casa voltar. Mostre o tempo passando pelo menos três vezes.',
      ask: ['O leitor sabe quanto tempo falta?', 'Cada lembrete do tempo aperta mais?'],
    },
    {
      prompt: 'Só o último parágrafo de três capítulos diferentes. Cada um termina com uma pergunta aberta, sem usar ponto de interrogação.',
      target: 120,
      ask: ['Qual dos três finais você leria para saber o resto?', 'Algum final responde demais?'],
    },
    {
      prompt: 'Mostre ao leitor um perigo que a personagem não vê (uma ponte podre, um copo envenenado). Depois, a cena dela, tranquila.',
      ask: ['O leitor sabe do perigo antes dela?', 'A calma dela aumenta a tensão?'],
    },
  ],
  revisao: [
    {
      prompt: 'Pegue um texto seu de pelo menos uma semana atrás (pode ser um treino antigo do caderno) e reescreva o primeiro parágrafo com olhos de leitor.',
      target: 100,
      focus: ['repeticoes'],
      ask: ['O que você vê agora que não via antes?', 'O que sobrava no parágrafo antigo?'],
    },
    {
      prompt: 'Escreva um parágrafo de diálogo e leia em voz alta. Depois, reescreva cada frase em que você tropeçou.',
      focus: ['frases', 'dialogo'],
      ask: ['Em quais frases você tropeçou?', 'Alguma fala soou falsa em voz alta?'],
    },
    {
      prompt: 'Pegue uma cena sua e faça só a primeira camada da revisão: em poucas linhas, o que ela muda na história e o que pode sair.',
      target: 60,
      ask: ['A cena muda alguma coisa?', 'O que dá para cortar sem perder nada?'],
    },
    {
      prompt: 'Uma chegada em 150 palavras. Depois, reescreva o mesmo parágrafo com 135, sem perder nada importante.',
      target: 280,
      focus: ['mente', 'repeticoes'],
      ask: ['O que você cortou primeiro?', 'Algum advérbio em -mente fazia falta?'],
    },
    {
      prompt: 'Três leitores: um apressado, um desconfiado e um fã. Escreva o que cada um diria do seu último treino.',
      target: 100,
      ask: ['Onde os três tropeçam no mesmo lugar?', 'Qual comentário você vai usar?'],
    },
  ],
  mestrar: [
    {
      prompt: 'A lista da sessão zero da sua mesa: o tom, o que fica fora, a frequência e uma pergunta para cada jogador.',
      ask: ['Tem algo que alguém não gostaria de ver na mesa?', 'Cada jogador tem uma pergunta só dele?'],
    },
    {
      prompt: 'Uma situação para a próxima sessão: quem quer o quê, o que acontece se ninguém fizer nada e onde estão três pistas.',
      mesa: 'cena',
      ask: ['A situação anda sozinha se o grupo não fizer nada?', 'Há mais de um jeito de resolver?'],
    },
    {
      prompt: 'O início forte da próxima sessão: algo já está acontecendo, e os jogadores precisam decidir nos primeiros minutos.',
      target: 40,
      mesa: 'inicio',
      ask: ['Os jogadores têm uma decisão logo de cara?', 'Dá para ler em voz alta em menos de um minuto?'],
    },
    {
      prompt: 'Cinco ideias malucas que um jogador poderia ter na próxima cena, com uma resposta “sim, mas…” para cada uma.',
      ask: ['Cada resposta abre uma consequência interessante?', 'Algum “não” poderia virar “sim, mas”?'],
    },
    {
      prompt: 'Um gancho para cada personagem do grupo, ligado ao que ele quer, para a próxima sessão.',
      mesa: 'cena',
      ask: ['Quem teve menos holofote na última sessão?', 'Cada gancho pede uma escolha?'],
    },
  ],
  aventuras: [
    {
      prompt: 'Uma conclusão que o grupo precisa tirar e três pistas diferentes que levam a ela, em lugares diferentes.',
      mesa: 'cena',
      ask: ['Se o grupo perder duas pistas, a terceira basta?', 'As pistas estão em lugares, pessoas e objetos diferentes?'],
    },
    {
      prompt: 'O plano do vilão em quatro etapas, e o que acontece no mundo em cada uma se o grupo não fizer nada.',
      ask: ['O grupo consegue ver o relógio andar?', 'Cada etapa piora as coisas de um jeito diferente?'],
    },
    {
      prompt: 'Três NPCs, cada um com um desejo, um jeito de falar e um segredo, e uma fala de cada.',
      focus: ['dialogo'],
      ask: ['Dá para improvisar com eles sem anotar mais nada?', 'Os jeitos de falar são bem diferentes?'],
    },
    {
      prompt: 'Uma ruína em três camadas: o que se vê, o que se descobre olhando melhor e o que aconteceu ali.',
      mesa: 'cena',
      ask: ['Cada camada pede uma ação do grupo?', 'O passado do lugar muda algo no presente?'],
    },
    {
      prompt: 'Cinco recompensas para a próxima aventura que não sejam ouro: um aliado, um segredo, um título, uma dívida, um inimigo.',
      ask: ['Qual recompensa vai gerar uma história nova?', 'Alguma muda a relação do grupo com o mundo?'],
    },
  ],
}
