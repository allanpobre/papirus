# Auditoria 04 — Trama

Playwright com toque a 390×844, no Ostria (`?exemplo=ostria`) e num universo vazio. 20/11/2026.

## O que a Trama é hoje

Duas partes: **Pistas e mistérios** e **Quem sabe o quê** (Fatos, Por personagem, O que o leitor sabe, Versões que divergem). Os modelos de estrutura (Três atos, Save the Cat, Jornada do herói) e as "fases" **não estão na Trama**: moram em Escrever › Estrutura (ver 03). O pedido original juntava tudo; para quem procura "estrutura" na Trama, não acha.

## Funciona bem

- **Universo vazio**: tela calma, com "Nenhuma trama ainda" e exemplos concretos ("uma arma na parede, uma frase que vai voltar…"); e "Mais partes aparecem conforme você usa: Quem sabe o quê, quando houver um fato. Mostrar todas". Revelação gradual bem feita.
- **Criar**: campo de uma linha + tipo (Semente ou Mistério) + botão "+". Duas tramas criadas em 4 toques.
- **Quadro por estado** (Aberta, Parcial, Resolvida, Abandonada) com contagem; filtros Todas, Sementes, Mistérios; "Mover para…" abre as opções ali mesmo.
- **Ficha da trama** (janela): Título, Tipo, Estado, "Preparada em" e "Paga em" (cenas), Descrição, "Envolve", e Pistas com "+ Pista". Cabe em 390 px, com Apagar e Pronto fixos embaixo.
- **Ostria**: cartões mostram quem está envolvido ("Mira, Ilsa", "Vaelor", "5 pistas"), o que dá uma boa vitrine.
- **Quem sabe o quê** explica em uma frase por que a verdade do autor, o que cada personagem acredita e o que o leitor viu ficam separados.
- Sem rolagem lateral na página.

## Defeitos

Nenhum encontrado nesta rodada.

## Confuso ou difícil

- **O quadro é largo**: a coluna "Parcial" fica cortada à direita e o chip "Abandonada" também. Dá para arrastar para os lados, mas nada indica isso (sem seta nem sombra).
- **O botão "+" se chama "Criar" só para leitor de tela**; vendo, é um "+" verde solto ao lado de "Semente". Novato pode não entender o que ele cria.
- **"Semente" e "Mistério"** são os nomes certos para quem escreve, mas "Semente" sozinha não diz que é "algo que vai voltar". O texto de ajuda só aparece no universo vazio.
- **Estrutura fora da Trama** (acima).
- **"Quem sabe o quê"** tem 4 abas num lugar apertado e começa por "Fatos", mas um fato novo só nasce no texto ou na ficha; a aba vazia não diz como começar.

## Pode mudar

- Sombra/seta na borda direita do quadro; ou, no celular, mostrar uma coluna por vez com as abas dos estados.
- Trocar o "+" por "Adicionar" com texto.
- Em Trama, um atalho "Ver a estrutura da história" que leve ao Escrever › Estrutura.
- Quando houver "Rolar no mundo" criando pistas, marcar o cartão ("veio da mesa de sorteio") — hoje não dá para ver de onde veio.

## Consertado neste PR

Nada.

## Não testado

- Pistas criadas pelo "Rolar no mundo" (ver 09).
- Mover entre estados e abrir um mistério com pistas reais no Ostria (só li os cartões).
- "Por personagem" e "Versões que divergem" com dados.
- Arrastar cartões (se existir).
