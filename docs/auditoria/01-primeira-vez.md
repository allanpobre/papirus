# Auditoria 01 — Primeira vez

Navegador limpo (sem localStorage nem IndexedDB), Playwright com toque, 390×844 e 360×640 (e paisagem 844×390). Servidor local do Vite. Data: 20/11/2026.

## Funciona bem

- **Apresentação (`/`)**: sem rolagem lateral a 390 px; os botões "Começar a escrever" e "Começar a mestrar" levam ao app já no setor certo (Escrita ou Mesa).
- **Criar o primeiro universo**: 1 campo + 1 toque ("Criar universo"). A tela seguinte já ensina o próximo passo ("Começar a escrever").
- **Até a primeira frase**: 3 toques (Criar universo → Começar a escrever → tocar no texto) e já se digita. Cerca de 1,5 s da tela inicial até o texto aberto.
- **Nada se perde ao recarregar**: texto digitado e recarregado 50 ms, 400 ms, 1,5 s e 4 s depois voltou inteiro em todos os casos (editor `Texto da cena`).
- **Primeiros passos** (Início): "Escreva a primeira cena" aparece como "(feito)" depois da primeira frase; o Início passa a mostrar "10 palavras hoje", "1 dia seguido" e "Continuar escrevendo".
- **Passeio**: dá para pular ("Pular o tour" e o X), escolhe-se Rápido ou Completo, e o texto diz que dá para refazer pelo Início ou Ajustes. Passos de 360 px cabem na tela, sem balão cortado.
- **Giro e 360 px**: sem rolagem lateral nem a 360 px nem em paisagem.
- **Guia**: abre pelo Mais, com cada área e o texto dos passeios.
- **Mesa**: criar campanha leva a uma tela já pronta (sessão 1, sistema, grupo vazio com convite).

## Defeitos

Nenhum de gravidade alta ou média encontrado nesta rodada.

- *(baixa)* **O passeio não continua depois de recarregar.** Passos: Início › "Fazer o tour" › Rápido › avançar 2 passos › recarregar. O passeio some e `tourDone` continua falso; "Fazer o tour" segue nos Primeiros passos, então dá para recomeçar. Devia: ou retomar, ou ao menos não dar a impressão de que acabou. Arquivo provável: `src/shell/` (passeio) e `src/state/prefs.ts`.
- *(baixa)* **Passo "Buscar em tudo" cita "Ctrl K"** no celular, onde não há teclado. Arquivo provável: `src/shell/pageTours.ts`.

## Confuso ou difícil

- **O passeio não abre sozinho.** Quem chega e cria o universo cai direto no Início; o único convite é o botão "Fazer o tour" dentro de "Primeiros passos" (e o (?) no alto). Quem dispensa os Primeiros passos perde a pista de onde está o passeio (mas ele continua em Ajustes e no Mais › Guia).
- **"Rápido (1 minuto)" tem 13 passos; "Completo (uns 5 minutos)" tem 19.** A diferença é pequena e o "rápido" não é tão rápido.
- **O passeio é só da Escrita.** Não passa pela Mesa nem pelas oficinas do Mundo (idioma, panteão, poder…). Não testei o passeio *dentro* de uma campanha (ver "Não testado").
- **Mesa: o "Sistema do grupo" nasce como "Estilo Tormenta 20"** logo depois de criar a campanha, sem eu ter escolhido nada. Não confirmei qual opção do formulário estava marcada; vale conferir que o padrão é o que o usuário viu escolhido.
- **No editor, o primeiro campo é o título** ("Título (opcional)", um campo de texto comum). Quem toca "no começo da página" e digita pode achar que escreveu a cena. (Eu mesmo digitei ali por engano no primeiro teste.)
- **Rodapé da cena ("10 palavras · na cena")** fica abaixo da dobra a 390×844 com a barra de ferramentas no lugar; precisa rolar para ver.

## Pode mudar

- Abrir o passeio sozinho **uma vez**, como convite pequeno ("Quer um passeio de 1 minuto?"), com "Agora não" — o botão atual está escondido no meio de outros cartões.
- Fazer o "Rápido" ter ~6 passos (menu, Escrever, Mundo, Publicar, salvo sozinho, ajuda) para ser mesmo de um minuto.
- Trocar "Atalho: Ctrl K" por texto que valha no celular (ou mostrar só em tela larga).
- Nas campanhas, um passeio próprio (Preparar, Grupo, Codex, Regras).
- Tornar o título da cena menos parecido com o texto (ex.: linha mais discreta até receber foco) ou levar o foco direto para o texto ao abrir uma cena vazia.

## Consertado neste PR

Nada. Os defeitos acima são de gravidade baixa e preferi deixar para o resumo (23).

## Não testado

- Passeio *dentro* de uma campanha (Mesa) e o passeio de cada tela (o (?)).
- Teclado virtual aberto de verdade (Playwright não abre o teclado do celular).
- Primeira visita com internet lenta e instalação do app (PWA).
- Leitor de tela.
- Landing em 360 px com rolagem completa (só se conferiu rolagem lateral e os botões).
