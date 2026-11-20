# Auditoria 06 — Mundo: Ligações e grafo

Playwright (toque e CDP) a 390×844, no Ostria (17 fichas) e no Oz (74 fichas, centenas de ligações). 20/11/2026.

## Funciona bem

- **Abrir o grafo** leva ~1,5 s no Oz e no Ostria (CPU normal) e já aparece com os nós coloridos por tipo, com a inicial dentro.
- **Tocar num nó** (o "D" de Dorothy, com `touchscreen.tap`): o nó cresce, as ligações dele ficam fortes com a frase escrita sobre cada linha ("sobrinha de", "cachorro de", "amigo de"…), o resto esmaece, e **sobe um cartão embaixo** com tipo, nome, resumo e as ligações em frase. Muito bom para o celular.
- **Arrastar com o dedo** (CDP, 8 passos) move a vista; os botões Aproximar, Afastar e Enquadrar existem no canto.
- **Filtros** por tipo (Reinos e planos, Lugares, Povo, Feito de, Espécies, Facções, Artefatos, Magia, Lendas, Personagens), "Achar ficha", "Num ponto da história" e "Árvore da família" no topo. Os nomes são simples.
- Convite claro: "Algumas ligações mudam ao longo da história. Ver cena a cena".
- Sem rolagem lateral da página.

## Defeitos

Nenhum de gravidade alta ou média encontrado.

- *(baixa)* **O toque num nó funciona na bolinha, não no nome.** O "alvo" do nó (o grupo `g`) mede 93×63 px, mas tocar no centro dele (onde fica o texto) não abre nada; só a bolinha (≈ 30 px) responde. O alvo visível é pequeno para um dedo (abaixo de 44 px). Arquivo provável: `src/views/GraphView*.tsx`.

## Confuso ou difícil

- **Oz embolado.** Mesmo com "Enquadrar", 74 nós e muitas setas formam um emaranhado; **os nomes ficam minúsculos** (cerca de 5 px) e ilegíveis a 390 px. O que ajuda é tocar num nó (o resto esmaece) ou filtrar por tipo, mas quem abre o grafo pela primeira vez no Oz não sabe disso.
- **A vista inicial já vem aproximada**: no Oz os nós da borda aparecem cortados (D, T, C…), sem aviso, e o botão Enquadrar só mostra tudo em letra miúda.
- **O quadro do grafo é baixo** (≈ 480 px) porque o topo gasta espaço com abas, Filtros, "Achar ficha", Ligações/Árvore e a faixa verde.
- **"Ligações" aparece quatro vezes** no topo: a parte do Mundo, o título, a aba "Ligações" e "Algumas ligações mudam…".

## Pode mudar

- Filtro de entrada no Oz: abrir mostrando só personagens (ou "o que está perto de quem eu abri") e deixar "Mostrar tudo" como escolha.
- Alvo de toque maior nos nós (círculo invisível de 44 px).
- Esconder a faixa verde depois de usada uma vez, para dar altura ao grafo.
- Rótulos só dos nós grandes ou do nó tocado e vizinhos, quando o zoom for pequeno.

## Consertado neste PR

Nada.

## Não testado

- Criar, editar e apagar ligações (pela ficha › Editar: Ligações) e as de período e de cenas ("o `é` dos papéis").
- Aproximar com dois dedos (só os botões foram vistos).
- Árvore da família e "Ver cena a cena" com a história rodando.
- CPU lenta (fica para o 19).
- Ficha aberta ao lado em telas largas (só celular).
