# Auditoria 08 — Mundo: Mapas

Playwright a 390×844, no Ostria (mapa com 5 lugares e 4 rotas). 20/11/2026.

## Funciona bem

- **Gerar**: um toque cria "Continente" com costa, rios, montanhas e florestas, e avisa "Continente gerado. Marque os lugares por cima." com botão **Outro** para sortear de novo. Fica bonito.
- **Rota**: "Rota" vira "Ligando…" com a instrução "Toque no primeiro lugar da rota." e "Cancelar". Simples de entender.
- **Pintar região**: "De quem é esta região?" + "Cancelar".
- **Barra do mapa**: Marcar lugar, Rota, Pintar região, e um "Mais/Menos" que abre zoom (− 100% +), "Rotas" (liga/desliga), "Caminho de" (escolhe um personagem) e "Apagar mapa".
- **Dias de viagem** aparecem nas rotas ("0,6 d", "0,9 d"), com estradas e trilha em estilos diferentes.
- Sem rolagem lateral da página.

## Defeitos

Nenhum de gravidade alta encontrado.

- *(baixa)* **Rótulos que se cobrem no mapa do Ostria**: "Paço do Regente" é cortado pelo pino ("Paço do Regente" com o pino em cima do "e"); "Taverna do Anzo" perde o "l"; o "0,6 d" fica em cima de "Ostria" e o "0,9 d" encosta em "Torre de Marfim". Em 390 px, com 5 lugares, já se atrapalham. Arquivo provável: `src/views/AtlasView.tsx` (rótulos) e CSS do atlas.
- *(baixa)* **Dois botões chamados "Mais" na mesma tela**: o da barra de baixo (menu do app) e o da barra do mapa. Para um leitor de tela (e para testes) são o mesmo nome.

## Confuso ou difícil

- **O mapa ocupa só ~250 px** de altura e o resto da tela fica vazio embaixo (~200 px). Dava para ser mais alto.
- **A barra do mapa tem 3 linhas** de controles (nome do mapa e "Marcar lugar"; "Rota", "Pintar região", "Mais"; zoom, "Rotas", "Caminho de", "Apagar mapa") antes do mapa. No celular o mapa começa em y≈370.
- **"Rotas" e "Caminho de"** estão no meio de "Mais" e não parecem camadas. As outras camadas (fronteiras, povos, crenças, tensões) não apareceram neste mapa: não ficou claro se só surgem quando há regiões ou onde se ligam.
- **"Mais/Menos" muda de nome** ("Menos" quando aberto) e não diz o que esconde.
- **"Gerar" fica longe do "Adicionar mapa"** (segunda linha), embora sejam duas formas de começar um mapa.

## Pode mudar

- Evitar cobrir rótulos: afastar o texto do pino ou mostrar o nome só do lugar tocado quando há mais de 4 lugares.
- Tirar os dias de viagem das rotas quando o zoom é pequeno e mostrar na gaveta.
- Dar mais altura ao mapa (usar a tela inteira até a barra de baixo) e esconder os controles atrás de um botão.
- Juntar "Adicionar mapa" e "Gerar" num só menu "Novo mapa".

## Consertado neste PR

Nada.

## Não testado

- Enviar imagem com recorte e o pergaminho em branco.
- Marcar, mover e tirar lugares pelo toque; criar uma rota de verdade e apagá-la; o "Caminho de" com aviso de viagem rápida.
- Camadas (fronteiras, povos, crenças, tensões) e pintar regiões com anos (Máquina do tempo).
- Aproximar com dois dedos.
- A gaveta do lugar na Nova cara.
