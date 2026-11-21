# Auditoria 05 — Mundo: Fichas

Playwright com toque a 390×844, no Ostria, no Oz (74 fichas) e em universo vazio. Só com a Nova cara desligada nesta rodada. 20/11/2026.

## Funciona bem

- **Mundo vazio**: "Mais partes aparecem conforme você usa: Ligações, quando houver duas fichas; Linha do tempo, quando houver uma data; Mapas, quando houver um lugar." Convida sem assustar.
- **Nova ficha**: Nome + Tipo (12 tipos), e a ficha já abre com "Para começar": 4 perguntas curtas do tipo ("O que quer, mais que tudo?"…) cujas respostas viram campos, com "Pular".
- **Lista (Oz, 74 fichas)**: filtros por tipo, ordem (A–Z, Cenas, Recentes, Papel), Lista/Tabela e **Selecionar**. A seleção em lote mostra uma barra fixa ("2 marcadas": Pôr numa lista…, Etiqueta, Tipo, Livro, Apagar, fechar) e cabe em 390 px.
- **Ficha de leitura (Kael)**: tipo, nome grande, resumo, mapa com o caminho do personagem pelas cenas, nascimento, ligações em frase ("Kael desconfia de Vaelor · em 5 cenas"), "Até onde na história" (ver só até uma cena) e "Ver como o leitor". Muito rica.
- **Nome muito longo (140 caracteres)**: na leitura quebra em várias linhas, sem estourar a tela; a lista também não estoura.
- **Descrição enorme (~20 mil caracteres)**: digitar continua responsivo (≈56 ms por tecla na pior hora) e a página não estoura.
- Sem rolagem lateral em nenhuma das telas.

## Defeitos

Nenhum de gravidade alta ou média encontrado.

- *(baixa)* **Em "Editar", o nome longo é um campo de uma linha cortado no meio da palavra** ("Sua Majestade Imperia…"). Dá para rolar dentro do campo, mas não dá para ler o nome inteiro de uma vez. Devia quebrar em linhas (como na leitura). Arquivo provável: `src/views/` (cabeça da ficha em edição).

## Confuso ou difícil

- **A etiqueta "Quase" / "Rascunho" ao lado do nome** não diz o que é (é o estado de preenchimento da ficha). Quem lê "Quase" pensa "quase o quê?".
- **Duas barras ao mesmo tempo no topo da ficha de leitura**: o seletor "A história toda / Até 3. Nas brumas" e o "Ver como o leitor" ocupam o primeiro terço da tela antes do nome.
- **O ícone de lápis** (editar o básico, o quadro, o texto, as ligações…) aparece em vários blocos, cada um com uma função diferente; sem rótulo, não se sabe qual abre o quê.
- **"E se sumir?" e "Arrumar a página"** são ótimos, mas ficam como ícones: dá para passar sem ver.
- **Em seleção, "Apagar" fica ao lado de "Livro"** e de "Tipo" na mesma barra; não vi se pede confirmação.
- **Simples ou Completo** vive em Ajustes › Universo, longe da ficha; quem se sente sobrecarregado na ficha não sabe que existe.

## Pode mudar

- Trocar "Quase/Rascunho" por algo como "Ficha 60% preenchida" ou tirar do cabeçalho.
- Deixar o nome em edição quebrar em várias linhas (textarea que cresce).
- Mostrar o seletor "Até onde na história" só quando se toca em "Ver a história de outra época" (menos barulho no alto).
- Um atalho "Mostrar menos / Mostrar mais" dentro da própria ficha.

## Consertado neste PR

Nada.

## Não testado

- Nova cara ligada (fica para o 17) e as fichas em tema escuro.
- Criar uma ficha de cada tipo e preencher "Quem é" (Espécie, Corpo…) e "No jogo".
- Alternar Simples/Completo (e conferir que nada some de vez).
- O criador de personagem, a tela de personagem (herói, abas), o modelo de ficha e o efeito dominó por uso completo.
- "Livro" em lote com resultado e a confirmação do "Apagar" em lote.
- Busca e filtros combinados.
