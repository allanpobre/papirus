# Papirus

**Versão 1.2.0** · [Abrir o Papirus](https://allanpobre.github.io/papirus/) · [Novidades](CHANGELOG.md)

Escrita, mesa de RPG e oficina num app só. Para quem escreve histórias, mestra campanhas e constrói mundos.

> O autor deve sentir que está escrevendo enquanto o Papirus presta atenção, e não que está preenchendo um banco de dados.

Grátis, sem cadastro e funciona sem internet. Tudo fica no seu navegador; a conta é opcional e serve para levar os universos a outros aparelhos e para a parte social.

## Os três setores

O app abre num início com três setores. Cada um tem a sua cara (cores, letras e animação de entrada) e o seu menu.

### Escrita

- **Editor de cenas** limpo, com modo foco, máquina de escrever, som de teclas e meta do dia. Os nomes das fichas aparecem sublinhados; os nomes novos aparecem contados no botão Revisar da margem, como sugestão, e nunca viram ficha sozinhos.
- **Selecione e guarde:** um trecho vira ficha, fato (com quem disse e se é verdade), comentário ou ideia.
- **O mundo:** fichas de qualquer tipo (com retrato e leitura como enciclopédia), relações em grafo, linha do tempo com calendário próprio e atlas sobre a imagem do seu mapa.
- **Trama:** pistas e mistérios, quem sabe o quê, segredos e trechos que o leitor só vê a partir de certa cena.
- **Livro:** modo leitor com caderno sem spoiler, ouvir em voz alta, importação de .docx e .md, exportação em Word, EPUB e PDF diagramado para imprimir.
- **Revisão:** perguntas de continuidade (alguém em dois lugares no mesmo dia, um morto que reaparece), versões de cada cena e leitores beta com comentários presos ao texto.
- **Treino de escrita:** o desafio do dia num sprint com tempo e mínimo de palavras ou de caracteres. Cada tentativa fica guardada (e na nuvem, com conta) para refazer depois, com recorde, dias seguidos e um **placar** entre amigos e de todo mundo.
- **Metas:** meta do dia, meta com prazo, calendário de escrita, nível e medalhas.

### Mesa de RPG

- **Dado físico primeiro:** role os seus dados e diga o que saiu; o app soma o bônus, vê o crítico e calcula o dano. Sem dados na hora, o app rola.
- **Sistemas prontos** (D&D 5e, Tormenta 20, Ordem Paranormal, Call of Cthulhu, parada de dados, narrativo) ou as suas regras.
- **Ficha de jogo** feita para jogar: PV e PM com um toque, condições, ataques, poderes que gastam PM, perícias com o total e inventário.
- **Painel do mestre:** sessões com preparação e registro, iniciativa, tabelas aleatórias e revelações por grupo. Cada personagem tem o seu jogador; quem não vem fica de fora da sessão ou é conduzido pelo mestre.
- **Combate:** escolha o alvo e o app diz se acerta pela Defesa (20 e 1 naturais, crítico pela margem); o dano vem em seguida e sai da vida do alvo com um toque. A iniciativa mostra a vida de cada um e marca quem foi derrotado.
- **Seis climas** escolhidos pelo mestre para cada mesa (Tempestade, Pergaminho, Paranormal, Abismo, Neon, Floresta); cada jogador escolhe claro ou escuro.
- **Codex ao vivo:** o celular de cada jogador mostra só o que foi revelado, com o mapa e a ficha completa de cada personagem. Cada jogador rola pela própria ficha no celular: a rolagem chega ao mestre e ao grupo, e o mestre confere o acerto. Em combate, o Codex mostra a ordem e avisa quando é a vez de cada um. O mestre convida pelo QR code, vê quem está na mesa e começa a sessão na tela inteira; o celular de cada jogador avisa quando ela começa e quando termina. Para improvisar, o mestre anuncia (“Um inimigo aparece!”) e revela segredos com um toque, direto na mesa; o aviso aparece na tela de cada celular na hora.

### Oficina

- **Guias** de gêneros (fantasia, ficção científica, mistério, romance, terror, realismo), de técnicas (personagem, estrutura, diálogo, ritmo, revisão) e para mestres (mestrar, aventuras e vilões): o que funciona, armadilhas, livros para estudar, curiosidades e exercícios.
- **Gerador de ideias** para escrever (quem, quer, mas, onde) ou para a mesa (ganchos de aventura).
- Exercícios que viram cena com um toque e o seu progresso marcado.

### Com os amigos (com conta)

Perfil com @, amigos, estante (cada livro decide quem lê: só você, amigos ou todo mundo), novidades, reações por capítulo, desafios entre amigos e o placar dos treinos.

## Seus dados

- Tudo fica no navegador (IndexedDB), com salvamento automático, cópia de emergência, snapshots e vários universos.
- Backup em JSON (automático, se quiser), cópia numa pasta do computador e, com conta, sincronização entre aparelhos.
- Imagens são encolhidas no aparelho antes de guardar.
- **Perguntar ao mundo (opcional):** perguntas sobre a sua lore com a API do Claude, usando a sua chave. Só vai o que for relevante, e você vê o que será enviado.

Todas as automações podem ser desligadas em **Ajustes e dados**, e o menu esconde o que você não usa.

**Ajuda:** um tour rápido ou completo na primeira vez, e em cada tela um botão (?) que explica aquela tela, parte por parte.

## Conta e nuvem (opcional)

A conta, o compartilhamento, o Codex ao vivo, as imagens na nuvem, a parte social e os treinos usam um projeto [Supabase](https://supabase.com) (o plano grátis basta). Rode os scripts no **SQL Editor** do projeto, nesta ordem (todos podem ser rodados de novo sem problema):

| Ordem | Script | Para quê |
| --- | --- | --- |
| 1 | [`supabase/codex.sql`](supabase/codex.sql) | Codex ao vivo dos jogadores (as rolagens pelo Codex usam o mesmo canal) |
| 2 | [`supabase/contas.sql`](supabase/contas.sql) | Contas e universos na nuvem |
| 3 | [`supabase/compartilhar.sql`](supabase/compartilhar.sql) | Compartilhar universos e link de leitura |
| 4 | [`supabase/social.sql`](supabase/social.sql) | Perfil, amigos, estante, desafios e novidades |
| 5 | [`supabase/imagens.sql`](supabase/imagens.sql) | Imagens na nuvem (até 100 MB por conta) |
| 6 | [`supabase/treinos.sql`](supabase/treinos.sql) | Treinos de escrita e o placar |

Cada script garante no servidor quem vê o quê (Row Level Security), não só na tela.

Para publicar com o seu projeto já configurado, defina as variáveis `PAPIRUS_SUPABASE_URL` e `PAPIRUS_SUPABASE_KEY` (a chave pública) no repositório; o fluxo [`pages.yml`](.github/workflows/pages.yml) publica no GitHub Pages. Sem elas, cada pessoa pode informar o próprio projeto em **Entrar**.

## Desenvolvimento

Requer Node.js 22 ou mais novo.

```sh
npm install
npm run dev        # servidor de desenvolvimento
npm run check      # tipos, lint, testes e build
npm run test:e2e   # testes no navegador (Playwright)
```

Para usar um Chromium já instalado nos testes no navegador:
`PW_CHROMIUM_PATH=/caminho/do/chromium npm run test:e2e`.

A versão fica no `package.json` e aparece em Ajustes → Menu e ajuda e no rodapé da apresentação.

### Estrutura

- `src/landing` — a página de apresentação (`/`); o app fica em `/app/`.
- `src/shell` — moldura do app: início com os setores, menu, busca, voltar do aparelho.
- `src/views` — cada área do universo (Início, fichas, relações, linha do tempo, atlas, ajustes…).
- `src/editor` — editor de cena (TipTap), menções, destaque de nomes e imagens.
- `src/views/rpg`, `src/rpg` — mesa de RPG: sistemas, fichas, rolagens e climas.
- `src/oficina` — guias, gerador de ideias e progresso.
- `src/treino` — treinos de escrita, histórico, nuvem e placar.
- `src/social`, `src/account`, `src/share` — conta, amigos, estante, compartilhamento e Codex.
- `src/reader`, `src/book`, `src/export` — modo leitor, diagramação e importação/exportação.
- `src/images` — imagens: encolher, guardar e sincronizar.
- `src/model`, `src/logic`, `src/persistence` — formato dos dados e migrações, regras sem interface, armazenamento.
- `src/styles` — tokens de design e estilos.
- `supabase` — scripts do servidor.
- `e2e` — testes no navegador, com um Supabase de mentira (`e2e/fakeSupabase.ts`).

## Documentação

- [Visão geral](docs/00-visao-geral.md)
- [Princípios](docs/01-principios.md) — liberdade do autor acima de tudo
- [Roadmap](docs/02-roadmap.md)
- [Fase 1 — Escrita](docs/03-fase-1-escrita.md)
