# Auditoria 25 — As telas que a 24 não cobriu, e conferências do que ficou só no código

Feita em 26/11/2026, sobre o ramo com os PRs 288 a 291 já aplicados (Telas apertadas, Movimento de base, Movimento com sentido, Barra e áreas). Continua a auditoria 24: ali ficou dito o que **não** foi visto; aqui eu fui ver.

**Limites:** um avaliador só, celular simulado a 390×844 e computador a 1280×800, sempre com o exemplo Terra de Oz (e um universo vazio para o filete de cor), numa cópia **sem servidor configurado**. Sem pessoas de verdade, sem aparelho de verdade, sem leitor de tela. Contraste e tamanho de letra a olho. Não vi: a Comunidade **com servidor** (só a tela de cópia sem servidor), o Treino depois de começar, o modo Jogo de uma ficha de espécie, o leitor com link de leitura e a Diagramação além da primeira tela.

## O que foi visto (35 telas)

| Área | Computador | Celular | Tema escuro |
|---|---|---|---|
| Escrever › Estrutura | ✔ | ✔ | — |
| Escrever › Revisão | ✔ | ✔ | ✔ (Página) |
| Mesa › Grupo · Codex · Regras | ✔ | ✔ | ✔ (Preparar) |
| Publicar › Diagramar | ✔ | ✔ | — |
| Ajustes e dados | ✔ | ✔ | — |
| Guia | ✔ | ✔ | — |
| Leitor (“Ler como livro”) | ✔ | ✔ | — |
| Oficina | — | ✔ | — |
| Comunidade (**sem servidor configurado**, como a minha cópia local) | — | ✔ | — |
| Treino de escrita | — | ✔ | — |
| Início, Mundo, Mapas, Trama, Publicar | (da 24) | ✔ | ✔ |

## Resumo

O app **se sustenta bem nessas telas**: a Oficina, o Treino, o Guia, o leitor e a Mesa têm cara própria, e o **tema escuro é coerente** (Início, Escrever, Mundo, Mapas, Trama, Mesa e Publicar sem nada quebrado à vista). Os defeitos são poucos e pequenos, mas **um se repete a cada gravação**: o aviso “Salvo” do celular cobre os botões do alto. (Eu tinha achado um segundo defeito grande, na Comunidade, e **retirei**: era só porque a minha cópia local não tem servidor; veja o B.)

Gravidade: **3** grande (corrigir logo) · **2** pequeno · **1** cosmético.

| # | Onde | O que | Grav. |
|---|---|---|---|
| A | Celular, todas as telas | O “Salvo” aparece **por cima das abas** de Escrever, de Mapas/Mundo e do título de Ajustes | **3** |
| B | Comunidade numa cópia **sem servidor** (celular) | Tela vazia com uma frase técnica: “Perfis e amigos precisam de um servidor. Configure em Ajustes → Servidor.” **Não vale para o site publicado**, que já vem com servidor (a 23 já dizia); só aparece em cópia sem servidor, como a de teste | 1 |
| C | Mesa › Regras (computador e celular) | O **nome do sistema** (“Estilo D&D 5e (d20)”) fica cortado: no celular passa da borda da tela | 2 |
| D | Mesa › Codex (celular) | Em cada revelação, o **“×” de tirar cai sozinho numa linha** embaixo, parecendo erro | 2 |
| E | Mundo › Fichas | **Os filtros da lista ficam cortados**: “Toda”, “Todo”, “A–Z” no computador; “Todos os pa…” no celular. Não dá para ler o que filtra | 2 |
| F | Publicar › Diagramar | A **prévia fica um quadro cinza vazio por uns 7 segundos** (só há “Cancelar” e, no alto, “preparando o livro…” pequeno); no celular o título quebra em três linhas | 2 |
| G | Mundo › Ligações (celular) | O grafo abre com **40 de 64 nomes fora da tela** (é um grafo grande numa tela pequena; falta uma pista de que se arrasta e se aproxima) | 1–2 |
| H | Leitor (celular) | Os três ícones do alto (ouvir, como ler, caderno) ficam **sem nome à vista** (no computador têm) | 1 |
| I | Ajustes › Universo (computador) | Uma página longa de texto (clima, nível do Mundo, modo): lê-se bem, mas é a mais “parede” das telas de Ajustes | 1 |

### Detalhes
- **A.** O selo é fixo no alto e dura ~1,6 s a cada gravação; ao escrever, aparece a cada pausa. Cobre exatamente as abas Estrutura · Página · Revisão. *Melhoria:* descer o selo para baixo, acima da barra de baixo e do rodapé de palavras, onde só cobre texto; os avisos de erro, que ficam até resolver e têm botão (“Liberar espaço”), ficam também embaixo, mais fáceis de alcançar.
- **B.** **Retirado como defeito do site.** No código, essa frase é o ramo `!server` do diálogo social (`SocialDialog.tsx`): só aparece quando não há servidor configurado, como na cópia local que usei. No site publicado quem não tem conta vê o fluxo de entrar, que **não vi** nesta auditoria. Resta, em cópia sem servidor, a frase técnica (já anotada na 23, H2): poderia dizer em linguagem simples que a Comunidade precisa de uma conta e de um servidor, e quem cuida da cópia sabe o que fazer.
- **C.** O nome do sistema é um campo grande (estilo de título) que não quebra linha. *Melhoria:* o campo ocupa a largura e reduz a letra no celular, com reticências na ponta.
- **D.** Cada linha de revelação é “FICHA · nome · menu · sessão” e o botão de tirar quebra para baixo. *Melhoria:* o botão no fim da primeira linha (ou a linha em duas partes: texto e ações).
- **E.** Os três filtros ficam espremidos ao lado do campo de busca numa lista de ~320 px (no celular, a largura da tela); **não investiguei a causa no CSS**. *Melhoria:* duas linhas (a busca em cima, os três filtros embaixo) ou o botão “Filtros” que o celular já usa em Ligações.
- **F.** Há um **“Cancelar”** e o texto de progresso, então não é uma tela travada, mas é a primeira coisa que se vê ao diagramar. *Melhoria:* uma página de esqueleto com brilho (já existe a peça `.skeleton`) e “Montando as páginas…” no centro do quadro.
- **G.** Confirmei esperando 3,5 s (não é a animação de enquadrar correndo). É o mesmo comportamento do Obsidian (zoom no centro); mas no celular metade do mundo fica fora. *Melhoria barata:* um aviso curto na primeira vez (“Arraste para andar, aproxime com dois dedos”) ou abrir com o grafo inteiro à vista e as bolinhas pequenas.

### O que está bom (para não mexer)
O **Treino** (desafio do dia, três tamanhos, “Do meu jeito”); a **Oficina** (“Escrever melhor, um pouco por dia”, abas Hoje · Trilhas · Caderno · Biblioteca); o **Guia** (uma frase por parte, com “Abrir”); o **leitor** (coluna estreita, serifa, barra mínima); a **Estrutura** (a história de cima, promessas como linhas); a **Mesa** (versaletes e bege, Codex com o que o grupo vê); e o **tema escuro** em geral.

## Conferências do que ficou só no código (item 2)

| Conferência | Resultado |
|---|---|
| **Tour completo com “Ferramentas” recolhido** | **OK.** O grupo abre sozinho enquanto o tour passa, o passo da Oficina acha o botão (um só, à vista) e, ao fechar, o grupo volta a ficar recolhido. Teste novo: `e2e/tour-ferramentas.spec.ts` |
| **Filete de cor no tema escuro e na Mesa** | **OK.** Visto em Escrever (azul), Mundo (verde), Publicar (laranja), Trama (roxo) e Mesa (vermelho), todos no escuro e em universo comum. No exemplo, a faixa “Mundo de exemplo” cobre o filete (é esperado) |
| **Lista de Lugares do mapa com muitos marcadores** | **Falhava.** Com 47 marcadores a lista ocupava **1816 px** (mais de duas telas) e empurrava tudo. **Corrigido neste PR:** altura máxima de 10,5 rem com rolagem própria. Teste novo em `e2e/telas-apertadas.spec.ts` |

## Plano sugerido (um pacote pequeno)

1. **“Salvo” embaixo** (A), **título do sistema na Mesa** (C), **× do Codex** (D) e **filtros da lista de fichas** (E): todos pequenos, todos com teste de 390 px.
2. **Diagramação com esqueleto** (F) e **pista no grafo do celular** (G): um pouco maiores, porque mexem em telas com carregamento.
3. B, H e I: só se sobrar tempo (B só vale para cópias sem servidor).

## O que fica de fora
- Olhar com **pessoas de verdade** e em **celular de verdade** (aqui, o “Salvo” cobrindo as abas pode ser mais ou menos incômodo do que parece nas fotos).
- A **Comunidade como o site publicado a mostra** (com servidor, sem conta e com conta): só vi a cópia sem servidor. As telas “Livros abertos para ler”, do pacote anterior, só foram vistas por teste.
- O **Treino depois de começar**, o resultado e o placar; o **modo Jogo** de uma ficha de espécie ou cultura.
- **Contraste medido** no escuro (a olho está bom).
