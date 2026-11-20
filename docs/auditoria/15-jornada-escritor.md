# Auditoria 15 — Jornada do escritor

Num navegador limpo, a 390×844 com toque, o roteiro inteiro virou `e2e/jornada-escritor.spec.ts` (passa, 24 s). Contagem de **toques acumulados** (sem contar o digitar): 20/11/2026.

| Etapa | O que se faz | Toques acumulados |
|---|---|---|
| 1 | Apresentação → Começar a escrever → nome → Criar universo | 2 |
| 2 | Escrever 3 cenas (Começar a escrever, tocar no texto, "Nova cena depois desta" ×2) | 8 |
| 3 | Revisão: "Todo o manuscrito" e Criar ficha de Kaya, Brenn e Ostria | 14 |
| 4 | Mundo › Mapas › Gerar › Marcar lugar › tocar no mapa › escolher Ostria | 19 |
| 5 | Nova ficha (Cultura "Gente do Sal") › Língua › sílabas › Pessoas | 24 |
| 6 | Voltar ao Escrever e marcar um segredo na última cena | 26 |
| 7 | Fechar o teclado › Mais › Publicar › Criar o livro › Fantasia › Fechar | 32 |
| 8 | Baixar › Wiki do mundo › Baixar a wiki (o segredo não vai junto) | **35** |

**35 toques** do zero até a wiki baixada. A espec garante o teto de 45 toques.

## Funciona bem

- A jornada inteira fecha **sem becos sem saída**: cada passo tem um botão claro para o próximo.
- **Do nome do universo à primeira ficha: 14 toques**, incluindo 3 cenas escritas e 3 fichas criadas pela Revisão ("Todo o manuscrito" cria os três nomes de uma vez).
- **Lugar no mapa em 5 toques** (Gerar + Marcar lugar + tocar + escolher): mesmo sem imagem de mapa, o continente gerado serve de base.
- **O segredo não sai na wiki**: depois de marcar `[segredo]…[/segredo]` na última cena, a wiki baixada não contém a frase (mas contém "Kaya").
- Passos 7 e 8: o Publicar leva a um roteiro numerado e o "Baixar" já tem a opção "Wiki do mundo".

## Defeitos

1. *(baixa, só em automação?)* **Digitar logo depois de abrir uma cena nova pode perder o resto do texto.** Com o toque e a escrita em 0 ms de espera, o texto da cena 2 ficou só "Kaya" e o da cena 3 só "No" (o resto sumiu). Com uma espera de 500 ms funciona sempre; no uso manual (toque + 250 ms) também. Parece uma corrida: o editor da cena nova é preenchido de novo (vazio) logo depois de abrir. Uma pessoa dificilmente digita em menos de 100 ms, mas num celular lento pode acontecer. Arquivo provável: `src/views/` (editor de cena, ao trocar de cena).
2. *(baixa, texto)* **"Clique no mapa…"** aparece no celular depois de "Marcar lugar" (devia dizer "Toque"). Arquivo provável: `src/views/AtlasView.tsx`.

## Confuso ou difícil

- **Com o teclado aberto a barra de baixo some.** Para ir de Escrever a Publicar é preciso tocar em "Fechar o teclado" antes (1 toque a mais) e ainda "Mais › Publicar" (Publicar não está na barra de baixo no Escrever). O caminho Escrever → Publicar leva 4 toques.
- **Marcar um segredo exige digitar `[segredo]…[/segredo]`.** Na barra acima do teclado não há botão "Segredo" (só Travessão, Negrito, Itálico, Citação, Separador, Imagem, Imagem); quem não sabe a marca não descobre. A barra que aparece ao selecionar um trecho cita criar ficha, guardar um fato e comentar, mas não vi "Segredo" ali.
- **Nova ficha** é uma janela no celular (Nome, Tipo, "Criar e abrir", "Criar e fazer outra") e uma linha na tela larga: o caminho é diferente conforme o aparelho.
- **Língua do povo** só aparece depois de criar uma ficha do tipo **Cultura**; quem cria um "Povo" não vê o caminho (ver 09).
- **Criar ficha pela Revisão** é ótimo, mas o botão que abre a Revisão é só um número com um ícone ("3") na barra do teclado.

## Pode mudar

- Botão "Segredo" na barra acima do teclado (ou na barra da seleção).
- "Publicar" mais perto da Escrita (um atalho no fim do capítulo, "Montar o livro").
- Trocar "Clique" por "Toque" nos textos do mapa.
- Esperar o editor da cena nova ficar pronto antes de aceitar texto (ou guardar o texto digitado antes do refresh).

## Consertado neste PR

Nada no app. O teste novo é a jornada.

## Não testado

- Escrever com teclado virtual de verdade.
- A jornada com Nova cara ligada.
- Se as fichas criadas pela Revisão aparecem no livro e na wiki com o texto das cenas (só conferi que "Kaya" está na wiki).
- Baixar o EPUB/.docx (feito no 10).
- Se a língua do povo muda os nomes sugeridos em Nova ficha na mesma jornada.
