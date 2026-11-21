# Auditoria 17 — Nova cara, climas e modo escuro

Playwright a 390×844 no Ostria. Em vez de só olhar fotos, medi o **contraste de cada texto visível** por código (cor do texto sobre o fundo real, com transparências; mínimo 4,5:1 para texto normal e 3:1 para texto grande) em 10 telas e 7 combinações. Fotos de Início e Fichas por combinação (só para mim). 20/11/2026.

Combinações: **A** sem Nova cara, claro · **B** sem Nova cara, escuro · **C** Nova cara Fantasia escuro · **D** Fantasia claro · **E** Ficção científica escuro · **F** Terror escuro · **G** Caderno claro.
Telas: Início, Escrever, Fichas, Ligações, Tempo, Mapas, Trama, Mesa, Publicar, Ajustes.

## Resultado

| Combinação | Textos abaixo do mínimo |
|---|---|
| A, B, C, D, E, G | **0** em todas as telas medidas |
| F (Terror escuro) | **22** (antes do conserto): botões cheios 4,14:1; links e abas em vermelho 3,95:1; títulos de coluna 3,35:1 e nomes 3,62:1 |

## Funciona bem

- **Seis das sete combinações não têm nenhum texto abaixo do mínimo**, nas telas medidas. O modo escuro do aparelho (sem Nova cara) também.
- A Nova cara **muda mesmo** o app inteiro (fundo, painéis, botões, abas e mapa): o Terror fica cinza-vinho com vermelho, o mapa mantém o papel claro.
- O modo escuro do aparelho funciona sem Nova cara e sem quebrar nada.
- Só **6 cores `#rrggbb` em arquivos `.tsx`** (4 em `WikiCard.tsx`, a cor de uma peça do mapa e o confete). O resto das cores vive nos `.css`.

## Defeitos

1. *(média, acessibilidade)* **Terror escuro com contraste baixo**: o vermelho `#d4434a` usado como texto/link ficava com 3,95:1 sobre o fundo e, como fundo do botão cheio com texto claro, 4,14:1. Afetava "Continuar escrevendo", "Ler como livro", "Criar o livro", links como "17 fichas", "Mapas", "Sprint". **Consertado neste PR**: o vermelho do texto ficou mais claro (`#e5575e`) e o botão cheio usa um vermelho mais fundo (`#b3323a`). Teste: `src/styles/climas.test.ts` (calcula os contrastes a partir do `climas.css`; falhava antes, passa agora).
2. *(baixa)* **Sobrou 1 caso no Terror escuro**: o título da coluna "Resolvida" na Trama (4,17:1). Vem da cor do estado, não do vermelho; não mexi.
3. *(baixa)* **A parte "Tempo" não abriu pelo roteiro de medição com a Nova cara ligada** — não é defeito: com a Nova cara, a Linha do tempo **sai do Mundo e vai para "História"** (ver abaixo), então ela ficou sem medir.

## Confuso ou difícil

- **A Nova cara muda onde as coisas moram.** Barra de baixo: Escrever, Mundo, História, Mesa, Menu (no lugar de Início, Escrever, Mundo, Trama, Mais). No Mundo, só Fichas, Ligações, Mapas; a **Linha do tempo** vai para "História" (junto de Pistas e mistérios e Quem sabe o quê). O passeio e o Guia falam de "Mundo: Fichas, Ligações, Linha do tempo e Mapas" e de "Trama", então ficam errados com a Nova cara ligada. Vale ter textos diferentes ou manter o mesmo lugar.
- **O clima é por universo** (Ajustes › Universo), mas "Nova cara" é por aparelho: dois universos com climas diferentes mudam o app todo quando se troca. Está dito ("o clima de cada mundo vale no app inteiro"), só vale reforçar.
- **Cor de cada tipo e de cada estado** (tokens `--kind-*`) é o que mais varia entre climas; o título "Resolvida" é um exemplo.

## Pode mudar

- Um teste automático de contraste (como o que usei aqui) rodando no CI para cada clima.
- Decidir se a Linha do tempo fica em História ou em Mundo, nos dois visuais.

## Consertado neste PR

- **Terror escuro: contraste do vermelho e do botão** (defeito 1): `src/styles/climas.css` + teste `src/styles/climas.test.ts`.

## Não testado

- **Claro × Terror** (`data-clima-modo='claro'`) e Ficção científica claro; só os escuros e Fantasia claro e Caderno claro foram medidos.
- Contraste de **ícones, bordas e do texto dentro de imagens e do mapa** (só texto HTML).
- A **leitura**, Mesa ao vivo, Publicar com livro criado, ficha aberta e janelas: só as telas principais.
- **Fundo errado, peça que só funciona num dos modos**: só olhei Início e Fichas em foto; o resto foi pela medição.
- Cores fora de `tokens.css`: contei quantas há (100 em `climas.css`, 171 em `mesa.css`), mas não avaliei se cada uma devia virar token.
