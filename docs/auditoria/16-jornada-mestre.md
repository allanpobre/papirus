# Auditoria 16 — Jornada do mestre

Num navegador limpo, a 390×844 com toque. O roteiro virou `e2e/jornada-mestre.spec.ts` (passa, 9 s). **Toques acumulados** (sem contar o digitar): 20/11/2026.

| Etapa | O que se faz | Toques acumulados |
|---|---|---|
| 1 | Apresentação → Começar a mestrar → nome → Criar campanha | 2 |
| 2 | Mais › Início › Plantar a semente › "Um império" › Plantar | 7 |
| 3 | Mesa › Preparar › trocar o sistema › Grupo › 3 personagens (cada um: Criar personagem + Voltar para a lista) | 16 |
| 4 | Mundo › Rolar no mundo › Boato › Rolar › Virar pista | 21 |
| 5 | Mapas › Gerar › marcar 2 lugares › Rota › tocar nos 2 pinos | 26 |
| 6 | Mesa › Preparar › Começar agora › Começar a jogar | 30 |
| 7 | Encerrar sessão › Encerrar › resumo e ano › Fechar | **33** |

**33 toques** da campanha ao fim da sessão 1.

## Funciona bem

- **Campanha → Semente → grupo → sessão sem becos sem saída.**
- **A Semente** pede poucas coisas (tipo de mundo, ameaça opcional) e logo mostra "O que falta no mundo".
- **Rolar no mundo** vira pista em 1 toque ("Virar pista"), e a pista vai para a Trama.
- **Rota entre dois lugares**: "Ligando…", "De A: agora toque no outro lugar", e o cartão mostra "2,3 dias a pé · 22 horas a cavalo" com tipos Estrada/Trilha/Rio/Mar e o campo "Dias a pé". O tempo de viagem aparece como "2,3 d" sobre a linha.
- **Lugar novo direto do mapa**: tocar no mapa, digitar o nome e dar Enter cria o lugar (ficha) e põe o marcador num passo só.
- **Fim da sessão**: resumo, "Ano no mundo" e a escolha de publicar no diário do Codex (desligado, "Só você vê").

## Defeitos

Nenhum encontrado.

- *(baixa)* **Cada personagem novo abre a ficha de jogo cheia** (atributos, ataques, perícias) e é preciso "Voltar para a lista" para criar o próximo: 2 toques por personagem, 6 para o grupo. Para um grupo de 3 a 5, é o passo mais caro da jornada. Arquivo provável: `src/views/rpg/`.

## Confuso ou difícil

- **A campanha já nasce com um sistema ("Estilo Tormenta 20")**, que a pessoa não escolheu (explica a surpresa do 01). Trocar é um toque numa lista de 8 opções, e "Novo: estilo …" aparece como opção da mesma lista, o que mistura "escolher" e "criar".
- **A Semente fica no Início, mas a campanha abre na Mesa**: quem mestra só chega à Semente indo a Mais › Início (2 toques), longe da primeira tela.
- **"Plantar a semente" e "Rolar no mundo"** são duas ideias para "inventar o mundo": uma cria as primeiras fichas, outra sorteia ideias. A diferença só se entende lendo.
- **O ano no mundo** é uma caixa vazia no fim da sessão: não diz qual foi o ano da sessão anterior nem sugere um.

## Pode mudar

- "Criar personagem" e **continuar na lista** (ou "Criar e fazer outro", como na ficha do Mundo).
- Atalho "Plantar a semente" dentro da Mesa vazia.
- Sugerir o ano da última sessão (ou o ano atual do mundo) no fim da sessão.
- Separar "Escolher o sistema" de "Criar um sistema novo".

## Consertado neste PR

Nada no app. O teste novo é a jornada.

## Não testado

- **O celular do jogador** durante a jornada (segundo contexto com link do grupo): fica com a spec `jogador-celular`, que já existe e passa (11).
- Se o ano do fim da sessão aparece na Linha do tempo e no "Aparece em" das fichas (só preenchi o campo).
- Criar um sistema do zero e editar atributos (a jornada só troca o sistema).
- Aviso de viagem rápida do "Caminho de" com a história (só a rota e os dias).
- Combate, rolagens e Codex ao vivo.
