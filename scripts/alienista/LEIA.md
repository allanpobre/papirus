# O Alienista no exemplo

O texto do universo de exemplo (`src/model/alienistaTexto.ts`) vem de "Papéis Avulsos" (1882), no
Project Gutenberg (ebook 57001), em domínio público. A grafia foi atualizada por `modernizar.py`:

1. Separa os 13 capítulos e junta as linhas de cada parágrafo.
2. Troca as formas antigas por regras (ph→f, th→t, chr→cr, y→i, consoantes dobradas, "lastimal-o"→"lastimá-lo"…)
   e escolhe, entre as candidatas, a palavra mais usada no português de hoje (lista de frequência).
3. Aplica as correções feitas à mão: `correcoes-palavras.json` (palavra a palavra) e
   `correcoes-trechos.json` (erros de digitalização e casos que dependem do contexto).
   Itálicos em latim ou italiano (_vis medicatrix_, _Plus ultra!_) ficam como estão.

Para refazer: baixe para uma pasta o texto (`https://www.gutenberg.org/cache/epub/57001/pg57001.txt`, recortado
de "O ALIENISTA" até antes de "THEORIA DO MEDALHÃO", como `raw.txt`), a lista de frequência
(`hermitdave/FrequencyWords`, `pt_br_full.txt`, como `freq.txt`) e a lista de palavras
(`pythonprobr/palavras`, `palavras.txt`); copie os dois JSON para lá e rode `python3 modernizar.py <pasta>`.
O resultado sai em `chapters.json`.
