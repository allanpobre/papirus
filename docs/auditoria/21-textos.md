# Auditoria 21 — Textos e nomes da interface

Leitura por código dos passeios (`src/shell/pageTours.ts`, 320 textos), do "O que mudou" e do Guia, mais o que apareceu nas telas durante as outras auditorias. **Não li todos os `.tsx` linha por linha**: usei buscas por palavra e a conferência de cada botão citado nos passeios. 20/11/2026.

## Funciona bem

- **Os passeios batem com as telas.** Peguei os 100 trechos entre “aspas” dos passeios (nomes de botões e partes) e procurei cada um nas telas: 98 existem; os 2 restantes são exemplos de texto, não botões (“cena 3 de 8” e “Incluir fica em”, que existe como “Incluir ‘fica em’” com aspas retas). **Nenhum passeio cita botão que sumiu.**
- Linguagem **simples e direta**: "Nada é apagado", "Nada vira ficha sozinho", "Sem conta, tudo fica neste navegador", "Só você vê, até publicar".
- Os erros usam **frases com saída** ("Este link de leitura foi desligado ou trocado. Peça um novo a quem compartilhou.").
- Maiúsculas e acentos corretos nos textos que li; achei só erros de **concordância automática** em frases geradas (tratadas no 09 e 13).

## Defeitos (texto)

1. **"Clique no mapa…"** (botão de marcar lugar, no celular). **Corrigido neste PR → "Toque no mapa…"**.
2. **"24 cenas · 24 sem cartão"** na Estrutura: "cartão" é jargão interno (a cena sem "o que quer / o que atrapalha / como termina"). **Corrigido neste PR → "sem planejar"**.
3. *(já corrigidos em PRs anteriores desta rodada)* "1 conceitos" na importação (13) e "O Gole de as montanhas" no Rolar no mundo (09).
4. *(baixa)* **Passo "Buscar em tudo" cita "Ctrl K"** — no celular não há teclado (já visto no 01). Não mexi: serve ao computador.

## Confuso ou difícil

- **O mesmo nome para coisas diferentes:**
  - **"Revisão"**: a aba do Escrever (texto com margem) e a janela de nomes novos.
  - **"Mais"**: o menu da barra de baixo e o "Mais" da barra do mapa.
  - **"Ligações"** aparece 4 vezes no alto da tela de Ligações (parte, título, aba, faixa).
  - **"Wiki"**: página, link para mandar, arquivo para baixar e o botão "Wiki" no alto do Mundo.
  - **"Baixar"**: no alto do livro e no passo 5 do Publicar (mesmo menu).
- **Nomes diferentes para a mesma coisa:**
  - **Tempo / Linha do tempo** (celular × resto).
  - **Trama / História** e **Início / Menu**: com a Nova cara os nomes da barra de baixo mudam (ver 17); o passeio e o Guia continuam com os nomes antigos.
  - **Snapshots** em Ajustes › Dados e backup, e "versões" nas cenas, e "versão guardada" nos universos duplicados: três nomes para "uma cópia guardada no tempo".
  - **"Dupla" local/nuvem** (jargão) × "cópia neste aparelho" (ver 12).
  - **"Pedir para manter"** (Ajustes › Dados) sem explicação.
  - **"Quase" / "Rascunho"** ao lado do nome da ficha: o que é? (ver 05).
- **Textos longos para o celular:** o maior corpo de passeio tem **593 caracteres** (bestiário, com exemplo de "3 goblins numerados"), depois 414 (vários livros) e 361 (Trama). Num balão de 390 px, mais de ~300 caracteres obrigam a rolar dentro do balão. Dos 320 textos, os 3 acima passam de 350.
- **Termos de RPG sem explicação** no meio de telas de quem escreve: "Codex", "Sprint", "Arquivista" (ferramenta que perguntas ao mundo), "AU". Os passeios os explicam, mas a tela sozinha não.
- **Datas "20 de novembro" repetidas** no "O que mudou" (ver 02): não ajudam a ver o que é novo.

## Pode mudar

- Uma lista única de nomes (um "dicionário da interface") e um teste que confira que passeio, Guia e telas usam os mesmos nomes, também na Nova cara.
- Encurtar os 3 passeios mais longos e quebrar em dois passos.
- Trocar "Snapshots" por "Cópias guardadas" e unir os três nomes de versão.
- Dar ao "Pedir para manter" uma frase: "Evita que o navegador apague seus dados".

## Consertado neste PR

- **"Clique no mapa…" → "Toque no mapa…"** (`AtlasView.tsx`).
- **"sem cartão" → "sem planejar"** (`OrganizeView.tsx`).
- Teste: `e2e/textos-simples.spec.ts` (390 px; os textos novos aparecem e "sem cartão" não).

## Não testado

- Leitura completa de todos os `.tsx`, `Guia` e "O que mudou" linha por linha; achei por busca e conferência dos botões citados.
- **Erros de português** além dos que apareceram em uso: não rodei corretor ortográfico.
- Mensagens de erro em situações raras (quota do disco, nuvem fora do ar).
- Textos da apresentação (`/`) e da Comunidade.
