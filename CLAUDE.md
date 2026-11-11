# Papirus — guia rápido para o Claude

App (PWA) de escrita, mundo (worldbuilding) e RPG de mesa. React + TypeScript + Vite, dados locais (IndexedDB) com nuvem opcional (Supabase). Tudo em português do Brasil: código comentado, textos da interface e conversa.

## Regras do dono

- **Não mexer em README, changelog nem versão** (`package.json`), a não ser que peça.
- **Economizar tokens:** respostas curtas; rodar só os testes ligados à mudança (nada de bateria e2e inteira); poucas fotos de tela, em escala 1.
- Nunca pedir senha, token ou chave no chat.
- Linguagem simples na interface: nomes que o usuário entende ("Ligações", "Linha do tempo"), sem jargão técnico.

## Como trabalhar

1. Cada mudança num ramo novo a partir do main: `git fetch -q origin main && git checkout -q -B produto/<nome> origin/main`.
2. Fazer, testar, commitar e dar push (`git push -u origin produto/<nome>`).
3. Abrir o pedido (PR) para o main; o dono junta (merge). Mudança em PR ainda aberto vai para o mesmo ramo.
4. Descrição do PR em português: o que muda, para quem, e os testes que rodaram.

## Comandos

- `npx tsc -b` — tipos (rápido).
- `npm run check` — tipos, oxlint, vitest e build. Os ~15 avisos `only-export-components` são normais; procurar erros.
- `npx vitest run <arquivo>` — testes de unidade de um arquivo.
- e2e só dos arquivos ligados: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/<arquivo>.spec.ts --trace off --reporter=line` (servidor em `localhost:5179`; reaproveita um que já esteja de pé: `npx vite --port 5179 --strictPort`).
- Universos de exemplo: `/app/?exemplo` (O Alienista) e `/app/?exemplo=ostria` (fantasia, com segredos).

## Mapa do código (`src/`)

- `model/` — esquema (zod, `schema.ts`), rótulos (`labels.ts`), operações do universo (`universe.ts`), exemplos (`sample*.ts`).
- `logic/` — regras sem tela: menções, segredos, leitor sem spoiler (`reader.ts`), frases de ligação (`relations.ts`), campos derivados.
- `views/` — telas. Áreas: Escrever, Mundo (Fichas, Ligações, Linha do tempo, Mapas), Trama, Mesa (RPG), Ajustes. `AreaModes.tsx` = topo do Mundo/Trama.
- `shell/` — moldura do app, lista de universos, navegação, tours (`pageTours.ts`).
- `state/workspace` — `useWorkspace()` (`universe`, `update`, `go`…).
- `persistence/` + `account/cloud.ts` — salvar local, versões e nuvem (duplas local/nuvem, conflitos).
- `export/` — livro, wiki do mundo (`wiki.ts`: site, .md e .json), downloads.
- `rpg/`, `player/`, `share/` — mesa ao vivo, celular do jogador, canal da mesa.
- `ui/` — peças comuns (`ViewTop`, `Modal`, capa gerada…). `styles/` — CSS por área (`views.css` é o maior).
- `e2e/` — Playwright; `areas.ts` tem `openPart(page, 'Ligações')` etc.

## Cuidados

- Segredos (`canon: 'secreto'`, trechos `[segredo]`) nunca saem em wiki, leitor ou compartilhar (`share/readerCopy.ts`).
- Campo novo no esquema: opcional, para não quebrar universos antigos.
- Celular é prioridade: conferir em 360–390 px de largura.
