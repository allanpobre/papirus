# Auditoria 09 — As 7 oficinas do mundo

Playwright a 390×844, no Ostria e em universo vazio. Foi uma passada curta: **Rolar no mundo** foi usado a fundo; Panteão e Poder foram só localizados; Língua e Oficina da cultura **não** foram exercitadas (ver o fim). 20/11/2026.

## Funciona bem

- **Rolar no mundo — fácil de achar**: botão "Rolar no mundo" no alto do Mundo (ao lado de "Wiki"), na lista de Fichas.
- **Rolar no mundo — entende-se em 10 segundos**: janela com 6 tabelas (Boato, Encontro na estrada, Nome de taverna, Segredo, Clima do dia, Festa local), um dado grande "Rolar", e o resultado num cartão com **Virar pista**, **Virar ideia** e **Rolar de novo**. Mais um histórico dos últimos resultados.
- **Usa o mundo**: no Ostria saem lugares, personagens e grupos reais ("Mira guarda um mapa…", "Névoa grossa até o meio-dia em Vale das Brumas") e **a tabela da Mesa aparece junto** ("Rumores do porto (sua)"), como pedido.
- **Universo vazio**: a janela abre e explica "Sorteia a partir do que já existe em 'Oficinas'" mesmo sem fichas; as tabelas usam palavras genéricas (longe, as montanhas…).
- **Panteão e Poder e tensões** aparecem na leitura de uma Religião ("Fé da Maré": Panteão e Poder e tensões). "Poder e tensões" aparece também em Reino, Casa e Lugar.
- Ao rolar 4 vezes cada tabela, **nenhum segredo** do Ostria (`canon: secreto`) apareceu nos resultados.

## Defeitos

1. *(média, texto)* **"O Gole de as montanhas"**: nas frases prontas, o artigo fica separado da preposição (de + as). **Consertado neste PR** (função `contract` em `src/logic/worldRolls.ts`: "de as"→"das", "em o"→"no", "a as"→"às", "de a"→"da"…), com teste de unidade.
2. *(baixa, texto)* **Nomes de ficha sem artigo dentro de frases**: "A Porta de Reino de Ostria", "Mira deve dinheiro a Reino de Ostria", "Uma carroça tombada de Casa de Vaelor", "Em Paço do Regente", "Em Torre de Marfim". O nome da ficha (sem "o/a") quebra a frase. Não dá para saber o gênero do nome sem um campo; o certo é só reescrever as frases para caber qualquer nome ("…em {lugar}" → "…, em {lugar}" funciona com ou sem artigo) ou deixar o autor marcar o artigo na ficha. Arquivo: `src/logic/worldRolls.ts` (tabelas) — não mexi, é mudança de conteúdo.
3. *(baixa)* **Resultados repetidos com poucas entradas**: "Névoa grossa até o meio-dia" saiu 3 vezes em 4 rolagens; "Alguém está comprando vidro negro" 2 em 4 (tabela da Mesa de 3 linhas). Falta evitar repetir o último resultado.

## Confuso ou difícil

- **Língua e Oficina da cultura só aparecem na ficha do tipo Cultura**; numa ficha de "Povo" (como "Winkies", no Oz) não há nenhum sinal delas. Quem cria um povo não descobre que existe uma ferramenta de língua.
- **O texto de ajuda no pé do "Rolar no mundo"** ("{lugar}, {personagem}, {povo}…") é técnico demais para quem não faz tabelas; só importa para quem vai criar a sua.
- **O histórico no pé** repete o resultado de cima (o mesmo texto aparece no cartão e na lista).
- **"Virar pista"** não diz onde a pista vai parar (Trama › Pistas e mistérios); o "Virar ideia" idem (Ideias).

## Pode mudar

- "Rolar de novo" não repetir o resultado anterior.
- Mostrar, na ficha de Povo, uma linha "Dar uma língua a este povo" que cria/abre a Cultura.
- Depois de "Virar pista", um aviso com atalho: "Pista criada. Ver na Trama".
- Frases das tabelas escritas para servir a qualquer nome (sem artigo).

## Consertado neste PR

- **"de as montanhas"** (defeito 1): `contract()` com testes em `src/logic/worldRolls.test.ts` (as frases com "de as/em o/a as/de a" viram "das/no/às/da").

## Não testado

- **Língua** (criar sons, dicionário, frase traduzida) e **Oficina da cultura** ("Um dia na vida", festas): não consegui criar uma ficha de Cultura pelo roteiro de teste; ficam para a rodada 15 ou 22.
- **Panteão** e **Poder e tensões**: só localizei; não montei um panteão nem mudei tensões.
- **Continente** e **rotas**: vistos no 08; **Faixas**: vistas no 07.
- Textos gerados de "Um dia na vida" e nomes na língua do povo.
- Se as pistas criadas aparecem na Trama e as fichas, na wiki.
