# Auditoria 24 — Interface, movimento e comparação com outros apps

Feita em 26/11/2026, sobre o `main` com os PRs 277 a 285 já considerados (as telas foram tiradas de uma cópia com eles). Olhei o app inteiro, no **celular (390×844)** e no **computador (1280×800)**, com o exemplo Terra de Oz, e o tema escuro numa tela. Complementa a 23 (heurísticas): ali o olhar era o uso; aqui é o **visual, o ritmo e o movimento**.

**Limites (ditos antes, para ninguém se enganar):**
- Um avaliador só, sem pessoas de verdade, celular simulado (sem toque real, sem teclado virtual).
- **Os outros apps não foram abertos nesta sessão.** A comparação vem do que eu sei deles (versões até meados de 2026); eles mudam, e algum ponto pode estar velho. Vale conferir cada um antes de copiar qualquer coisa.
- Telas vistas: Biblioteca, Início, Escrever (só o modo Página), Mundo (Fichas, Ligações, Tempo, Mapas), Trama, Mesa (Preparar), Publicar, Ajustes e Guia no celular; Biblioteca a Publicar no computador. **Não vi:** Ajustes e Guia no computador, Escrever em Estrutura e Revisão, Comunidade, Oficina, o Treino, o leitor, a Diagramação, o modo Jogo da ficha e quase tudo no tema escuro.
- Contraste e tamanho de letra foram avaliados a olho e pelo CSS, não medidos de ponta a ponta (os testes de acessibilidade com o axe já passam).

## Resumo

O app tem **identidade forte e coerente** (serifa nos títulos, papel e verde-tinta, a Mesa em bege com versaletes) e já tem **48 animações** guardadas, quase todas em momentos de festa (abertura do livro, dados, nascimento da ficha, confete). O que falta é o contrário: **o movimento do dia a dia**. A troca de aba, a lista, o toque num botão, o "Salvo" e o tema acontecem **de uma vez**, sem transição, e é isso que faz um app parecer "de verdade" ao lado de iA Writer, Notion ou Linear. Há ainda cinco telas apertadas no celular (a pior é a de Mapas) e uma barra lateral no computador com peso demais.

| Eixo | Nota (0–5) | Em uma frase |
|---|---|---|
| Identidade visual | **4,5** | Reconhecível; a Mesa é a mais marcante, Mundo/Trama/Publicar se parecem demais |
| Hierarquia e densidade | **3** | Bom no Início e em Publicar; pesado em Mapas, Ligações e Trama no celular, e na barra lateral |
| Movimento do dia a dia | **2** | Festas ótimas, mas as trocas comuns são secas; só 10 regras de `:active` no app todo |
| Consistência entre telas | **3** | Títulos grandes em Publicar/Ajustes/Guia, só abas em Mundo/Trama/Mesa |
| Celular | **3,5** | A barra de baixo e as listas vão bem; Mapas e Trama pedem desenho próprio |
| Tema escuro | **4** (visto pouco) | A lista de fichas está boa; o resto ficou por ver |

## O que achei, por tela

Gravidade: **3** grande (corrigir logo) · **2** pequeno · **1** cosmético.

### Mapas (celular) — a mais fraca · gravidade 3
- Quatro linhas de controles antes do mapa (abas do mapa, "Adicionar mapa", "Gerar", nome, "Marcar lugar", "Rota", "Mais"): o mapa fica com **360×250 de 844 px** (cerca de 30% da tela).
- No mapa pequeno, **os nomes das regiões, dos marcadores e os dias das rotas ("7 d", "4 d") se sobrepõem** ("TERRA DO NORT…", "Castelo Amare…").
- No computador está ótimo (a imagem manda, a barra é uma linha): o problema é só o celular.
- *Melhoria:* no celular, o mapa ocupa a tela; as ferramentas viram uma gaveta de baixo ("Marcar lugar · Rota · Camadas"); nome de região só com zoom; dia da rota só ao tocar na rota.

### Ligações (celular) · gravidade 2
- O grafo abre com bolinhas e nomes **cortados nas bordas** ("Ter…", "Terra dos V…"). Pode ser o movimento de enquadrar ainda correndo quando tirei a foto: **confirmar** esperando 2 s antes de concluir.
- No computador, três linhas de filtros (legenda por tipo, caixas, abas) antes do grafo: ele fica com ~40% da altura.
- *Melhoria:* a legenda por tipo vira o botão "Filtros" que já existe no celular; enquadrar o grafo inteiro ao abrir.

### Trama (celular) · gravidade 2
- O quadro tem quatro colunas lado a lado; no celular só se vê **uma e meia**, e os filtros ficam cortados ("Abandonac…"). Dá para rolar, mas não dá para saber quantas colunas existem sem rolar.
- *Melhoria:* no celular, uma coluna por vez com as abas "Aberta 1 · Parcial 0 · Resolvida 4 · Abandonada 0" no alto (o contador já existe).

### Barra de baixo e títulos · gravidade 1–2
- O nome do item "elsewhere" corta ("**Ajustes e …**"): chamar de "Ajustes" na barra.
- Publicar, Ajustes e Guia abrem com **título grande em serifa**; Mundo, Trama e Mesa abrem só com as abas (o título "Mundo" existe, mas só no computador). Quem anda entre as áreas sente o chão mudar.
- A cor de cada área existe (`--area-*`) mas quase não aparece: **Mundo, Trama e Publicar parecem a mesma tela**. A Mesa tem cara própria (bege, versaletes) e é a que mais se lembra.

### Exemplo, "Salvo" e carregando · gravidade 2
- A faixa do exemplo ("Mundo de exemplo · Ler como livro · Sair") fica **fixa em todas as telas** (~48 px no celular) e o aviso "Salvo" aparece por cima do botão "Ler como livro" (visto em 3 das 8 fotos do celular). É passageiro, mas cobre um botão.
- O Início do exemplo no computador mostra só o texto "**Carregando…**" por um instante, em tela vazia.
- *Melhoria:* "Salvo" desce abaixo da faixa; a faixa pode ser recolhida; "Carregando…" vira esqueleto com brilho.

### Barra lateral (computador) · gravidade 2
- Treze itens em quatro blocos (Escrita, Ideias/Perguntar/Guia, Oficina, Ajustes/Compartilhar/Entrar). **"Oficina" é o único cartão colorido**, então chama mais atenção do que a área onde a pessoa está.
- *Melhoria:* "Oficina" como item comum; "Ideias · Perguntar ao mundo · Guia" juntos em "Ferramentas" (recolhível).

### Biblioteca (primeira tela) · gravidade 2
- Primeira tela é texto + formulário. "**Conhecer pelo exemplo**" fica abaixo da dobra (no computador e no celular), então quem não quer criar nada às cegas não vê a saída.
- *Melhoria:* "Abrir o exemplo" ao lado de "Criar universo", e uma imagem do app (uma ficha e um mapa) em vez de só texto.

### Lista de fichas · gravidade 1
- O resumo de cada ficha ("Personagem · A noiva do lenhador, antes de ele ser d…") usa cinza claro em letra pequena: **legível, mas no limite**. O botão "+" flutuante cobre o fim da lista até rolar (já tem folga de 72 px, então só incomoda na primeira olhada).

### O que está bom (para não mexer)
Publicar (a prateleira de capas e o livro grande); a Mesa (a identidade); o Início do celular (um próximo passo claro); a lista de fichas escura; a barra de baixo; o Guia e os Ajustes em lista (fáceis de percorrer); as capas geradas.

## Movimento: o que existe e o que falta

**Existe:** 48 `@keyframes`, a maioria em momentos de festa ou de abertura (livro, dado, nascimento da ficha, confete, brilho da Mesa); entrada de tela (`view-in`, 0,26 s) e de janela (`rise`); 21 blocos `prefers-reduced-motion` (o app já respeita quem pede menos movimento).

**Falta:** o movimento **pequeno e útil**. Hoje: as abas trocam secas; a lista de fichas aparece de uma vez; a barra de baixo troca o fundo sem deslizar; o toque num botão não responde (só 10 regras `:active` no app todo); o tema corta de claro para escuro; o "Salvo" só troca o texto.

### Regras para qualquer animação nova
1. **Até 200 ms**, curva de saída suave, só `transform` e `opacity` (não mexe no layout, não pesa no celular).
2. **Nunca na digitação**: nada anima enquanto a pessoa escreve (o que mais fere a sensação de iA Writer é a letra atrasar).
3. Todas dentro de `prefers-reduced-motion` (sem movimento, só a troca).
4. Uma só curva e três durações em `tokens.css` (`--dur-1/2/3`, `--ease-out`): hoje cada keyframe tem a sua.

### As animaçõezinhas, em ordem de retorno

| # | Animação | Onde | Esforço |
|---|---|---|---|
| 1 | **Indicador deslizante** sob a aba ativa (e o conteúdo com fade curto) | Estrutura·Página·Revisão, Fichas·Ligações·Tempo·Mapas, abas do Editar, Mesa | pequeno |
| 2 | **Resposta ao toque**: afunda 3% e escurece no `:active` | botões, cartões, linhas da lista | pequeno |
| 3 | **Pílula da barra de baixo** desliza de um item ao outro; o ícone ganha um pulinho | barra do celular e barra lateral | pequeno |
| 4 | **Entrada escalonada** (20 ms entre linhas, só as 12 primeiras) e **saída suave** ao apagar (a linha encolhe antes do "Desfazer") | lista de fichas, cenas, ligações | pequeno |
| 5 | **Esqueleto com brilho** no lugar de "Carregando…" | Início, listas, Wiki | pequeno |
| 6 | **"Salvo" com ✓ que se desenha**; o pontinho pulsa só quando está salvando | indicador de salvamento | pequeno |
| 7 | **Tema** com transição de cor de 200 ms (hoje corta) | claro↔escuro | pequeno |
| 8 | **Marcadores caem** no mapa ao abrir e **a rota se desenha** (a animação `edge-draw` já existe nos grafos) | Mapas | pequeno a médio |
| 9 | **Palavras do dia contam subindo** e a barra da meta enche com suavidade (o confete já existe) | Escrever, Início | pequeno |
| 10 | **Gaveta que acompanha o dedo** e se fecha arrastando para baixo | gavetas e folhas no celular | médio |
| 11 | **Troca de versão da ficha**: o nome, o retrato e o resumo trocam com fade ao mover a régua "até onde na história" | ficha, Versões | médio |

A **11** é a que mais pode virar assinatura do Papirus: nenhum concorrente mostra, de fato, **a ficha mudando ao longo da história**. Uma troca bonita ali conta o que o app faz melhor.

## Comparação com outros apps

*Do meu conhecimento, não de uso nesta sessão (ver "Limites").*

| App | Onde acerta | Onde peca | O que isso diz para o Papirus |
|---|---|---|---|
| **iA Writer / Ulysses** | Texto em primeiro lugar; quase nenhum controle; transições curtas e silenciosas; modo foco | Pouco para mundo ou ficha; tudo é texto | O modo **Página** já é assim; manter a digitação livre de animação e a barra fina |
| **Scrivener** | Quadro de cortiça, fichas e pasta; quem escreve muito o ama | Visual antigo, curva de aprendizado alta, celular fraco | O Papirus já ganha no visual e no celular; não copiar a densidade |
| **Notion** | Toque e passar o mouse respondem; "/" para tudo; esqueletos; arrastar com alça | Lento em páginas grandes; sem noção de história ou de cena | Copiar a **resposta ao toque**, o **esqueleto** e a **alça de arrastar** (animações 2, 4 e 5) |
| **Obsidian** | Grafo com física; tudo local; tema e plugins | Tela cheia de opções; celular desajeitado | O grafo do Papirus é mais legível; falta enquadrar ao abrir |
| **World Anvil** | Quase todos os campos que um mundo pode ter | **Sufoca** quem começa; tela cheia de menus; tudo em volta de modelos | Evitar: o "Simples/Completo" do Papirus é a resposta certa; cuidar da **barra lateral** para não crescer assim |
| **Kanka** | Estrutura clara, tabelas, permissões por campanha | Aparência de planilha; pouco prazer visual | O Papirus tem mais cara; a Tabela é um bom reforço, sem virar o padrão |
| **LegendKeeper** | **Mapa como herói**: ocupa a tela, marcadores abrem uma ficha na hora; rápido | Foco em mundo, pouco em escrever livro | Aqui o Papirus está atrás **no celular**: levar a ideia de mapa em tela cheia |
| **Campfire** | Escolher só os módulos de que precisa; cartões por módulo | Cobra por módulo; interface comum | O "Simples/Completo" faz o mesmo sem pagar; mostrar isso já na Biblioteca |
| **Plottr / Dabble** | Linha do tempo e quadro visual da trama; progresso bonito | Fichas fracas, pouco mundo | A Trama e a Linha do tempo do Papirus são mais ricas; o **progresso** (palavras, meta) pode ser mais vivo (animação 9) |
| **Inkarnate** | Mapa lindo com pouco esforço | Só mapa | Não competir; o Papirus usa a imagem que a pessoa tem |
| **Foundry / Roll20 / Owlbear** | Mesa ao vivo com tokens e dados | Pesados, ligados a navegador de computador | A Mesa do Papirus (celular do jogador) é um caminho próprio; a rolagem do d20 já tem animação |
| **Duolingo / Habitica** | Recompensa pequena e imediata (confete, números subindo) | Podem cansar; pressão de sequência | O confete e as metas já existem; manter **sem culpa** (o Papirus não pune faltar) |
| **Linear / Things** | Listas que respondem na hora; saídas suaves; atalhos | Foco em tarefa, não em texto | Referência de **ritmo**: lista com entrada escalonada e saída suave (animação 4) |

**Padrão que se repete:** os apps que *parecem* melhores (iA Writer, Notion, Linear) não têm mais recursos, têm **resposta imediata e suave a cada toque**. Os que perdem (World Anvil, Scrivener, Kanka) perdem por **densidade e aparência**, não por falta de função. O Papirus tem a função e a cara; **falta o ritmo**.

## Plano sugerido (4 pacotes pequenos, cada um num PR)

1. **Telas apertadas no celular** (gravidade 3 e 2): Mapas em tela cheia com gaveta de ferramentas; Trama por coluna; "Ajustes" na barra; "Salvo" fora da faixa do exemplo; Biblioteca com "Abrir o exemplo" à vista. *Teste: capturas a 390 px e verificação de que nada se sobrepõe nos Mapas.*
2. **Movimento de base**: tokens de duração e curva; animações 1, 2, 3, 5 e 7. *Teste: com `prefers-reduced-motion` nenhuma delas anima; sem ele, a aba ativa tem o indicador no lugar certo.*
3. **Movimento com sentido** (as de assinatura): 4, 6, 8, 9 e 11. *Teste: a lista apagada some antes do "Desfazer"; o ✓ do "Salvo" aparece; a troca de versão não atrasa a régua.*
4. **Barra lateral e identidade por área**: "Oficina" como item comum, "Ferramentas" recolhível, um filete da cor da área no alto de cada tela. *Teste: a barra a 1280 px tem no máximo oito itens à vista.*

A animação 10 (gaveta que acompanha o dedo) fica para depois: é a mais cara e a que mais exige teste em celular de verdade.

## O que fica de fora
- Olhar com **pessoas de verdade** e em **celular real** (toque, teclado, desempenho de animação em aparelho fraco).
- Medir a **taxa de quadros** das animações novas em um celular de entrada: eu garantiria só `transform` e `opacity`, mas não medi.
- Tema escuro de ponta a ponta, Comunidade, Oficina, Treino, leitor e Diagramação.
