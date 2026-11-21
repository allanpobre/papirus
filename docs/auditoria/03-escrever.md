# Auditoria 03 — Escrever

Playwright com toque a 390×844 e 360×740, no Oz (livro grande, 24 cenas só no livro 1) e em universo novo. 20/11/2026.

## Funciona bem

- **Procurar e trocar**: busca na cena com contagem ("1 de 3"), realce, "Trocar este" e "Trocar todos (3)", "Palavra inteira", "Maiúsculas iguais" e "No livro todo". Tudo cabe a 390 px.
- **Versões da cena**: guarda sozinha, compara ("Juntos" e "Lado a lado") e deixa voltar.
- **Estrutura**: modelo (Livre, Três atos, Save the Cat, Jornada), faixa de cenas, promessas plantadas e pagas, "Vale olhar" com atalho "Abrir cena". Bonita e clara a 390 px.
- **Segredos**: `[segredo]…[/segredo]` é aceito no texto; a Revisão mostra o trecho ao autor.
- **Digitar no capítulo grande**: cena de ~5.800 caracteres, 86 teclas em 1,3 s (≈15 ms por tecla, com o automatizador), sem engasgo visível.
- **Nada se perde**: texto recarregado 50 ms depois de digitar voltou inteiro (ver 01).
- Barra acima do teclado com travessão, negrito, itálico, citação, separador, imagem, nomes novos, desfazer, refazer e "Fechar o teclado".
- Modo foco esconde o resto e deixa só o texto e o contador.

## Defeitos

1. **(média/alta no celular) A janela "Revisão" (nomes novos) era mais larga que a tela.** Passos: Escrever, digitar dois ou três nomes, tocar "N nomes novos". Resultado: janela com 424 px em tela de 390 ou 360; o **X de fechar ficava fora da tela** e as abas "Perguntas" e "Pendências" saíam cortadas. Devia caber. Causa: a janela é item de uma grade e crescia com o conteúdo. **Consertado neste PR** (`.overlay > .modal { min-width: 0 }` em `src/styles/base.css`; vale para todas as janelas).
2. *(baixa)* **Nome colado à frase anterior.** Num texto com um trecho secreto antes — `… [/segredo] Depois Kael partiu.` — a Revisão sugeriu a ficha **"Depois Kael"** (e não "Kael"). Sem o trecho secreto, o mesmo texto dá "Kael". Parece que a etiqueta `[/segredo]` atrapalha o começo de frase. Arquivo provável: `src/logic/` (detecção de nomes).

## Confuso ou difícil

- **"24 cenas · 24 sem cartão"** na Estrutura: "cartão" é jargão; ninguém sabe o que é.
- **Na Estrutura, a lista de botões "Abrir cena"** e as marcas "Melhor / Pior / Igual / Sem marca" pedem explicação; o passeio ajuda, mas a legenda sozinha não diz "marque como a cena termina".
- **Revisão (aba) e janela "Revisão"** têm o mesmo nome para coisas diferentes: a aba mostra o texto com margem; a janela lista nomes novos.
- **Menu "Mais ações da cena"** tem 8 itens sem separação (Aa, Detalhes, Foco, Procurar, Versões, Ler, Exportar, Apagar). "Apagar cena" fica junto das outras, no fim da lista.
- O contador "12 palavras · Hoje: 12 · Sprint" está bem, mas "Sprint" sozinho não explica o que é.

## Pode mudar

- Pôr "Apagar cena" separado e em vermelho, com confirmação visível.
- Trocar "sem cartão" por "sem marca de como termina".
- Chamar a janela de "Nomes novos" e deixar "Revisão" só para a aba.
- Mostrar no topo do Escrever qual livro/filtro está ativo.

## Consertado neste PR

- **Janela maior que a tela** (defeito 1): teste `e2e/janela-cabe.spec.ts` (falha antes, passa depois, a 390 px).

## Não testado

- Criar, mover, renomear e apagar capítulos pela Estrutura com arraste (só li a tela).
- Teclado virtual de verdade (altura útil de texto com o teclado aberto).
- Revelações, régua da história, Sprint e bilhete para amanhã por uso completo.
- Desempenho de digitação com CPU 4× mais lenta (fica para o 19).
- Criar ficha a partir da Revisão (só vi a lista de candidatos).
