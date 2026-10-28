/**
 * Gerador de ideias da Oficina: junta peças sorteadas numa premissa para escrever
 * ou num gancho de aventura para a mesa.
 */
export type IdeaMode = 'escrita' | 'mesa'

export interface Idea {
  mode: IdeaMode
  /** As partes, na ordem, com o rótulo de cada uma. */
  parts: { label: string; text: string }[]
  /** Uma frase só, para virar a sinopse de uma cena. */
  sentence: string
}

const WRITE = {
  quem: [
    'Uma cartógrafa que perdeu a visão',
    'Um padeiro que nunca saiu da cidade',
    'Uma juíza aposentada',
    'Um ladrão que só rouba livros',
    'Uma menina que conversa com um rádio desligado',
    'Um soldado que desertou na véspera da vitória',
    'Uma tradutora de cartas de amor',
    'Um gêmeo que assumiu o lugar do irmão',
    'Uma pescadora que encontrou algo na rede',
    'Um professor que esqueceu o próprio nome',
    'Uma herdeira que não quer a herança',
    'Um coveiro muito supersticioso',
  ],
  quer: [
    'provar que alguém dado como morto está vivo',
    'devolver um objeto ao verdadeiro dono',
    'esconder um erro antigo',
    'chegar a outra cidade antes do inverno',
    'ser perdoado por quem traiu',
    'descobrir quem escreve as cartas anônimas',
    'vencer um concurso que a família despreza',
    'salvar o prédio onde cresceu',
    'apagar uma lembrança',
    'reencontrar o primeiro amor',
    'pagar uma dívida com um favor',
    'contar a verdade sem perder tudo',
  ],
  mas: [
    'a única testemunha é quem mais ganha com o silêncio',
    'só tem três dias',
    'precisa da ajuda do pior inimigo',
    'cada passo apaga uma lembrança',
    'ninguém acredita numa palavra do que diz',
    'a verdade vai ferir quem mais ama',
    'alguém está seguindo cada movimento',
    'para conseguir, terá de mentir para todos',
    'o que procura não deveria existir',
    'a cidade inteira quer o contrário',
    'uma promessa antiga impede',
    'descobre que fez parte do problema',
  ],
  onde: [
    'num farol desativado',
    'num trem noturno que não para',
    'numa festa de casamento',
    'num hospital durante uma tempestade',
    'numa vila que sumiu do mapa',
    'numa biblioteca fechada há anos',
    'num navio parado no meio do mar',
    'numa feira de rua',
    'numa escola abandonada',
    'num velório',
    'no último andar de um prédio em obras',
    'numa estação espacial em silêncio',
  ],
}

const TABLE = {
  quem: [
    'Uma viúva rica',
    'O capitão da guarda',
    'Um sacerdote em fuga',
    'Uma criança com um mapa',
    'O dono da taverna',
    'Uma nobre disfarçada',
    'Um mercador endividado',
    'Um fantasma educado',
    'Uma guilda de ladrões',
    'Um dragão velho e cansado',
  ],
  pede: [
    'recuperar um anel roubado',
    'escoltar uma carroça até a fronteira',
    'descobrir por que os poços secaram',
    'entregar uma carta sem abri-la',
    'resgatar um aprendiz sequestrado',
    'investigar as luzes na torre abandonada',
    'caçar a fera que ataca os rebanhos',
    'proteger um casamento',
    'achar um livro proibido',
    'convencer um rival a desistir',
  ],
  mas: [
    'quem contrata mente sobre o motivo',
    'o alvo é inocente',
    'outro grupo foi contratado para o mesmo serviço',
    'o pagamento é em moedas amaldiçoadas',
    'a missão é uma distração para algo maior',
    'alguém do grupo é reconhecido no caminho',
    'o vilão quer ser encontrado',
    'há um prazo: a próxima lua cheia',
    'a vítima não quer ser salva',
    'a recompensa já foi prometida a outra pessoa',
  ],
  onde: [
    'nas ruínas de um templo afundado',
    'numa cidade em festa',
    'numa floresta onde ninguém dorme',
    'nas minas abandonadas',
    'num navio fantasma',
    'na fronteira em guerra',
    'num mosteiro em silêncio',
    'num mercado subterrâneo',
    'numa ilha que só aparece com neblina',
    'na torre de um mago desaparecido',
  ],
}

const pick = <T,>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length) % list.length]
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function rollIdea(mode: IdeaMode, rand: () => number = Math.random): Idea {
  if (mode === 'mesa') {
    const [quem, pede, mas, onde] = [pick(TABLE.quem, rand), pick(TABLE.pede, rand), pick(TABLE.mas, rand), pick(TABLE.onde, rand)]
    return {
      mode,
      parts: [
        { label: 'Quem pede', text: quem },
        { label: 'O quê', text: capital(pede) },
        { label: 'A complicação', text: capital(mas) },
        { label: 'Onde', text: capital(onde) },
      ],
      sentence: `${quem} pede ao grupo para ${pede}, ${onde}. Mas ${mas}.`,
    }
  }
  const [quem, quer, mas, onde] = [pick(WRITE.quem, rand), pick(WRITE.quer, rand), pick(WRITE.mas, rand), pick(WRITE.onde, rand)]
  return {
    mode,
    parts: [
      { label: 'Quem', text: quem },
      { label: 'Quer', text: capital(quer) },
      { label: 'Mas', text: capital(mas) },
      { label: 'Onde', text: capital(onde) },
    ],
    sentence: `${quem} quer ${quer}, mas ${mas}. ${capital(onde)}.`,
  }
}
