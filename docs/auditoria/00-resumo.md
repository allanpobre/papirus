# Auditoria do Papirus — resumo e lista de consertos

Junta os 22 relatórios (`01` a `22`) feitos em 20/11/2026, cada um num PR próprio (allanpobre/papirus#239 a #260). **Antes de ler:** os relatórios 12 (nuvem), 14 (ajustes e dados) e partes do 05, 09 e 16 são de **cobertura**, não de uso à mão; a seção "Lacunas" no fim diz o que **não** foi visto.

Tamanhos: **pequeno** (poucas linhas), **médio** (um dia de trabalho, uma área), **grande** (várias áreas ou decisão de produto).

## 1. O que está bom

- **Primeira vez (01):** 3 toques até digitar a primeira frase; nada se perde ao recarregar (testado até 50 ms depois de digitar); passeio Rápido/Completo, Guia e Primeiros passos funcionam; sem rolagem lateral a 390 ou 360 px.
- **Escrever (03):** procurar e trocar, versões da cena, Estrutura (modelos, promessas), modo foco e a barra acima do teclado. Cena de 5.800 caracteres sem engasgo.
- **Trama (04):** vazio calmo e criar em 4 toques.
- **Fichas (05):** ricas e estáveis, mesmo com nome de 140 caracteres e descrição de 20 mil.
- **Ligações (06):** tocar num nó destaca as ligações e abre um cartão; arrastar com o dedo funciona.
- **Linha do tempo (07):** Máquina do tempo, Faixas e arrastar com toque (com "Desfazer").
- **Mapas (08):** Gerar continente, Rota (com dias a pé e a cavalo) e Pintar região.
- **Oficinas (09):** o "Rolar no mundo" é fácil de achar e usa o mundo de verdade (inclusive a tabela da Mesa).
- **Publicar (10):** EPUB, .docx, .md e wiki saem com estrutura correta e **sem nenhum segredo do Ostria**.
- **Mesa (11):** a sessão (capa, quem joga hoje, palco, fim) é muito boa; as specs de combate de 15 e de celular do jogador passam.
- **Importar (13):** arquivo vazio, quebrado ou cortado dá mensagem clara; um `.md` de 36 MB não trava.
- **Dados (14):** 7 casos de preferências velhas ou estranhas abrem sem erro.
- **Jornadas (15, 16):** do zero até a wiki em **35 toques** (escritor) e da campanha ao fim da sessão em **33** (mestre), sem becos sem saída. Cada uma virou um e2e.
- **Visual (17):** 6 de 7 combinações (com e sem Nova cara, claro e escuro) sem nenhum texto abaixo do contraste mínimo.
- **Acessibilidade (18):** axe sem violações nas telas novas; nenhum botão sem nome; Esc e foco voltam ao lugar.
- **Sem internet (20):** 247 arquivos guardados; escrever e recarregar offline mantêm o texto; "Atualizar" não perde a frase.
- **Exemplos (22):** os três abrem sem erro e com tudo cheio.

## 2. Consertar primeiro (alta e média)

**Nenhum defeito de gravidade alta** (nada que perca dado ou trave) foi encontrado. Os de gravidade média:

| # | Estado | Área | O que | Passos | Arquivo provável | Tamanho |
|---|---|---|---|---|---|---|
| **C1** | ✅ consertado (allanpobre/papirus#241) | Escrever | A janela "Revisão" (nomes novos) era mais larga que o celular; o X de fechar saía da tela | Escrever › digitar 2 nomes › tocar "N nomes novos" | `src/styles/base.css` | pequeno |
| **C2** | ✅ consertado (allanpobre/papirus#255) | Visual | Terror escuro: texto vermelho e botão cheio abaixo de 4,5:1 (22 textos) | Nova cara › Terror › escuro | `src/styles/climas.css` | pequeno |
| **C3** | ✅ consertado (allanpobre/papirus#247) | Oficinas | "O Gole de as montanhas" (de + as) nas frases do Rolar no mundo | Mundo › Rolar no mundo › Nome de taverna | `src/logic/worldRolls.ts` | pequeno |
| **C4** | 🟡 em parte (allanpobre/papirus#262: só a altura, 44 px) | Todas | **Alvos de toque abaixo de 44 px** em todo o app: "Rolar no mundo" e "Wiki" 28×28, Buscar e (?) 28×32, abas do Mundo 30 px, "Marcar lugar"/"Rota" 29 px, chips 34 px, "Voltar para a lista" 32 px | Qualquer tela a 390 px | `src/styles/base.css` (`.btn`, `.btn-icon`, `.tab`, `.chip`), `views.css` | médio |
| **C5** | aberto | Exemplos | O exemplo principal (Oz) **não mostra as oficinas novas**: sem rota, língua, cultura, festas, panteão, tensões nem causa; só o Ostria tem algumas, e ele só abre por URL e sem livro | Abrir `?exemplo` | `src/model/sampleOz*.ts`, `sampleOstria.ts`, `src/views/HomeView.tsx` | médio |
| **C6** | aberto | Desempenho | **Digitar no capítulo grande do Oz custa ≈ 40 ms por tecla** com CPU 4× mais lenta (60 teclas em 2,4 s) | Oz › Escrever › digitar | `src/editor/` (o que roda a cada tecla) | médio |
| **C7** | aberto | Desempenho | **Abrir o app leva 2,2 s** (CPU 4×): 33 arquivos, 1,26 MB, CSS de 358 kB bloqueando | Abrir `/app/` | `src/main.tsx`, `vite.config.ts`, `src/styles/` | médio |
| **C8** | aberto | Desempenho | **Mundo com 74 fichas leva 1,8 s**; Estrutura 1,5 s | Oz › Mundo | `src/views/EntitiesView.tsx` | médio |
| **C9** | aberto | Nova cara | **A Nova cara muda onde as coisas moram** (Menu, História; Linha do tempo sai do Mundo para História) e o **passeio, o Guia e o "O que mudou" seguem com os nomes antigos** | Ligar Nova cara | `src/shell/pageTours.ts`, `GuideView.tsx` | médio |
| **C10** | aberto | Mapas | **Rótulos que se cobrem** (nomes de lugar, "0,6 d" sobre outros nomes, pino sobre o "e") em 390 px com 5 lugares | Ostria › Mapas | `src/views/AtlasView.tsx` | médio |
| **C11** | aberto | Escrever | **Digitar em menos de 100 ms depois de abrir uma cena nova pode perder o resto do texto** (visto 2 vezes em automação; com 250 ms de espera não aconteceu) | Nova cena depois desta › digitar rápido | `src/views/` (editor ao trocar de cena) | médio (investigar primeiro) |
| **C12** | aberto | Universos | **Apagar universo não tem "Desfazer"** (só confirmação); não dá para **renomear nem duplicar** pela lista | Início › cartão › ⋯ | `src/shell/LibraryScreen.tsx` | médio |
| **C13** | aberto | Acessibilidade | As **rotas do mapa não têm texto** para leitor de tela; mover evento nas Faixas só por arrasto | Mapas, Faixas | `AtlasView.tsx`, `TimelineLanes.tsx` | médio |
| **C14** | aberto | Mesa | **Aplicar dano num combate de 15 leva 1,8 s** (CPU 4×) | spec `combate-grande` | `src/rpg/`, `src/views/rpg/` | médio |

Os defeitos **baixos** (mais de 20) estão em cada relatório. Os mais úteis de juntar, todos **pequenos**:

| # | Onde | O quê |
|---|---|---|
| **C15** | 03 | ✅ consertado (allanpobre/papirus#263): Revisão sugeria "Depois Kael" depois de um trecho `[segredo]` |
| **C16** | 05 | ✅ consertado (allanpobre/papirus#263): nome em edição ficava cortado numa linha só |
| **C17** | 07 | Arrastar 12 px nas Faixas move 60 anos; a régua cresce sem aviso |
| **C18** | 07 | Com "No ano 341 DC" ligado, "Todas (17)" não muda (conferir se a lista filtra) |
| **C19** | 09 | Frases do Rolar no mundo sem artigo: "A Porta de Reino de Ostria", "Em Paço do Regente"; resultados repetidos |
| **C20** | 11 | "Revelações" no fim da sessão mostrava 4 sem revelar nada; título da sessão cortado |
| **C21** | 13 | ~~O aviso de erro do arquivo anterior fica por cima do "Achei 1 ficha"~~ **descartado**: é um toast de poucos segundos; a auditoria carregou os arquivos em sequência rápida |
| **C22** | 15 | "Clique" no celular — ✅ consertado (allanpobre/papirus#259); falta "Ctrl K" no passo da busca |
| **C23** | 01 | O passeio não retoma depois de recarregar e não abre sozinho |
| **C24** | 21 | Nomes iguais para coisas diferentes (Revisão, Mais, Ligações ×4, Snapshots/versões/cópias) |

✅ também consertados: "1 conceitos" (allanpobre/papirus#251) e "sem cartão" (allanpobre/papirus#259).

## 3. Deixar mais fácil (confusão que aparece em mais de uma área)

1. **Coisa escondida / ferramenta que não se descobre.** A Língua e a Oficina da cultura só aparecem na ficha de **Cultura** (não na de Povo); o "Segredo" não tem botão (só digitando `[segredo]`); "Escolher atalhos" e "Efeito dominó" são ícones; o Ostria só abre por URL. (01, 09, 15, 22)
2. **O mesmo nome para coisas diferentes e nomes diferentes para a mesma coisa.** Revisão, Mais, Ligações, Wiki, Baixar, Tempo/Linha do tempo, Trama/História, Início/Menu, Snapshots/versões. (03, 06, 10, 17, 21)
3. **Jargão que o usuário nunca escolheu.** "Dupla" local/nuvem, "Pedir para manter", "Quase/Rascunho", "Sprint", "Codex", "conceito". (05, 12, 14, 21)
4. **Telas com muito antes do conteúdo.** Máquina do tempo (270 px) antes da lista; barra do mapa em 3 linhas; faixa verde do grafo; quadro da Trama largo sem aviso. (06, 07, 08, 04)
5. **Caminhos longos para coisas comuns.** Escrever → Publicar são 4 toques (fechar o teclado, Mais, Publicar); cada personagem novo da Mesa são 2 toques; a Semente fica no Início, não na Mesa. (15, 16)

## 4. Ideias (as melhores do "Pode mudar", no máximo 15)

1. **Dar vitrine das oficinas ao Oz** (rota, cultura com língua e festas, panteão, tensões, uma causa) — a melhor ideia de produto; ver C5.
2. **Botão "Segredo"** na barra acima do teclado (descoberta + menos erro).
3. **Convite de passeio** uma vez, depois de criar o primeiro universo ("Quer um passeio de 1 minuto?"), com um Rápido de ~6 passos.
4. **"Duplicar" e "Renomear" no cartão do universo**, e um "Desfazer" (ou lixeira) para universo apagado.
5. **Máquina do tempo recolhida** num botão "Ver o mundo num ano", e arrasto das Faixas em anos "redondos" com uma bolha do ano.
6. **Rotas dizendo o tempo para leitor de tela** e botões −1/+1 ano para mover evento sem arrastar.
7. **"Criar personagem" continua na lista** (ou "Criar e fazer outro") na Mesa.
8. **Sugerir o ano** da última sessão no "Fim da sessão".
9. **Aumentar a área de toque** dos ícones do alto sem mudar o desenho (C4).
10. **Teste de contraste automático** em todos os climas no CI (o roteiro do 17 já faz).
11. **Frases das tabelas para qualquer nome** (sem artigo) e "Rolar de novo" sem repetir.
12. **Ostria como terceiro exemplo** no Início ("só para ver as ferramentas") e com o Livro I criado.
13. **"O que entra" da wiki como seletor de cena**, e "Baixar" no alto da página Wiki.
14. **Teste de conexão em Ajustes › Servidor próprio** (quais scripts do servidor estão instalados).
15. **Um "dicionário da interface"** com um teste que confira passeio, Guia e telas (também na Nova cara).

## 5. Lotes sugeridos (um PR cada), na ordem

| Lote | Itens | Por quê junto |
|---|---|---|
| **1 — Textos e passeios** | C9, C22 (Ctrl K), C24, C23 | só texto e `pageTours.ts`/Guia; baixo risco; tira a confusão mais repetida |
| **2 — Toque e a11y** | C4, C13 | CSS comum + rótulos; um teste de alvo mínimo |
| **3 — Vitrine** | C5, ideia 12 | só dados dos exemplos; mostra as oficinas e dá material para o resto |
| **4 — Mapas** | C10 | um arquivo (`AtlasView.tsx`), com foto antes/depois |
| **5 — Desempenho da escrita** | C6, C11, C15 | mesmo editor; começar por **perfilar** |
| **6 — Desempenho de abertura e listas** | C7, C8, C14 | mesmo tipo de trabalho (carregar menos, desenhar menos) |
| **7 — Universos** | C12, ideia 4 | `LibraryScreen.tsx` |
| **8 — Pequenos** | C16, C17, C18, C19, C20, C21 | um de cada, todos de poucas linhas; cada um com seu teste |

Ordem sugerida: **1, 2, 3** (usuário vê e sente) → **5** (a escrita é o centro do app) → **4, 7** → **6** → **8**.

## 6. Lacunas (o que as auditorias não viram)

- **Celular de verdade:** teclado virtual, toque real, app instalado e sem internet, leitor de tela.
- **Nuvem e pessoas de verdade:** só as specs com Supabase falso (12); presença ao vivo e canal da Mesa não foram rodados.
- **Exportações em programas de verdade:** EPUB num leitor, .docx no Word, PDF na gráfica; Paged.js, 3D e Folhear não foram vistos (10).
- **Ciclo de backup** (baixar → apagar → trazer de volta), lixeira e histórico por uso (14).
- **Língua, Oficina da cultura, Panteão e Poder** só localizados, não usados a fundo (09).
- **Nova cara × Terror claro** e ícones/bordas no contraste (17).
- **O que é bonito ou chato:** só quem usa diz.
