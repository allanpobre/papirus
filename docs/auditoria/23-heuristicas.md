# Auditoria 23 — Avaliação heurística (as 10 de Nielsen) e jornada do usuário

Feita em 24/11/2026, sobre o `main` já com as fases planejadas, as referências à vista, o nascimento em cartas e as versões na ficha. Complementa os relatórios 01 a 22 (que olharam área por área): aqui o olhar é **transversal**, e cada achado nasce de uma medição feita agora ou de uma leitura de código, dita no próprio achado. Gravidade na escala de Nielsen: **0** não é problema · **1** cosmético · **2** pequeno · **3** grande (corrigir logo) · **4** catastrófico (corrigir antes de tudo).

**Limites:** um avaliador só (eu), sem usuários reais; celular simulado a 390 px (sem teclado virtual nem toque real); nuvem e Mesa ao vivo vistas só pelas specs. Heurística não substitui sentar ao lado de alguém e olhar.

## Resumo

| # | Heurística | Nota | O que pesa |
|---|---|---|---|
| 1 | Visibilidade do estado do sistema | **3** | **No celular não existe indicador de salvamento**; sem aviso de offline |
| 2 | Linguagem do mundo real | 2 | Jargão (Snapshots, dupla, Pedir para manter, Quase); frases geradas sem artigo |
| 3 | Controle e liberdade do usuário | **3** | Desfazer existe em ficha/cena/evento/trama, mas **faltam em 6 remoções**; janelas descartam o digitado |
| 4 | Consistência e padrões | 2 | Nova cara muda nomes e lugares; mesmo nome para coisas diferentes; 2 jeitos de apagar |
| 5 | Prevenção de erros | **4** | **`[segredo]` sem fechar (ou com erro de digitação) vaza**; nome repetido sem aviso |
| 6 | Reconhecimento em vez de lembrança | 3 | Segredo só digitando tags; 16 ícones sem texto numa ficha; partes que só aparecem com conteúdo |
| 7 | Flexibilidade e eficiência | 2 | Bom para quem usa teclado (Ctrl K, 8 atalhos, seleção em lote); quase nada de gesto no celular |
| 8 | Estética e design minimalista | 3 | **A ficha em Editar tem 5,4 telas, 23 seções e 89 controles** |
| 9 | Ajudar a reconhecer, diagnosticar e corrigir erros | 1 | Mensagens claras e com saída; só falta o caminho de volta em poucos casos |
| 10 | Ajuda e documentação | 2 | Passeio por tela + Guia (ótimo); 48 de 62 janelas sem "?"; passeios falam de lugares que a Nova cara muda |

**Melhor do app:** 9 e 1 (no computador). **Pior:** 5 e 1 (no celular), 3, 8 e 6.

---

## A jornada do usuário, etapa por etapa

Escala de ânimo: 😀 flui · 🙂 ok · 😐 atrito · 😖 trava ou assusta.

| Etapa | O que a pessoa quer | Como está hoje | Ânimo | O que melhorar |
|---|---|---|---|---|
| **1. Chegar** | Entender o que é e entrar | Apresentação clara; "Começar a escrever" cai na tela certa (01) | 😀 | — |
| **2. Primeira frase** | Escrever já | 3 toques até digitar; nada se perde ao recarregar (01) | 😀 | O passeio não abre sozinho; o título parece o texto |
| **3. Confiar que está salvo** | Saber que não vai perder | **No celular nada diz "Salvo"** (H1); o passeio fala de um indicador que não está na tela | 😖 | Indicador de salvamento no celular |
| **4. Escrever e marcar** | Fatos, nomes, segredos | Nomes novos e Revisão ótimos; **segredo só digitando `[segredo]…[/segredo]`** (H5/H6) | 😐 | Botão "Segredo" na barra de seleção; proteger tag sem fechar |
| **5. Criar uma ficha** | Pôr uma ideia no mundo | Agora nasce em cartas, com dado e ligações (novo) | 😀 | Avisar nome repetido; ver com Nova cara escura |
| **6. Dar profundidade** | Versões, referências, ligações | Barra Versões e faixa de Referências (novos); **a ficha em Editar tem 5,4 telas** (H8) | 🙂 | Editar em abas; barra Versões também em Editar |
| **7. Organizar o mundo** | Ver o conjunto | Grafo, Faixas e mapa bons; rótulos do mapa se cobrem; Oz embolado (06, 08) | 🙂 | Filtro de entrada no grafo; rótulos do mapa |
| **8. Corrigir um engano** | Voltar atrás | Desfazer em ficha, cena, evento e trama; **seis remoções sem volta** (H3) | 😐 | Desfazer em todas; guarda ao fechar janelas |
| **9. Publicar** | Ter o livro/wiki | Roteiro numerado do livro claro; sem segredos nos arquivos (10) | 😀 | Exemplo com livro pronto |
| **10. Jogar** | Mesa com o mundo | Sessão da capa ao fim é muito boa (11) | 😀 | Criar personagem sem voltar à lista |
| **11. Voltar amanhã** | Retomar de onde parou | "Onde você parou", bilhete para amanhã, "(feito)" nos primeiros passos | 😀 | Dizer que está offline/sincronizando |

---

## Heurística por heurística

### H1 · Visibilidade do estado do sistema — nota 3

**Funciona:** progresso do "Diagramar" (spec `diagramar-progresso`); "Salvo / Salvando… / Alterações não salvas / Erro ao salvar" no computador; "(feito)" nos primeiros passos; toasts com o que aconteceu ("Ficha criada"); o aviso de versão nova com "Atualizar" (20).

**Problemas:**
- **H1.1 · gravidade 3 · sem indicador de salvamento no celular.** Medido: em 390 px o elemento `.save-status` **não existe**; no computador existe (46×19 px, "Salvo"). O passo do passeio "Salvo sozinho" aponta para ele e, no celular, o balão fica solto. Num app de escrita, que é "mobile first", a dúvida "será que salvou?" é a primeira que a pessoa tem. *Melhoria:* um ponto discreto ao lado de "Início" ou no cabeçalho da Página (verde = salvo, âmbar = salvando, vermelho = erro), com o texto no toque.
- **H1.2 · gravidade 2 · sem aviso de offline** (já no 20). *Melhoria:* "Sem internet · salvo neste aparelho" ao lado do ponto acima.
- **H1.3 · gravidade 2 · partes que só aparecem com conteúdo** ("Mapas, quando houver um lugar"): é boa ideia de revelação gradual, mas o estado "escondido" não é visível sem ler a frase. *Melhoria:* mostrar a parte apagada (cinza, com o que falta) em vez de sumir.

### H2 · Correspondência entre o sistema e o mundo real — nota 2

**Funciona:** a linguagem é simples e direta ("Nada é apagado", "Sem conta, tudo fica neste navegador"); "Fazer o tour", "Dar vida", "Sortear do meu mundo".

**Problemas:**
- **H2.1 · 2 · jargão que a pessoa nunca escolheu:** "Snapshots", "dupla" local/nuvem, "Pedir para manter", "Quase/Rascunho" ao lado do nome, "Sprint", "Codex", "conceito" (21). *Melhoria:* um glossário único e trocar na tela ("Cópias guardadas", "cópia neste aparelho").
- **H2.2 · 2 · frases geradas sem artigo** ("Entrar para Casa de Vaelor", "Em Paço do Regente") nas faíscas do nascimento e no Rolar no mundo (09). *Melhoria:* frases que aceitam qualquer nome, ou um campo "artigo" na ficha.

### H3 · Controle e liberdade do usuário — nota 3

**Funciona (verificado agora):** apagar **ficha** e **cena** pede confirmação e depois oferece **Desfazer**; também evento e trama (`undoable`, 27 usos no código); Esc fecha as janelas e devolve o foco (18); "Pular" no nascimento e "Voltar para agora" nas versões.

**Problemas:**
- **H3.1 · gravidade 3 · seis remoções sem confirmação e sem Desfazer** (lidas no código; no celular não há Ctrl+Z): "Remover" em **"O que a ficha sabe"** (`EntitiesView.tsx`), **tirar uma tensão** (`PowerPanel.tsx`), **tirar um deus do panteão** e **tirar um fiel** (`PantheonPanel.tsx`), **tirar a ficha de uma lista** e **tirar todas as ligações de um tipo** (`EntitiesView.tsx`). São toques de 28 px, perto de outros botões. *Melhoria:* trocar por `undoable(...)`, como já se faz em evento e trama (1 linha cada).
- **H3.2 · gravidade 3 · apagar universo não tem Desfazer** (02).
- **H3.3 · gravidade 2 · fechar uma janela com texto digitado descarta sem perguntar.** Medido: em "Nova versão" digitei nome e resumo, toquei no X e a janela fechou sem aviso, sem guardar nada (e sem a versão aparecer na barra). O mesmo vale para "Nova ficha". Em janelas curtas é aceitável; na de versão (muita digitação) não. *Melhoria:* "Descartar o que você escreveu?" só quando houver mudança.
- **H3.4 · 2 · sem "duplicar" e "renomear" na lista de universos** (02).

### H4 · Consistência e padrões — nota 2

**Funciona:** o mesmo componente de confirmação (`ConfirmButton`, 49 usos) e o mesmo de janela (`Modal`, 62); cores por tipo e área em tokens.

**Problemas:**
- **H4.1 · 3 · a Nova cara muda onde as coisas moram**: barra de baixo (Escrever, Mundo, História, Mesa, Menu); a **Linha do tempo sai do Mundo e vai para História**; e o passeio, o Guia e o "O que mudou" continuam com os nomes antigos (17, 21).
- **H4.2 · 2 · dois jeitos de apagar** (com Desfazer × direto; ver H3.1) e **dois de criar ficha** (linha no computador × janela no celular).
- **H4.3 · 2 · o mesmo nome para coisas diferentes:** "Revisão" (aba e janela), "Mais" (menu e mapa), "Ligações" ×4, "Wiki" ×4 (21); e **nomes diferentes para a mesma coisa:** Tempo/Linha do tempo, Trama/História, Snapshots/versões/cópias.
- **H4.4 · 1 · a barra de Versões só existe em Ler**; em Editar fica o formulário antigo.
- **H4.5 · 2 · tamanho dos alvos varia** de 28 a 45 px entre botões vizinhos (18).

### H5 · Prevenção de erros — nota 4

**Funciona:** confirmação antes de apagar; "Marcar seleção como segredo" nos campos de texto das fichas (insere as duas marcas juntas); o aviso de viagem rápida; nomes novos só viram ficha com um clique.

**Problemas:**
- **H5.1 · gravidade 4 · um segredo mal fechado vaza.** Testei `stripSecrets` (a função que tira os segredos da wiki, do leitor e do link):
  - `Ela chegou. [segredo]É a rainha disfarçada. Depois partiu.` (sem `[/segredo]`) → **sai inteiro, com o segredo**;
  - `[segrdo]…[/segrdo]` (erro de digitação) → **sai inteiro**;
  - `[ segredo ]…[/ segredo ]` (espaços) → **sai inteiro**;
  - maiúscula (`[Segredo]`) funciona.
  Como **nas cenas não há botão de segredo** (a barra de seleção tem Fato, Ficha, Vincular, Muda ou revela, Comentar, Guardar em Ideias, Negrito e Itálico), quem marca um segredo numa cena **digita as duas tags à mão**, e é fácil esquecer uma. O resultado é o oposto do que o app promete ("Segredos nunca saem"). *Melhoria (pequena e segura):* (a) **falhar para o lado seguro**: `[segredo]` sem fechar esconde até o fim do parágrafo; (b) a Revisão/Perguntas de continuidade avisa "segredo aberto sem fechar" e "marca parecida com segredo"; (c) botão **"Segredo"** na barra de seleção da cena.
- **H5.2 · 2 · nome repetido sem aviso.** Medido: ao criar "Kael" onde já existe um "Kael", a janela não avisa nada. *Melhoria:* "Já existe Kael (Personagem). Abrir essa?" antes de criar.
- **H5.3 · 2 · tocar sem querer em ícones de 28 px** (H3.1) sem volta.

### H6 · Reconhecimento em vez de lembrança — nota 3

**Funciona:** o "Para começar" com exemplos nas caixas; perguntas e dado no nascimento; chips de "o que peguei daqui"; "Primeiros passos".

**Problemas:**
- **H6.1 · 3 · o segredo exige lembrar a marca** (H5.1).
- **H6.2 · 2 · muitos botões só com desenho** (têm nome para leitor de tela, mas a pessoa vê só o ícone). Medido por tela: Início 5 · Escrever 7 · Mundo/Fichas 4 · **ficha 16**. O lápis aparece em vários blocos com funções diferentes.
- **H6.3 · 2 · ferramentas só existem se você souber:** Língua e Oficina da cultura só na ficha de Cultura (não na de Povo); "E se sumir?" e "Arrumar a página" são ícones; Ostria só pela URL (22).
- **H6.4 · 2 · "Quase / Rascunho" ao lado do nome** não diz o que é (05).

### H7 · Flexibilidade e eficiência de uso — nota 2

**Funciona:** Ctrl K e comandos ("nova cena", "tema escuro"); 8 atalhos documentados em Ajustes; selecionar várias fichas (Pôr numa lista, Etiqueta, Tipo, Livro, Apagar); "Criar várias de uma vez"; criar e "fazer outra"; a jornada do escritor fecha em 35 toques.

**Problemas:**
- **H7.1 · 2 · quase nenhum atalho de gesto no celular** (deslizar entre cenas, segurar para abrir o menu da ficha). O nascimento em cartas é a exceção.
- **H7.2 · 2 · caminhos longos:** Escrever → Publicar são 4 toques (fechar teclado, Mais, Publicar); cada personagem novo da Mesa são 2 toques (16).
- **H7.3 · 1 · especialista e novato veem a mesma ficha em Editar** (H8); o Simples/Completo está escondido em Ajustes.

### H8 · Estética e design minimalista — nota 3

**Funciona:** a página de leitura da ficha, o Início, a sessão da Mesa e as cartas do nascimento são calmos e com foco.

**Problemas:**
- **H8.1 · 3 · a ficha em Editar é uma parede.** Medido no Kael a 390×844: **Ler = 3,2 telas e 38 controles; Editar = 5,4 telas, 23 seções e 89 controles** (Quem é, Descrição, Campos, Ligações, Arco, Fatos, O que sabe, Fases, Poderes, Referências, Mais opções, Listas, Aparições…). Quem edita rola muito e perde o lugar. *Melhoria:* Editar em abas (Básico · Mundo · Tempo · Referências) como já faz a Nova cara em Ler, mantendo "tudo de uma vez" para quem quer.
- **H8.2 · 2 · o alto do Mundo tem 6 ícones** (buscar, ajuda, rolar, wiki, compartilhar, globo) mais 4 abas e a barra do mapa em 3 linhas (08).
- **H8.3 · 2 · a Máquina do tempo ocupa um terço da tela** antes da lista (07).

### H9 · Ajudar a reconhecer, diagnosticar e corrigir erros — nota 1

**Funciona:** mensagens com saída ("Este link de leitura foi desligado ou trocado. Peça um novo a quem compartilhou."); arquivo ruim no importar ("Não achei fichas nesses arquivos. Use notas .md, exportações .json ou um .zip."); "Esta parte deu erro" com o resto do app de pé (`erro-por-tela`); "Erro ao salvar — tentando de novo".

**Problemas:**
- **H9.1 · 1 · o erro de segredo (H5.1) não dá nenhuma pista** (nem na cena, nem na Revisão).
- **H9.2 · 1 · "Alterações não salvas"/"Erro ao salvar" só existem onde o indicador existe** (H1.1).

### H10 · Ajuda e documentação — nota 2

**Funciona:** "(?)" em cada tela com passeio próprio (14 passeios novos só nesta rodada de trabalho), **Guia** com todas as áreas, "O que mudou", primeiros passos, dicas dentro de cada tela vazia.

**Problemas:**
- **H10.1 · 2 · 48 das 62 janelas não têm "?"** (14 têm). As cartas do nascimento e a janela de nova versão têm passeio/ajuda; as de fato, bestiário, pedido de teste, anunciar, condições não.
- **H10.2 · 2 · os passeios descrevem o app sem a Nova cara** (H4.1); o passeio do celular fala do indicador "Salvo sozinho" que não existe nele (H1.1).
- **H10.3 · 1 · os passeios mais longos passam de 350 caracteres** para um balão de 390 px (21).

---

## As 10 melhorias que eu faria, em ordem

Ordem por **gravidade × alcance ÷ esforço**.

| # | Melhoria | Heurística | Gravidade | Esforço | Arquivos prováveis |
|---|---|---|---|---|---|
| 1 | **Segredo seguro por padrão:** `[segredo]` sem fechar esconde até o fim do parágrafo; aviso na Revisão para marca aberta ou parecida; teste nos 3 caminhos (wiki, leitor, link) | H5, H9 | **4** | pequeno | `src/logic/secrets.ts`, `readerCopy.ts`, `continuity` |
| 2 | **Botão "Segredo"** na barra de seleção da cena (usa o `wrapSecret` que já existe) | H5, H6 | 3 | pequeno | `src/editor/`, barra de seleção |
| 3 | **Indicador de salvamento no celular** (e "sem internet") | H1 | 3 | pequeno | `WorkspaceShell.tsx`, CSS |
| 4 | **Desfazer nas 6 remoções sem volta** (e no apagar universo) | H3 | 3 | pequeno a médio | `EntitiesView.tsx`, `PowerPanel.tsx`, `PantheonPanel.tsx`, `LibraryScreen.tsx` |
| 5 | **Guardar o digitado ao fechar** a janela de nova versão (pergunta só se mudou) | H3, H5 | 2 | pequeno | `VersionsView.tsx` |
| 6 | **Aviso de nome repetido** ao criar ficha | H5 | 2 | pequeno | `EntityCreate.tsx`, `BirthFlow` |
| 7 | **Ficha em Editar com abas**, no mesmo molde da Nova cara; a barra de Versões também em Editar | H8, H4 | 3 | médio | `EntitiesView.tsx` |
| 8 | **Nova cara com os mesmos nomes e lugares** (ou passeio/Guia/Novidades por modo) | H4, H10 | 3 | médio | `pageTours.ts`, `GuideView.tsx`, `nav.ts` |
| 9 | **Glossário único e troca do jargão** (Snapshots, dupla, Pedir para manter, Quase) | H2, H4 | 2 | pequeno | vários `.tsx` |
| 10 | **Zona de toque e rótulos** nos ícones da ficha (os 16) e "?" nas 48 janelas que não têm | H6, H10 | 2 | médio | `base.css`, `Modal.tsx` |

**Se for fazer só três coisas:** 1, 3 e 4. São pequenas, e as três mexem com **confiança** — não vazar um segredo, saber que salvou e poder voltar atrás —, que é o que decide se alguém coloca o livro inteiro num app.

## O que ficou de fora

- Teste com **pessoas de verdade** (heurística acha problemas de interface, não de gosto nem de necessidade).
- **Celular real:** teclado virtual, gestos, instalação.
- **Leitor de tela** de verdade e **navegação só por teclado** (só axe e Esc).
- **Nuvem e colaboração ao vivo**, e a **Mesa com jogadores** (só as specs).
- **Idiomas e leitores novatos em escrita longa:** o ritmo de quem escreve 5 mil palavras por dia.
