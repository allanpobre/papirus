# Auditoria 11 — Mesa (RPG)

Playwright a 390×844, no Oz (grupo "Grupo de sábado", 3 jogadores). Mais as specs que já existem (combate de 15, celular do jogador, bestiário) rodadas de novo: **7 testes passaram**. 20/11/2026.

## Funciona bem

- **Preparar**: "Próxima sessão" em destaque (título, data, o que acontece primeiro) com "Começar agora" e "Abrir sessão"; "Sistema do grupo" (D&D, Tormenta, Ordem Paranormal, Call of Cthulhu, parada de dados, narrativo) com resumo ("6 atributos, 2 recursos, 18 perícias. Iniciativa: 1d20+{mod:DES}"); grupo de jogadores com PV.
- **Ficha de jogo** (Bolt): CA, PV, atributos "toque para rolar", ataques, poderes, perícias (Treinadas/Todas), inventário. Cabe em 390 px.
- **Codex**: "Só entra no Codex o que você revelar. Trechos marcados como segredo nas fichas nunca aparecem." Cada ficha com "Só o nome / Resumo / Tudo" e a sessão em que foi revelada.
- **Regras**: modificador dos atributos, como ler uma rolagem, fórmulas, "Dados e tabelas". Em português claro (embora técnico por natureza).
- **Começar a sessão**: tela de capa com "Na última sessão" (resumo da anterior) e "Quem joga hoje" (Joga / Mestre conduz / Fica de fora, por jogador), com botão fixo "Começar a jogar". Excelente.
- **Palco**: cena atual, relógio, "Combate!" com três modos (Clássica, Por lados, Pipoca), e abas Roteiro / Palco / Grupo.
- **Encerrar sessão**: pergunta antes ("Encerrar a sessão?"), depois a tela "Fim da sessão" com duração, rolagens, notas, revelações, "O que aconteceu?", "Publicar no diário do Codex" (desligado por padrão, "Só você vê, até publicar") e "Ano no mundo". Entra no "Aparece em" e na Linha do tempo.
- **Desempenho do combate de 15, CPU 4× mais lenta**: passar a vez ≈ 350 ms; desfazer ≈ 350 ms; condição ≈ 390 ms.
- Celular do jogador a 360 px e "sem internet" (spec existente): passam.
- Sem rolagem lateral em nenhuma das telas vistas.

## Defeitos

Nenhum de gravidade alta ou média.

- *(baixa)* **O número de "Revelações" no Fim da sessão pareceu errado**: "4" numa sessão de menos de 1 minuto em que não revelei nada. Possivelmente conta as revelações já feitas na campanha (e não as desta sessão). Conferir. Arquivo provável: `src/views/rpg/` (resumo da sessão).
- *(baixa)* **O título da sessão no topo é cortado** ("A estrada para o Oes…") quando o relógio e o botão ocupam a linha. Arquivo provável: CSS do modo sessão.
- *(baixa, desempenho)* **Aplicar dano num combate de 15 com CPU 4× mais lenta leva ~1,8 s** (as outras ações, ~0,35 s). Medido pela spec `combate-grande`.

## Confuso ou difícil

- **A confirmação de "Encerrar a sessão?"** aparece como um balão vermelho apertado no canto, ao lado dos outros botões; fácil de perder ou tocar no lugar errado.
- **"Sessão" não tem como voltar do "Palco" sem encerrar**: a seta/abas são Roteiro, Palco, Grupo; sair para a Preparar exige "Mais da sessão"? Não vi outro caminho.
- **"Sistema do grupo"** lista "+ Novo: estilo …" seis vezes; para quem só quer trocar de sistema é muita lista.
- **Tabelas da Mesa** e "Rolar no mundo" são dois lugares; o "Rolar no mundo" cita "Mesa › Tabelas", mas a Mesa não deixa óbvio que a tabela aparece lá (ver 09: aparece).

## Pode mudar

- Mostrar "Ano no mundo" já preenchido com o ano da última sessão (+1 dia/mês?).
- No Fim da sessão, "Revelações" abrir a lista do que foi revelado.
- Dar mais espaço ao título da sessão (relógio menor, ou título em duas linhas).
- Transformar a confirmação de encerrar em janela de baixo ("Encerrar sessão? [Encerrar] [Continuar]").

## Consertado neste PR

Nada.

## Não testado

- Rolagens (tocar num atributo) e tabelas próprias; criar um sistema e 3 fichas de jogo do zero (o roteiro 16 faz isso).
- Combate com muitos inimigos por uso manual (só a spec existente) e o bestiário (spec existente passou, não conferi à mão).
- Celular do jogador e o canal ao vivo em dois contextos reais (só as specs existentes).
- Bônus de espécie e cultura na ficha de jogo; temas da mesa.
- "Publicar no diário do Codex" e o que o jogador vê.
