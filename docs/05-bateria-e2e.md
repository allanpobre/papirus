# A bateria e2e inteira

Os testes no navegador (`e2e/`) rodam com o Playwright contra o servidor de desenvolvimento (`localhost:5179`). No dia a dia, rode só os arquivos ligados à mudança (veja o [CLAUDE.md](../CLAUDE.md)). A bateria inteira vale antes de uma entrega grande ou depois de mudar algo que atravessa o app (menu, salvar, esquema).

## Como rodar

```bash
# A bateria inteira (cerca de 10 minutos com 2 processos), com um relatório JSON:
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/e2e.json \
  npx playwright test --trace off --reporter=json > /dev/null

# Os arquivos mais longos, duas vezes cada (acha o teste "instável", que só falha às vezes):
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/e2e-rep.json \
  npx playwright test e2e/mesa-ao-vivo.spec.ts e2e/ajuda.spec.ts e2e/a11y.spec.ts e2e/escrita.spec.ts \
  e2e/extras.spec.ts e2e/jornadas.spec.ts e2e/imagens.spec.ts --repeat-each=2 --trace off --reporter=json > /dev/null

# A tabela de tempos e os testes com problema:
node scripts/resumo-e2e.mjs /tmp/e2e.json
```

## Última medição (14 de novembro de 2026)

199 testes em 44 arquivos: **199 passaram, nenhum falhou, nenhum instável** (cerca de 10 minutos). Os sete arquivos mais longos, rodados de novo com `--repeat-each=2` (142 execuções): **todas passaram, nenhuma instável**.

| Arquivo | Testes | Tempo (s) |
| --- | ---: | ---: |
| mesa-ao-vivo.spec.ts | 8 | 185,7 |
| ajuda.spec.ts | 6 | 121,3 |
| a11y.spec.ts | 5 | 90,5 |
| escrita.spec.ts | 23 | 83,4 |
| extras.spec.ts | 21 | 71,3 |
| imagens.spec.ts | 6 | 51,3 |
| contas.spec.ts | 4 | 47,0 |
| compartilhar.spec.ts | 1 | 31,6 |
| rpg.spec.ts | 10 | 31,5 |
| oficina.spec.ts | 10 | 31,1 |
| livro.spec.ts | 7 | 30,9 |
| apresentacao.spec.ts | 4 | 28,2 |
| comunidade.spec.ts | 2 | 25,0 |
| treino.spec.ts | 4 | 24,6 |
| social.spec.ts | 2 | 22,6 |
| novidades.spec.ts | 6 | 21,8 |
| livro-atual.spec.ts | 6 | 19,8 |
| grafo.spec.ts | 5 | 18,7 |
| estante.spec.ts | 1 | 18,4 |
| leitor.spec.ts | 5 | 16,3 |
| fichas.spec.ts | 7 | 16,0 |
| mundo.spec.ts | 7 | 15,6 |
| au.spec.ts | 1 | 14,7 |
| um-personagem.spec.ts | 4 | 14,7 |
| tour.spec.ts | 3 | 14,6 |
| voltar.spec.ts | 4 | 13,9 |
| inicio.spec.ts | 5 | 13,7 |
| mundos.spec.ts | 4 | 12,9 |
| mestre-celular.spec.ts | 3 | 11,4 |
| codex-ao-vivo.spec.ts | 1 | 11,1 |
| jornadas.spec.ts | 2 | 11,0 |
| leitores-beta.spec.ts | 1 | 10,3 |
| wiki-link.spec.ts | 1 | 8,6 |
| entrar-por-email.spec.ts | 2 | 8,1 |
| universos-ajustes.spec.ts | 3 | 6,8 |
| espaco.spec.ts | 3 | 5,6 |
| atlas.spec.ts | 2 | 5,2 |
| celular.spec.ts | 2 | 4,3 |
| ferramentas.spec.ts | 2 | 4,2 |
| erro-por-tela.spec.ts | 1 | 3,6 |
| guia.spec.ts | 2 | 3,2 |
| lixeira.spec.ts | 1 | 3,2 |
| quem-e.spec.ts | 1 | 3,0 |
| comandos.spec.ts | 1 | 2,8 |

(O tempo é a soma das execuções de cada arquivo, que rodam em paralelo; o tempo de parede é bem menor.)

## Quando um teste for instável

Ache a causa antes de aumentar tempo de espera. O exemplo é o teste da escritora no celular (`jornadas.spec.ts`): o teclado "reabria" depois de fechar a Revisão e a barra de baixo sumia; a correção foi não devolver o foco ao texto em telas de toque, e o teste passou a conferir isso em vez de repetir o toque até pegar.
