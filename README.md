# Papirus

Ambiente de worldbuilding e escrita contextual para escritores, mestres de RPG e criadores de universos ficcionais.

> Projeto anteriormente chamado NEXUS.

> O autor deve sentir que está escrevendo enquanto o Papirus presta atenção — não que está preenchendo um banco de dados.

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

- `src/model` — formato dos dados, validação e migrações versionadas.
- `src/persistence` — armazenamento local (IndexedDB, com localStorage como alternativa) e salvamento automático.
- `src/editor` — editor de cena (TipTap).
- `src/export` — exportação em Markdown e backup em JSON.
- `e2e` — testes no navegador.
