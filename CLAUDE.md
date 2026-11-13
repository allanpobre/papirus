# Papirus — guia rápido para o Claude

App (PWA) de escrita, mundo (worldbuilding) e RPG de mesa. React + TypeScript + Vite, dados locais (IndexedDB) com nuvem opcional (Supabase). Tudo em português do Brasil: código comentado, textos da interface e conversa.

## Regras do dono

- **Não mexer em README, changelog nem versão** (`package.json`), a não ser que peça.
- **Economizar tokens:** respostas curtas; rodar só os testes ligados à mudança (nada de bateria e2e inteira); poucas fotos de tela, em escala 1.
- Nunca pedir senha, token ou chave no chat.
- Linguagem simples na interface: nomes que o usuário entende ("Ligações", "Linha do tempo"), sem jargão técnico.
- Ser honesto no fim: dizer o que foi testado e o que **não** foi (ex.: formato real de exportações, duas pessoas ao vivo).

## Como trabalhar

1. Cada mudança num ramo novo a partir do main: `git fetch -q origin main && git checkout -q -B produto/<nome> origin/main`.
2. Fazer, testar, commitar e dar push (`git push -u origin produto/<nome>`).
3. Abrir o pedido (PR) para o main; o dono junta (merge). Mudança em PR ainda aberto vai para o mesmo ramo.
4. Descrição do PR em português: o que muda, para quem, e os testes que rodaram.
5. Várias etapas que dependem uma da outra: cada ramo parte do anterior, todos os PRs para o main, e a descrição diz **"Juntar depois do #N"**. Antes de dar por pronto, conferir que nenhum par de PRs abertos conflita (`git merge-tree --write-tree origin/A origin/B`).

## Comandos

- `npx tsc -b` — tipos (rápido).
- `npm run check` — tipos, oxlint, vitest e build. Os ~15 avisos `only-export-components` são normais; procurar erros.
- `npx vitest run <arquivo>` — testes de unidade de um arquivo.
- e2e só dos arquivos ligados: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/<arquivo>.spec.ts --trace off --reporter=line` (servidor em `localhost:5179`; reaproveita um que já esteja de pé: `npx vite --port 5179 --strictPort`).
- Universos de exemplo: `/app/?exemplo` (Terra de Oz, o principal: "O Mágico de Oz" inteiro, traduzido), `/app/?exemplo=alienista` (O Alienista, o segundo) e `/app/?exemplo=ostria` (fantasia dos testes, com segredos, mapa, datas e ligações de período — bom para testar o Mundo).

## Mapa do código (`src/`)

- `model/` — esquema (zod, `schema.ts`), rótulos (`labels.ts`), tipo do universo e nível do Mundo (`kind.ts`), operações do universo (`universe.ts`), exemplos (`sample*.ts`: `sampleOz.ts` + `ozTexto.ts` (livro 1) + `ozOutros.ts` (trechos dos livros 2 e 3 e um conto solto) + `sampleOzMap.ts` é o principal; `sample.ts` tem O Alienista e escolhe qual abrir).
- `logic/` — regras sem tela: menções, segredos, leitor sem spoiler (`reader.ts`), frases de ligação (`relations.ts`, com o "é" de papéis), campos derivados e o worldbuilding:
  - `worldGaps.ts` (o que falta no mundo), `worldSeed.ts` (Semente do mundo), `timeMachine.ts` (o mundo num ano), `domino.ts` (e se a ficha sumir), `regions.ts` (mapa político).
- `views/` — telas. Áreas: Início, Escrever, Publicar, Mundo (Fichas, Ligações, Linha do tempo, Mapas), Trama, Mesa (RPG), Ajustes. `AreaModes.tsx` = topo do Mundo/Trama (com o botão Wiki).
  - Mundo: `WorldCard.tsx` (cartão no Início), `SeedDialog.tsx`, `TimeMachine.tsx` (na Linha do tempo), `DominoDialog.tsx` (na leitura da ficha), `GameRules.tsx` ("No jogo" de espécie/cultura), `ForeignImport.tsx`, `TogetherHere.tsx`, `WikiCard.tsx` (baixar; nas janelas, só o atalho) + `WikiView.tsx` (página Wiki: prévia ao vivo e Personalizar; o botão Wiki do Mundo leva para lá).
- `shell/` — moldura do app, lista de universos e setores (Escrita, Mesa, Oficina), navegação (`nav.ts`; o "Mais" do celular em grupos em `MORE_GROUPS`), tours (`pageTours.ts`). O **Guia** (`views/GuideView.tsx`) lista todas as áreas e partes e mostra o texto dos passeios de cada tela: tela nova ganha passeio e entra no Guia.
- `state/` — `useWorkspace()` (`universe`, `update`, `go`, `others`…) e preferências (`prefs.ts`).
- `persistence/` + `account/cloud.ts` — salvar local, versões e nuvem (duplas local/nuvem, conflitos).
- `export/` — livro, wiki do mundo (`wiki.ts`: site, .md e .json; personalizável em `settings.wiki`, com 4 estilos em `wikiLook`), downloads.
- `book/` — diagramação com Paged.js (`pagedDocument.ts`) e Folhear (`flip.ts` + `BookFlip.tsx`). O livro 3D fica em `views/BookView.tsx`.
- `import/` — trazer de outros apps (`foreignWorld.ts`: Obsidian/Markdown, Kanka, World Anvil, .zip via `fflate`).
- `rpg/` — sistemas, fichas de jogo, rolagens, combate; `worldBonuses.ts` leva os bônus da espécie/cultura para a ficha de jogo.
- `player/`, `share/` — celular do jogador, canal da mesa, compartilhar e presença ao vivo (`useLiveSync.ts`, com a ficha aberta).
- `landing/` — a apresentação (`/`): `Landing.tsx`, telinhas em `Demos.tsx`, Mundo e Livro em `WorldDemos.tsx`.
- `ui/` — peças comuns (`ViewTop`, `Modal`, capa gerada…). `styles/` — CSS por área (`views.css` é o maior; blocos novos vão no fim). Cores de cada área e tipo de ficha em `tokens.css` (`--area-*`, `--kind-*`, com versão escura).
- `e2e/` — Playwright; `areas.ts` tem `openPart(page, 'Ligações')`; `mundos.spec.ts` cobre o cartão do mundo.

## Decisões de produto

- **O worldbuilding mora dentro de cada universo** (escrita ou campanha). Não existe universo nem setor "só de mundo" (existiu do #91 ao #100 e foi desfeito).
- **Simples ou Completo** (`settings.worldLevel`) vale para qualquer universo, em Ajustes › Universo; o padrão é Completo. Simples só esconde (ficha e Trama), nunca apaga; "Mostrar tudo nesta ficha" abre o resto.
- **Quem é** (o que define alguém): cada mundo cria os seus itens em `settings.definers` ("Espécie", "Corpo", "Lua de nascimento"; vale para os tipos em `appliesTo`, como personagem, facção e reino). As opções são fichas do tipo do item; escolher é entrar na lista da opção marcada com `definer`, e a herança é o "o que todos têm" das listas. Exceção é campo próprio com `exception`. "No jogo" vale para as opções de qualquer item. Lógica em `logic/definers.ts`, telas em `views/WhoIs.tsx`.
- **Lendas e documentos** são um tipo de ficha (`documento`), não uma estrutura nova: assim herdam ligações, wiki, Codex e datas.
- **Universo alternativo (AU)** é outro universo, com `derivedFrom` (de quem, qual universo e um resumo de cada coisa que veio do original). Mudou o resumo, "Mudou no AU". Histórias e cenas do original são lore: só leitura. Quem pode criar fica em `settings.au.allowed` (SHA-256 do e-mail; no servidor é "ver"). Lógica em `logic/au.ts`; telas em `views/AUBanner.tsx` e `share/AUsOfMyWorld.tsx`. Sem script novo no servidor.
- **O livro não se personaliza no 3D nem no Folhear:** é sempre igual à diagramação.
- **Wiki:** o Personalizar mora na página Wiki; Ajustes e Publicar têm só o atalho “Personalizar e ver como fica”.
- **Bônus de espécie** ficam na ficha de jogo como `bonuses` (sincronizados com o Mundo) e são somados onde o atributo é lido (`attributeOf`, rolagens, Codex). Editar mexe no valor base.
- **Livro no alto:** num universo com mais de um livro (história), `bookId` do `useWorkspace()` diz em qual se está (guardado no aparelho, por universo). As telas usam `bookScenes`/`bookOnly` (`model/universe.ts`) ou `useBookUniverse()`; o seletor é `ui/BookPicker.tsx` (no celular, no Escrever, fica no topo da lista de cenas).
- **Wiki com link** é o link de leitura com `modo=wiki` (`share/WikiLinkPage.tsx`): sem script novo no servidor; a wiki tira os segredos sozinha.
- **Comunidade** é um setor do início do app (`SocialDialog` com `inline`; o "Sua conta" continua janela). Seguir (sem ser amigo), Continuar lendo (lugar no servidor), "Seus livros" (só números, nunca quem), bloquear, denunciar e pedir AU pelo perfil. Servidor em `supabase/comunidade.sql` (depois de contas, compartilhar e social); sem o script, as partes novas só não aparecem. Lógica em `social/community.ts`, telas em `social/CommunityParts.tsx` e `share/AURequests.tsx`.

## Cuidados

- Segredos (`canon: 'secreto'`, trechos `[segredo]`) nunca saem em wiki, leitor ou compartilhar (`share/readerCopy.ts`).
- Campo novo no esquema: opcional, para não quebrar universos antigos; enums com `.catch(undefined)`, para um valor desconhecido (de outra versão) não derrubar o universo.
- **Ao tirar algo que fica guardado** (setor, passeio, área do menu, tipo): limpar o valor antigo ao ler as preferências (`prefs.ts`) e não quebrar se ele aparecer. Já aconteceu: o setor "Mundos" guardado derrubava o app.
- `<input type="file">`: copiar `Array.from(files)` antes de limpar `value` (limpar esvazia a lista).
- Celular é prioridade: conferir em 360–390 px de largura. A faixa de partes do Mundo é apertada (no celular "Linha do tempo" vira "Tempo").
- No e2e, a ficha pode abrir em "Editar": clicar em "Ler" antes de procurar botões da leitura.
- Link `#x` dentro de iframe com `srcdoc` vai para o endereço do app: tratar o clique no próprio documento (como na wiki).

## Estado e fila

`docs/04-estado-e-proximos-passos.md`: o que está pronto, o que não foi testado de verdade e as ideias que ficaram na fila.
