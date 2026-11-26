# Auditoria 26 — As personas usando o app

Feita em 26/11/2026, sobre o ramo com os PRs 288 a 292 aplicados. Eu fiz o papel de cada persona de `docs/07-personas.md` e usei o app com o objetivo dela, no aparelho dela, **sempre começando pela apresentação** (`/`). Contei cada toque e fotografei os momentos-chave.

**Limites (antes de tudo):**
- **É um avaliador fazendo de conta**, não as pessoas. Eu sei onde as coisas ficam; alguém de verdade travaria em lugares que eu não travei. As contagens de toques são o **mínimo** e não o típico.
- A cópia de teste **não tem servidor** configurado. Por isso não deu para testar convite de jogadores, Codex ao vivo, link de leitura nem Comunidade com conta; telas que pediam servidor **não contam como defeito** (o site publicado tem servidor).
- O navegador de teste não tem dicionário de português (sublinhou todas as palavras de vermelho) e mostra datas no formato americano. Conferi: o app declara `lang="pt-BR"`. **Descartei os dois.**
- Celular simulado (390×844) e computador (1280×800).

## Resumo

| Persona | Objetivo | Chegou? | Toques (mínimo) | Onde travou |
|---|---|---|---|---|
| **Lia** (celular) | Escrever a primeira cena, criar dois personagens e ver o livro | **Sim** | **17** | A protagonista no começo da frase não vira “nome novo”; o “Salvo” cobre as abas; o livro se chama “Livro I” |
| **Rafa** (computador) | Criar a campanha, preparar a sessão, criar um NPC e revelá-lo aos jogadores | **Em parte** | 13 | **O NPC da Mesa não vira ficha do Mundo, então não dá para revelá-lo no Codex** |
| **Duda** (computador) | Trazer o mundo do Obsidian e ver quem se liga a quem | **Em parte** | 11 | **As `[[ligações]]` das notas não viram ligações**: a tela Ligações fica vazia. E o importador não aparece na primeira tela |
| **Beto** (celular) | Só ler | **Sim** | **3** | Cai antes no painel de quem escreve; um “+25” no caderno sem explicação |

O que mais pesa: **duas personas secundárias param exatamente no que vieram fazer** (Rafa revelar, Duda ver as ligações). A Lia, a principal, chega bem e rápido.

---

## Lia — a escritora de fantasia no celular

> “Toquei em ‘Começar a escrever’, dei nome, escolhi Fantasia e em seis toques eu já estava escrevendo. Isso é raro. Escrevi que a Selene chegou ao porto de Varn, e o rodapé disse ‘2 nomes novos’. Fui ver: Varn e Corvo Velho. **E a Selene? Ela é a protagonista.** Tive que selecionar o nome e tocar em ‘Ficha’. Pelo menos o nome já veio preenchido. Enquanto eu escrevia, um ‘Salvo’ ficava piscando bem em cima de Estrutura, Página e Revisão. No fim criei o livro e vi as páginas, bonito. Mas a folha de rosto diz **‘Livro I’**, e a capa diz ‘A Coroa de Sal’. Qual é o nome do meu livro?”

| Passo | Toques |
|---|---|
| Apresentação → “Começar a escrever” | 1 |
| Nome, Fantasia, Criar universo | 3 |
| Começar a escrever e digitar a cena | 2 |
| “2 nomes novos” → criar o Corvo Velho → fechar | 3 |
| Selecionar “Selene” → Ficha → Criar ficha | 3 |
| Fechar o teclado → Início | 2 |
| Mais → Publicar → Criar o livro (já abre a Diagramação) → Ver páginas | 3 |
| **Total** | **17** |

**Deu certo:** do zero à primeira frase em 6 toques; os Primeiros passos riscam o que ela já fez; a barra da seleção (Fato · Ficha · Vincular · Muda ou revela · Segredo · Comentar) é clara; “Criar o livro” abre direto a diagramação.

**Travou:**
- **L1 · grav. 2 · A protagonista não é percebida.** A regra (`logic/detection.ts`) conta um nome no começo de frase só a partir de **3 vezes**; no meio da frase, basta 1. Na primeira cena, justo quando os Primeiros passos pedem “transforme um nome em ficha”, quem abre a frase fica de fora. *Melhoria:* baixar para 2, ou contar 1 vez quando a palavra não for comum e não vier depois de fala.
- **L2 · grav. 3 · O “Salvo” cobre as abas** a cada pausa (já estava na auditoria 25, item A).
- **L3 · grav. 2 · O livro se chama “Livro I”** na folha de rosto e no título da Diagramação, enquanto a capa mostra o nome do universo. *Melhoria:* num universo com um livro só, o livro nasce com o nome do universo.
- **L4 · grav. 1 · “Começar a escrever” mostra o papel vazio** por um instante antes do formulário (carregamento sem esqueleto).

## Rafa — o mestre de RPG

> “‘Começar a mestrar’, nome da campanha, Criar: três toques e eu já estava na Mesa, com sessão 1 e tudo. O sistema veio Tormenta 20; eu jogo D&D, mas a escolha estava ali, na mesma tela, eu é que não vi. Criei o Corvo Velho como NPC em dois toques. Aí fui ao Codex para revelar o Corvo Velho aos jogadores e **a busca não acha ele**. Fui ao Mundo: vazio. **O NPC que eu criei na Mesa não existe no mundo.** Teria que criar a ficha no Mundo, voltar, ligar uma à outra e só então revelar.”

| Passo | Toques |
|---|---|
| Apresentação → “Começar a mestrar” | 1 |
| Nome da campanha → Criar campanha | 2 |
| Abrir a sessão 1 | 1 |
| Grupo → NPC do mestre → nome → Criar | 4 |
| Codex → buscar “Corvo” (nada) → Mundo (vazio) | 3 |
| Mesa → Convidar jogadores (pede servidor nesta cópia) | 2 |
| **Total** | **13**, sem conseguir revelar o NPC |

**Deu certo:** a Mesa já vem montada (sessão 1, grupo, sistema); a ficha de jogo nasce com PV; o Codex explica bem o que entra e o que nunca aparece.

**Travou:**
- **R1 · grav. 3 · NPC da Mesa sem ficha no Mundo → não se revela.** A ficha de jogo tem o campo “Ficha no mundo: Ligar a uma ficha…”, mas só liga a uma ficha que **já existe**. Para revelar o próprio NPC, são uns 8 toques a mais e uma volta pelo Mundo. *Melhoria:* ao criar um NPC, criar junto a ficha do Mundo (ou um botão “Criar a ficha no mundo” na ficha de jogo); e a busca do Codex achar também as fichas de jogo.
- **R2 · grav. 1 · O sistema vem escolhido (Tormenta 20).** Está no código como padrão (`useState('t20')`), provavelmente de propósito (o mais jogado no Brasil). O Rafa não percebeu porque a escolha fica abaixo do botão “Criar campanha”. *Melhoria:* a escolha do sistema acima do botão.
- **R3 · grav. 1 · A “Preparação” vem com a pergunta-guia como texto** (“Onde a história começa?…”), e é preciso apagar para escrever. *Melhoria:* deixar como dica (placeholder).

## Duda — a construtora de mundos

> “A apresentação diz ‘Trazer de outros apps: notas do Obsidian’, mas só lá embaixo, na parte do Mundo. Entrei no app e a primeira tela só fala em ‘Importar backup (.json)’. Criei um universo vazio para procurar e achei ‘Trazer de outro app’ no Início. Mandei meu .zip e ele entendeu tudo: 2 personagens, 2 lugares, 1 facção, pelas pastas. Lindo. Abri Ligações para ver quem é irmão de quem e: **‘Nenhuma ligação para mostrar. Adicione ligações como irmão de.’** Mas a minha nota diz ‘Irmão de [[Mira]]’! A Wiki ficou linda, isso sim.”

| Passo | Toques |
|---|---|
| Apresentação → seção Mundo → “Abrir o Papirus” | 2 |
| Criar universo vazio (para achar o importador) | 2 |
| Trazer de outro app → escolher o .zip | 1 |
| Trazer 5 fichas → Mundo | 2 |
| Ligações (vazia) | 1 |
| Fichas → Kael | 2 |
| Wiki | 1 |
| **Total** | **11** |

**Deu certo:** o importador leu o cofre do Obsidian pelas pastas e acertou os tipos; as menções viraram links no texto da ficha; a Wiki saiu completa e bonita com 5 fichas; o Mundo mostrou “Mapas” sozinho porque havia lugares.

**Travou:**
- **D1 · grav. 3 (para ela) · `[[ligações]]` não viram ligações.** É a primeira coisa que a Duda quer ver. *Melhoria:* na importação (e na ficha), propor ligações a partir de frases como “Irmão de [[Mira]]”, “serve à [[Casa Vaelor]]”, para ela aceitar ou não. Ou, mais simples, mostrar no grafo as **menções** como linhas finas (“citado em”), separadas das ligações de verdade.
- **D2 · grav. 2 · O importador não está na primeira tela.** Na Biblioteca só há “Importar backup (.json)” e “Abrir de uma pasta”. Quem traz um .zip do Obsidian pode tentar o .json e falhar. *Melhoria:* “Trazer de outro app (Obsidian, Kanka, World Anvil)” na Biblioteca, criando o universo junto.

## Beto — o leitor

> “Só queria ler. Toquei em ‘Abrir o exemplo’ e caí numa tela com ‘0 de 500 hoje’, ‘Continuar escrevendo’, ‘9 perguntas da Revisão’… isso não é para mim. Vi ‘Ler como livro’ lá em cima e aí sim: um livro, letra boa, ‘Próxima cena’. No segundo capítulo apareceu um **‘+25’** no ícone do caderno. Vinte e cinco o quê?”

| Passo | Toques |
|---|---|
| Apresentação → “Abrir o exemplo” | 1 |
| “Ler como livro” | 1 |
| “Próxima cena” | 1 |
| **Total** | **3** |

**Deu certo:** o leitor é limpo (serifa, coluna estreita, capítulos num menu); “Próxima cena” no fim; o aviso “Prévia: é assim que um leitor vê, sem nada secreto” (este é para o autor, e aparece porque o exemplo abre como autor).

**Travou:**
- **B1 · grav. 2 · “Abrir o exemplo” abre o painel do autor.** Para quem só quer ler, é o caminho errado. *Melhoria:* na apresentação, “Ler O Mágico de Oz” ao lado de “Abrir o exemplo”, levando direto ao leitor.
- **B2 · grav. 1 · “+25” no caderno sem dizer o quê.** *Melhoria:* um rótulo (“25 nomes anotados”) ou o (?) do leitor explicando o caderno.
- **B3 · grav. 1 · Ícones do alto do leitor sem nome no celular** (já na auditoria 25, item H).

---

## Plano sugerido (por quanto destrava)

1. **R1 · NPC vira ficha do Mundo** (e o Codex acha fichas de jogo): destrava o Rafa.
2. **D1 · ligações a partir das menções** (proposta para aceitar, ou linhas “citado em” no grafo): destrava a Duda.
3. **L2 · “Salvo” embaixo** (auditoria 25): a Lia vê a cada pausa.
4. **L1 · protagonista no começo da frase** (limite de 3 → 2): melhora a primeira cena da Lia.
5. **L3 · livro com o nome do universo**, **D2 · importador na Biblioteca**, **B1 · “Ler” na apresentação**: pequenos e baratos.
6. O resto (L4, R2, R3, B2, B3) quando sobrar tempo.

## O que fica de fora
- **Pessoas de verdade** fazendo estas jornadas (a próxima etapa óbvia: 5 a 8 por persona).
- Tudo que precisa de servidor: convidar jogadores, Codex ao vivo, link de leitura, comentários do leitor, Comunidade com conta.
- O Beto “de verdade” chega por um **link de leitura** (não pela apresentação); esse caminho não deu para testar aqui.
- Jornadas longas: a Lia no capítulo 30 (a promessa da persona: “o app lembra por mim”) e o Rafa na décima sessão.
