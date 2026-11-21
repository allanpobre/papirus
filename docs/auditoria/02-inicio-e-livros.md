# Auditoria 02 — Início, universos e livros

Playwright com toque a 390×844, no Oz (`?exemplo`, 3 livros + "A Rainha Zixi de Ix") e em universos novos. 20/11/2026.

## Funciona bem

- **Menu (Mais)**: dos 18 itens, os que abrem tela (Publicar, Mundo, Trama, Mesa, Ideias, Perguntar ao mundo, Guia, Ajustes e dados, Todas as ferramentas) abrem o que dizem; Buscar, Compartilhar, Novidades e Entrar abrem janela, e **Esc fecha todas**. Sem rolagem lateral em nenhuma.
- **"O que mudou"** abre pelo Menu › Novidades, com as novidades mais recentes em cima, em linguagem simples.
- **Livro no alto (Oz)**: ao escolher "A Maravilhosa Terra de Oz" o Início mostra "Neste livro: 3.123 palavras" e a lista de fichas do Mundo cai de 74 para 13; "Todos os livros" volta a 74.
- **Exemplo**: o cartão traz "Recomeçar o exemplo" (com confirmação) e "Tirar o exemplo".
- **Apagar** pede confirmação e fala das versões guardadas (no código: "e as N versões guardadas").

## Defeitos

Nenhum de gravidade alta encontrada.

- *(baixa)* **Em Publicar, a barra de baixo troca "Mais" por "Publicar"** (Início, Escrever, Mundo, Trama, Publicar). Dali, para chegar ao Menu é preciso voltar a outra aba. Não é erro, mas surpreende. Arquivo provável: `src/shell/nav.ts`.
- *(baixa)* **"Escolher atalhos" não abre janela**: o Menu continua aberto e vira modo de marcar ("Toque para pôr ou tirar da barra de baixo"). Funciona, mas quem toca e vê quase a mesma tela acha que nada aconteceu.

## Confuso ou difícil

- **Não dá para renomear nem duplicar um universo pela lista.** O menu do cartão tem só Abrir, Baixar backup e Apagar. Renomear fica em Ajustes › Universo (campo "Nome"); duplicar não existe (só via backup).
- **Apagar não tem "Desfazer"** (o pedido previa). É "Apagar de vez" com confirmação. A rede de segurança é a confirmação e as versões em Ajustes › Lixeira e histórico; falta conferir se a lixeira pega universo inteiro (ver 14).
- **Livros em três lugares**: "Livro" no Início, no alto da lista de cenas e no Menu de cada tela. Quem deixa "Todos os livros" no Escrever vê cenas misturadas sem aviso.
- **O Menu tem 18 itens**; "Todas as ferramentas" e "Guia" fazem coisas parecidas e ficam perto.
- **Datas do "O que mudou"** são todas "20 de novembro", então não mostram o que é mais novo.

## Pode mudar

- "Duplicar universo" no menu do cartão (útil para testar um AU ou rascunho).
- "Renomear" no próprio cartão.
- Juntar "Guia" e "Todas as ferramentas".
- Etiqueta "Só este livro" visível em Escrever/Mundo/Trama quando um livro está escolhido.

## Consertado neste PR

Nada (só anotações).

## Não testado

- Criar, renomear e apagar universo de ponta a ponta (o apagar foi lido no código, não executado).
- Capas e faixa do livro com a Nova cara ligada (fica para o 17).
- Se o livro escolhido é lembrado depois de recarregar (teste inconclusivo).
- Trocar de universo com 2 ou mais universos reais.
