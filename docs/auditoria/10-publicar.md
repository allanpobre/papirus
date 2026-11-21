# Auditoria 10 — Publicar e exportações

Playwright com downloads reais a 390×844, no Ostria. Os arquivos foram abertos por código (zip, XML, texto). 20/11/2026.

## Funciona bem

- **Primeira visita ao Publicar**: "Estante vazia — Seu primeiro livro" com três frases do que o Publicar faz (capa, série, PDF/e-book/Word/texto) e um botão "Criar o livro".
- **Depois de criar**, a tela vira um roteiro numerado: 1 O texto, 2 Revisar, 3 Leitores, 4 Diagramar, 5 Baixar e publicar. Cada passo tem um botão e uma linha de resumo ("8 capítulos · 622 palavras", "5 cenas para olhar", "14 × 21 cm · EB Garamond…"). Muito claro.
- **Diagramar** abre uma janela com Capa, Contracapa, Folha de rosto, Dedicatória, Modelos (Romance clássico, Fantasia…), sem rolagem lateral.
- **Baixar** lista 5 formas, cada uma com uma frase que explica para que serve: PDF para imprimir (abre a prévia), E-book (EPUB) "Kindle, Kobo, Apple Livros", Word (.docx) "para editora ou revisor", Texto (.md), Wiki do mundo.
- **EPUB**: `mimetype` é o primeiro arquivo e vale `application/epub+zip`; tem `container.xml`, `content.opf` (título "Livro I — A Maré Volta", idioma `pt-BR`), `nav.xhtml`, `toc.ncx`, folha de rosto, 8 capítulos, CSS e 3 fontes embutidas. Estrutura correta (não abri num leitor real).
- **.docx**: abre como zip com `document.xml`, `styles.xml` e `core.xml`; o texto lido de volta tem ~651 palavras, o título e os capítulos na ordem certa.
- **.md**: título, capítulos com `##`, falas com travessão. Limpo.
- **Wiki (página)**: prévia ao vivo, link para mandar, "O que entra" (Tudo menos segredos, ou só o que o leitor sabe até cada cena), 4 estilos (Clássico, Moderno, Pergaminho, Noturno), cores, "Baixar a wiki (.html)" e "Ver antes".
- **Segredos**: procurei nos arquivos gerados (EPUB, .docx, .md e a wiki .html) as frases secretas do Ostria ("É Vaelor", "herdeira escondida", "mandou incendiar", "Retorno do Homem Pálido", as etiquetas `[segredo]` e `[a partir de…]`). **Nenhuma aparece, em nenhum arquivo.**

## Defeitos

Nenhum encontrado.

## Confuso ou difícil

- **O exemplo Ostria abre o Publicar vazio** ("Estante vazia"), então quem abre o exemplo para conhecer o Publicar não vê nada pronto; é preciso criar o livro. O Oz tem livros prontos? (conferir no 22).
- **"PDF para imprimir"** diz "abre a prévia, para conferir antes", mas quem não sabe que o PDF sai pela impressão do navegador pode não achar o "salvar como PDF".
- **Ao tocar em "Baixar" nos 5 passos, o primeiro "Baixar" (passo 5) e o "Baixar" do alto do livro** fazem a mesma coisa; são dois jeitos para o mesmo menu.
- **A página Wiki é longa** para o celular: link, "Wiki do mundo", "O que entra" com uma opção por cena (uma lista que cresce com a história), estilos, cores, e só então o botão "Baixar". Dá para se perder.
- O link de "Wiki com link" aparece ao lado de "Wiki do mundo" com textos parecidos.

## Pode mudar

- "O que entra": trocar a lista longa por um seletor de cena ("Até: ▾").
- Colocar "Baixar a wiki" no alto da página Wiki, não depois dos estilos.
- Mostrar no EPUB a capa gerada quando o autor não envia uma.
- Exemplo com um livro pronto no Ostria.

## Consertado neste PR

Nada.

## Não testado

- Diagramação com Paged.js em detalhe (prévia de páginas, sumário, estilos) e PDF de verdade.
- Livro 3D e Folhear, e se são iguais à diagramação.
- Baixar o .md e o .json da wiki (só o .html foi baixado e examinado).
- Link de leitura e "Wiki com link" com o Supabase falso.
- Abrir o EPUB num leitor, o .docx no Word e o PDF numa gráfica (só estrutura e texto).
- Imagens (mapas, capa) dentro do EPUB e do .docx.
