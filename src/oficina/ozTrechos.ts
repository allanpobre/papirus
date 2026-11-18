/*
 * Os trechos de "O Maravilhoso Mágico de Oz" que a Oficina usa nos exercícios de imitação.
 * São cópias, palavra por palavra, de parágrafos de `src/model/ozTexto.ts` (o teste confere que
 * continuam iguais), guardadas à parte para a Oficina não carregar o livro inteiro (mais de 200 kB).
 * `capitulo` e `de` dizem de onde cada um veio: o número do capítulo e o do primeiro parágrafo (a partir de 0).
 */
export interface OzTrecho {
  capitulo: number
  titulo: string
  de: number
  paragrafos: string[]
}

export const OZ_TRECHOS: Record<'fantasia' | 'realismo' | 'dialogo' | 'ritmo', OzTrecho> = {
  fantasia: {
    capitulo: 10,
    titulo: "A maravilhosa Cidade de Oz",
    de: 0,
    paragrafos: [
      "Mesmo com os olhos protegidos pelos óculos verdes, Dorothy e os amigos ficaram no começo ofuscados com o esplendor da maravilhosa Cidade. As ruas eram ladeadas de casas lindas, todas construídas de mármore verde e cravejadas por toda parte de esmeraldas cintilantes. Eles andavam sobre um calçamento do mesmo mármore verde, e onde os blocos se juntavam havia fileiras de esmeraldas, bem juntinhas, brilhando à luz do sol. As vidraças das janelas eram de vidro verde; até o céu acima da Cidade tinha um tom verde, e os raios do sol eram verdes.",
    ],
  },
  realismo: {
    capitulo: 0,
    titulo: "O ciclone",
    de: 1,
    paragrafos: [
      "Quando Dorothy parava à porta e olhava em volta, não via nada além da grande pradaria cinzenta, de todos os lados. Nem uma árvore nem uma casa interrompia a vasta extensão de terra plana que ia até a beira do céu, em todas as direções. O sol tinha cozido a terra arada numa massa cinzenta, cortada de rachaduras finas. Nem a grama era verde, porque o sol tinha queimado a ponta das folhas compridas até deixá-las da mesma cor cinzenta que se via por toda parte. A casa já tinha sido pintada um dia, mas o sol empolou a tinta e as chuvas a lavaram, e agora a casa era tão apagada e cinzenta quanto todo o resto.",
    ],
  },
  dialogo: {
    capitulo: 10,
    titulo: "A maravilhosa Cidade de Oz",
    de: 30,
    paragrafos: [
      "— Eu sou Dorothy, a Pequena e Humilde. Vim lhe pedir ajuda.",
      "Os olhos a fitaram pensativos por um minuto inteiro. Depois a voz disse:",
      "— Onde você conseguiu os sapatos de prata?",
      "— Ganhei da Bruxa Má do Leste, quando a minha casa caiu em cima dela e a matou — respondeu ela.",
      "— Onde você conseguiu a marca na testa? — continuou a voz.",
      "— Foi onde a Bruxa Boa do Norte me beijou quando se despediu de mim e me mandou até o senhor — disse a menina.",
    ],
  },
  ritmo: {
    capitulo: 0,
    titulo: "O ciclone",
    de: 11,
    paragrafos: [
      "Totó pulou dos braços de Dorothy e se escondeu debaixo da cama, e a menina foi buscá-lo. A Tia Em, muito assustada, abriu o alçapão no chão e desceu a escada até o buraco pequeno e escuro. Dorothy finalmente pegou Totó e foi atrás da tia. Quando estava no meio do cômodo, o vento deu um grande uivo, e a casa tremeu tanto que ela perdeu o equilíbrio e caiu sentada no chão.",
      "Então aconteceu uma coisa estranha.",
      "A casa girou duas ou três vezes e subiu devagar pelo ar. Dorothy sentiu como se estivesse subindo num balão.",
    ],
  },
}
