# Auditoria 19 — Desempenho no celular fraco

`vite build` + `vite preview` (não o servidor de desenvolvimento), 390×844 com toque, **CPU 4× mais lenta** (`Emulation.setCPUThrottlingRate`), rede sem limite (o `localhost` não mede internet lenta). Exemplo Oz (74 fichas, 3 livros) salvo onde indicado. Cada tempo é de uma única medição (sem média), do toque até o conteúdo da tela aparecer. 20/11/2026.

## Tamanho do build

- **Para abrir o app (o que o `index.html` baixa): 33 arquivos, 1,26 MB, 360 kB comprimidos.** Os maiores: `app` (JS) 352 kB, `app` (CSS) 358 kB, `themes` 221 kB, `schema` 104 kB, `PageTour` 69 kB.
- **Todo o JS do build:** 4,1 MB em 153 arquivos (carregados sob demanda). Os maiores, fora da abertura: `pagedDocument` (diagramação) 506 kB, `extensions` (editor) 390 kB, `sdk` (nuvem) 367 kB, `ozTexto` (texto do exemplo) 213 kB, `RpgView` 197 kB, `EntitiesView` 191 kB, `WriteView` 160 kB.

## Tabela de tempos (CPU 4×)

| O que | Tempo |
|---|---|
| Abrir o app no Oz (até o Início aparecer) | **2,2 s** |
| Abrir **Mundo** (lista de 74 fichas) | **1,8 s** |
| Abrir **Estrutura** (Escrever › Estrutura) | **1,5 s** |
| Abrir **Escrever** (até o editor) | **1,4 s** |
| **Rolar no mundo** (abrir a janela e rolar um boato, no Ostria) | **1,2 s** |
| Linha do tempo (Oz) | 1,1 s |
| Ligações (grafo, Oz) | 1,0 s |
| Mesa | 0,68 s |
| Diagramar (criar o livro e abrir a janela, Ostria) | 0,65 s |
| Publicar (Ostria) | 0,50 s |
| Mapas | 0,51 s |
| Trama | 0,46 s |
| Ler (prévia do livro) | 0,31 s |
| **Faixas** da Linha do tempo (Ostria) | **0,14 s** |
| **Digitar** 60 teclas no capítulo grande do Oz | **2,4 s (≈ 40 ms por tecla)** |

## As 5 piores, e a causa provável

1. **Digitar no capítulo grande (≈ 40 ms por tecla).** Dá uma sensação de "peso" a cada letra. Causa provável: a cada tecla o app recalcula coisas sobre o texto (nomes novos, menções, contagem de palavras, régua). Vale medir com o perfilador do navegador antes de mexer.
2. **Abrir o app (2,2 s).** São 33 arquivos antes de qualquer tela e 358 kB de CSS que bloqueia a primeira pintura; `themes` (221 kB) e `schema` (104 kB) entram na abertura. Parte disso poderia vir depois (`themes`, `PageTour`).
3. **Mundo com 74 fichas (1,8 s).** A lista desenha todas as 74 linhas de uma vez (sem lista virtual) e o `EntitiesView` é um arquivo grande (191 kB).
4. **Estrutura (1,5 s) e Escrever (1,4 s).** Carregam o editor (`WriteView` 160 kB + `extensions` 390 kB) e, na Estrutura, a faixa de cenas e as promessas.
5. **"Rolar no mundo" (1,2 s)** para uma janela pequena: provavelmente o pedaço de código da janela e das tabelas é baixado só nesse toque. Mais lento do que parece justo para o que faz.

## Funciona bem

- Telas pequenas (Trama, Mapas, Publicar, Mesa) abrem em menos de 0,7 s mesmo com CPU 4× mais lenta.
- A Linha do tempo em **Faixas** abre em 0,14 s.
- O **combate de 15** (spec existente): cerca de 0,35 s por vez; aplicar dano 1,8 s (ver 11).
- Nenhum erro de página durante as medições.

## Defeitos

Nenhum de gravidade alta. Os itens acima são de **desempenho**, não quebram nada.

## Pode mudar (só anotado, sem otimizar)

- Perfilar a digitação no Oz (React Profiler) e adiar o que não precisa rodar a cada tecla.
- Tirar `themes` e o texto dos passeios da abertura (carregar na primeira vez que se usa).
- Lista virtual (só as linhas visíveis) no Mundo com mais de 50 fichas.
- Separar a janela "Rolar no mundo" das tabelas pesadas.
- O CSS de 358 kB poderia ser dividido por área.

## Consertado neste PR

Nada.

## Não testado

- Rede lenta (3G) e primeira visita sem cache; só medi com tudo local.
- Memória e bateria; celular de verdade (o 4× é uma aproximação).
- Tempos médios de várias execuções (cada número é de uma medição).
- Abrir o app já instalado (com o service worker) e com a janela em segundo plano.
- Arrastar as Faixas, o grafo e o mapa (só medi a abertura).
