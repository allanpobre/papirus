# Papirus

Ambiente de worldbuilding e escrita contextual para escritores, mestres de RPG e criadores de universos ficcionais.

> Projeto anteriormente chamado NEXUS.

> O autor deve sentir que está escrevendo enquanto o Papirus presta atenção — não que está preenchendo um banco de dados.

## O que o Papirus faz

**Escrever**
- Editor de cenas com formatação mínima, separador de cena, modo foco e meta diária de palavras.
- Histórias com cenas e cenas soltas; nada obriga a ter livro, capítulo ou ficha.
- Margem viva: quem está na cena e no parágrafo, onde e quando, o que o ponto de vista sabe, fatos e tramas por perto.
- Nomes de fichas destacados no texto; selecione um trecho para vincular a uma ficha, criar ficha, capturar um fato ou guardar na Inbox.
- Revisão sob demanda: nomes novos encontrados no texto, perguntas de continuidade e pendências — nunca durante a digitação.
- Versões de cena com comparação palavra a palavra; leitura sem distrações e ensaio parágrafo a parágrafo.

**Mundo e narrativa**
- Fichas de qualquer tipo (inclusive tipos próprios), com apelidos, canon e estado editorial independentes, campos livres, relações, aparições e linha do tempo.
- Grafo de relações, Timeline com eras e cenas datadas, Atlas sobre a imagem do seu mapa.
- Tramas e mistérios com pistas; Conhecimento separando verdade do autor, o que cada personagem sabe e o que o leitor já viu.
- Organizar: quadro de cenas, matriz de presença e ritmo.

**Mesa de RPG**
- Painel do mestre, sessões com preparação, registro com hora e iniciativa.
- Revelações por grupo e um Codex dos jogadores que só mostra o que foi revelado.
- Rolador de dados (`2d6+3`, `4d6kh3`, vantagem/desvantagem).

**Dados**
- Tudo fica no navegador (IndexedDB), com salvamento automático, cópia de emergência ao fechar a página, snapshots e vários universos.
- Backup completo em JSON, manuscrito em Markdown, importação e ramos “E se…?”.

**Archivist (opcional)**
- Perguntas sobre a lore usando a API do Claude com a sua própria chave. Só os registros relevantes são enviados, segredos e texto do manuscrito apenas se você pedir, e você vê o que será enviado antes.

Todas as automações podem ser desligadas em **Ajustes e dados**.

## Documentação

- [Visão geral](docs/00-visao-geral.md)
- [Princípios](docs/01-principios.md) — liberdade do autor acima de tudo
- [Roadmap](docs/02-roadmap.md)
- [Fase 1 — Escrita](docs/03-fase-1-escrita.md)

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

### Estrutura

- `src/model` — formato dos dados, validação, migrações versionadas e universo de exemplo.
- `src/logic` — regras sem interface: detecção de nomes, continuidade, conhecimento, Codex, grafo, busca, dados, diferenças de texto.
- `src/persistence` — armazenamento local, biblioteca de universos, snapshots e salvamento automático.
- `src/editor` — editor de cena (TipTap), menções e destaque de nomes.
- `src/shell` — moldura do app: menu, busca, captura rápida, painel de ficha.
- `src/views` — cada área do app.
- `src/ai` — chamada opcional do Archivist.
- `src/styles` — tokens de design e estilos.
- `e2e` — testes no navegador.
