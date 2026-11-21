# Auditoria 07 — Mundo: Linha do tempo

Playwright a 390×844, no Ostria, com toque simulado por CDP para arrastar. 20/11/2026.

## Funciona bem

- **Lista**: eventos por ano, com era, descrição e "quem e onde" ("Vaelor (31 anos), Ilsa (61 anos), Casa de Vaelor, em Ostria"). A idade é calculada no ano do evento.
- **Faixas**: abas Personagens, Reinos e grupos, Lugares, com uma faixa por ficha e um "Mundo" em cima, as eras coloridas e a linha da régua da história. A dica "Arraste um evento para o lado para mudar o ano. As setas vão da causa para a consequência (no evento, 'Causado por')" está no lugar certo.
- **Arrastar com o dedo (CDP)** funciona: "Nascimento de Vaelor: 310 DC → 370 DC" e aparece a barra "Desfazer"; tocar em Desfazer devolve a data original.
- **Máquina do tempo**: régua + botões −/+ + campo de ano. No ano 341: "Quem mandava: Cassian governa Ostria", "Quem vivia: Ilsa · 61 anos, Cassian · 36…", "O que existia", "Acontecendo: Era das Torres, A Queda…". Excelente vitrine.
- **Em Fichas**, com o ano ativo, aparece a faixa "No ano 341 DC · Sair do ano", o que evita ficar preso numa época sem saber.
- Sem rolagem lateral da página.

## Defeitos

Nenhum de gravidade alta ou média confirmado.

- *(baixa, a conferir)* **Com "No ano 341 DC" ligado, o seletor de Fichas continua escrevendo "Todas (17)"**, e a lista ainda traz fichas que só aparecem depois (por exemplo, "Homem Pálido" e "Mira"). O texto da Máquina do tempo promete "As Fichas e os Mapas também mostram só o que existia nele". Não consegui confirmar se a lista é filtrada (só a contagem não muda) ou se fichas sem data entram sempre. Vale repetir à mão.
- *(baixa)* **Arrastar 12 px move 60 anos** (310 → 370) no Ostria: a escala da faixa é muito grossa no celular; um toque curto pode mudar a data por décadas. O "Desfazer" salva, mas surpreende. Arquivo provável: `src/views/TimelineLanes.tsx`.
- *(baixa)* **Ao arrastar para depois do fim da régua, a régua cresce** (360 → 370 DC) sem aviso.

## Confuso ou difícil

- **A Máquina do tempo ocupa ~270 px** (um terço da tela) e empurra a Lista e as Faixas para baixo da dobra. Quem só quer ver os eventos precisa rolar.
- **O nome da aba** é "Tempo" no celular e "Linha do tempo" no resto (já está no CLAUDE.md, mas o título da tela diz "Linha do tempo").
- **"Faixas" não explica o que são** (uma faixa por pessoa/lugar) até se ver; o rótulo "Lista | Faixas" é bom, mas a primeira vez abre sem dica.
- **Um evento que o dedo arrasta e um que o dedo só quer abrir** são o mesmo alvo; no celular o toque curto vs. o arrasto precisa de cuidado.

## Pode mudar

- Recolher a Máquina do tempo num botão ("Ver o mundo num ano") até alguém tocar.
- Passos de arrasto em anos "redondos" (de 1, 5 ou 10, conforme o zoom) e uma bolha mostrando o ano durante o arrasto.
- Mostrar o aviso de "fora de ordem" no próprio evento arrastado, antes de soltar.
- Para quem não vai arrastar: botões "−1 ano / +1 ano" no evento aberto.

## Consertado neste PR

Nada.

## Não testado

- "Causado por" e o aviso de fora de ordem por uso; ligar e desligar causas.
- Eras (criar, colorir) e importância dos eventos; filtros por ficha, lugar e região.
- Calendário próprio (meses com nome) em Ajustes.
- As festas de todo ano na lista.
- Linha do tempo no Oz.
- O "Sair do ano" em Mapas e Ligações (só Fichas foi visto).
