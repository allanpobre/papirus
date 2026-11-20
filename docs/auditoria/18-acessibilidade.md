# Auditoria 18 — Acessibilidade

`e2e/a11y.spec.ts` (axe, WCAG 2 A/AA e 2.1 A/AA) rodado de novo: **5 testes passaram**. Depois ampliei o olhar para as telas novas, no celular (390×844 com toque): Fichas, janela "Rolar no mundo", Linha do tempo › Faixas, Mapas (ligando uma rota) e ficha de religião (Panteão e Poder). Para cada uma: axe, contagem de alvos de toque abaixo de 44 px e botões sem nome. 20/11/2026.

## Funciona bem

- **axe sem nenhuma violação** nas 6 telas novas, depois de esperar as animações de entrada. (Medindo no meio da animação o axe acusa "contraste" em 2 a 10 textos, que some em 1 segundo: é medição, não defeito. Por isso o teste novo espera 1,2 s.)
- **Botões sem nome acessível: 0** em todas as telas medidas. Os ícones têm `aria-label` ("Rolar no mundo", "Buscar em tudo", "Como usar: Mapas", "Mais ações da cena", "Fechar o teclado").
- **Esc fecha a janela "Rolar no mundo"** e **o foco volta ao botão que a abriu**. O mesmo para as janelas do Menu, da Revisão e de "O que mudou" (vistas no 02 e 03).
- **Pular para o conteúdo** é o primeiro item da página.
- A janela "Rolar no mundo" é uma `radiogroup` ("Tabela") com os botões de tabela como `radio`: o leitor de tela entende "uma entre seis".
- Nomes dos botões fazem sentido sozinhos: "Rolar: Boato", "Virar pista", "Virar ideia", "Marcar lugar", "Ligando…", "Apagar rota".

## Defeitos

Nenhum de gravidade alta.

- *(média, toque)* **Muitos alvos de toque abaixo de 44 px** (o que a lista do pedido pedia). Nas telas novas, os mais comuns:
  - **"Rolar no mundo" e "Wiki"**, no alto do Mundo: **28×28 px**. São as portas das oficinas.
  - "Buscar em tudo" e "Como usar" (?): 28×32.
  - As abas do Mundo (Fichas, Ligações, Linha do tempo, Mapas): 30 px de altura.
  - "Marcar lugar", "Rota", "Ligando…" no mapa: 29 px de altura; "Reino de Ostria"/"Adicionar mapa"/"Gerar": 33 a 35 px.
  - "Criar evento" 45×34, "Filtros" 81×29, "Selecionar" 88×29; campos de texto e listas com 35 px de altura.
  - Os chips de tabela do "Rolar no mundo": 34 px de altura.
  - Na ficha: "Voltar para a lista" 32×32, "Ver a página" 29 px, vários campos de 27 a 35 px.
  Isso é padrão do app inteiro, não só das oficinas (a primeira linha da tela, "Ler como livro", mede 29 px). O mínimo de 44 px é uma recomendação (WCAG 2.5.5, nível AAA); o nível AA pede 24 px, que o app cumpre. Por isso classifico como média, não alta. Arquivos: `src/styles/base.css` (`.btn`, `.btn-icon`, `.tab`, `.chip`) e `src/styles/views.css`.

## Confuso ou difícil

- **Esc só existe no teclado do computador**: no celular, fechar a janela depende do "X" (32×32 px) no canto; o toque fora da janela fecha? (não testei).
- **O leitor de tela dentro do mapa**: os marcadores são botões ("Ostria, Lugar"), mas as **rotas** (linhas e os dias) não têm texto alternativo; quem usa leitor não sabe que existe a rota entre dois lugares nem quantos dias leva. A lista "Rotas" (Mais) ajuda, mas não vi se é lida.
- **Ordem do Tab nas Faixas**: não testei; as faixas são muitas linhas de eventos pequenos que se arrastam, e arrastar não tem equivalente de teclado visível (só o campo de ano do evento aberto).

## Pode mudar

- Subir o tamanho do toque nos ícones do alto (Buscar, Ajuda, Rolar no mundo, Wiki) e nas abas do Mundo para 44 px, aumentando a área clicável sem aumentar o ícone (`min-height`/`padding` invisível).
- Dar às rotas um texto para leitor de tela ("Estrada de Ostria a Paço do Regente, 0,6 dia").
- Uma forma de mover um evento nas Faixas pelo teclado (setas, ou botões −1/+1 ano no evento aberto).

## Consertado neste PR

Nada no app. O teste novo `e2e/a11y-oficinas.spec.ts` cobre axe, Esc e o foco que volta nas telas novas.

## Não testado

- Ordem do Tab, foco visível e "armadilha de foco" nas janelas (só Esc e o foco que volta).
- Leitor de tela de verdade (NVDA, VoiceOver, TalkBack).
- Telas de Escrever, Mesa e Publicar (já cobertas por `a11y.spec.ts`, mas sem a medição de alvos).
- Contraste dos climas da Nova cara (feito no 17).
- Zoom do texto a 200% e `prefers-reduced-motion`.
