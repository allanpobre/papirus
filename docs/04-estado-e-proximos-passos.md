# Estado e próximos passos

Retrato do Papirus na versão 1.6.0 (atualizado em 2 de dezembro de 2026). Serve para retomar o trabalho depois de uma pausa, sozinho ou com qualquer assistente. As regras do dia a dia estão no [CLAUDE.md](../CLAUDE.md).

## A Nova cara (desde 30/11/2026, para todos)

A navegação é uma só. A barra de baixo no celular é fixa (**Escrever, Mundo, História, Mesa ou Publicar, Menu**) e o resto mora no **Menu**, com uma frase em cada item. A **Trama virou História** e a **Linha do tempo** mora nela (com Pistas e mistérios e Quem sabe o quê); o **Mundo** tem Fichas, Ligações e Mapas, e abre no Atlas no celular quando há mapas. Cada mundo tem o seu **clima** (cores no app inteiro). As Fichas são cartas com rosto e os filtros ficam atrás de um botão; a ficha do personagem é uma tela com **abas** (Visão, Ligações, Poderes, Diário, Referências); o personagem novo abre num **criador em cartas**; as Ligações abrem num **mural da ficha** (o grafo completo está a um toque); os poderes são uma **constelação**. Uma faixa fixa no alto diz em qual **livro** se está (“Trocar livro”). A cara antiga foi apagada do código; as preferências antigas (`novaCara`, atalhos da barra) são ignoradas ao ler.

Também desde então: **atalhos de teclado** (`?` mostra todos; Alt+1…9 áreas; `[` `]` partes; J/K lista; E ler/editar), **tamanho da letra do app** (Ajustes › Aparência), nada só por cor, opção de **abas embaixo no celular**, **coleções de livros** (“Tales of Papilio” com “Tales of Malkai” dentro; cada livro numa coleção só; escolher “Todos de…” filtra as telas) e, na Mesa, o **Codex dentro do modo sessão**.

## Onde o app está

| Parte | Estado |
| --- | --- |
| **Escrever** (Mapa, Página, Revisão) | Completo. Procurar e trocar, metas, treino e leitores beta. |
| **Mundo** (Fichas, Ligações, Mapas; a Linha do tempo está na História) | Completo. Simples/Completo, Semente, Máquina do tempo, mapa político, lendas, efeito dominó, “No jogo”, trazer de outros apps. Nas Ligações, as fichas são afastadas até nenhum nome encostar em outro (o desenho pode ficar maior que a tela; “Enquadrar” mostra tudo). |
| **Fichas: a história do personagem** | Rework de novembro. A ficha é uma página de **blocos** editada no lugar (sem Ler/Editar; o formulário inteiro fica em “⋯ › Editar tudo de uma vez”). A **régua da história** (“Até onde na história”) mostra a ficha como está numa cena, com “Ver como o leitor”. **Fases** (o personagem muda: nome, resumo, campos, retrato, com o porquê) e comparar fases. **Revelações**: o leitor descobre o Quem é, uma ligação, um trecho ou a ficha inteira numa cena, com máscara até lá e aviso de jogo limpo. **Aparece em** com o nome em destaque, papel na cena e tira de presença. **Referências** (só do autor). **Poderes e magia**: árvore por sistema (modelos prontos), aprende numa cena, de nascença pela espécie, acende pela régua e avisa o que não fecha. **Sugestões do texto** (só regras): apelido pelo primeiro nome e “Fulano, uma X” na margem; “Muda ou revela” na seleção. |
| **Universos alternativos (AU)** | Criar a partir de um mundo autorizado, lore só leitura, novidades do original e canonizar (fichas, ligações, datas, fatos e histórias inteiras, com as cenas). |
| **Wiki do mundo** | Completa. Site num arquivo, .md e .json, quatro estilos, página com prévia. Também por link: o link de leitura tem o jeito “Wiki do mundo”, que abre a wiki sem conta e sem segredos (botão “Pegar o link da wiki” na página Wiki). |
| **Vários livros no universo** | A faixa **Livro atual** no alto (só com mais de um livro) diz em qual se está, com “Trocar livro” (capas, e “Agrupar em coleções”). Início, Escrever, História, Mundo e Publicar mostram só ele; “Todos os livros” mostra tudo. Uma **coleção** junta livros (uma pode estar dentro de outra) e “Todos de…” mostra os da coleção. No computador, as capas ficam no Início; no celular, atrás do “Trocar livro”. A escolha fica no aparelho, por universo. Ainda **não** existe a escolha de dois ou três livros soltos (só por coleção). |
| **História** (era a Trama) | Pistas e mistérios, quem sabe o quê e a Linha do tempo. |
| **Publicar** | Livro em cinco passos, diagramação com Paged.js, livro 3D, Folhear, PDF, EPUB, Word e capa para gráfica. |
| **Mesa** | Escudo do mestre, combate com fila, cartão do jogador, Codex ao vivo, bestiário e diário. |
| **Oficina** | Trilhas, biblioteca, gerador de ideias e caderno. |
| **Conta e nuvem** | Opcional (Supabase). Cópias no aparelho e na nuvem, conflitos, amigos, estante e placar. |
| **Comunidade** | Setor no início do app: Novidades, Lendo (continuar de qualquer aparelho, capítulos novos), Pessoas (seguir, bloquear), Seus livros (até onde leram, só números), denunciar comentário e pedir AU pelo perfil. Precisa de `supabase/comunidade.sql`. Testado só com o servidor de mentira. |
| **Exemplos** | O principal é a Terra de Oz: "O Mágico de Oz" (Baum, 1900) inteiro, traduzido para o Papirus, com os quatro países no mapa político, "Quem é" (Povo e Feito de, com exceção), segredos, linha do tempo e uma Mesa d20. Também traz trechos dos livros 2 (“A Maravilhosa Terra de Oz”: Tip é Ozma, e quem a escondeu foi o Mágico) e 3 (“Ozma de Oz”), e de “A Rainha Zixi de Ix”, do mesmo mundo mas sem personagem em comum, cada um com o seu livro na estante. Os dois exemplos marcam o papel de cada um na história. Quem abriu um exemplo antigo recebe o atual dele ao abrir (o Alienista antigo vira o Alienista, não o Oz). A tradução não teve revisão humana; `scripts/revisar-oz.mjs` procura inglês, nomes de dois jeitos, pontuação e frases repetidas (não achou erro claro). |

Os testes automáticos cobrem tudo isso: 679 testes de unidade (`npm run check`) e 398 no navegador (`e2e/`, 134 arquivos). **O CI** (`.github/workflows/testes.yml`) roda tudo em cada pedido (PR) e toda noite (e2e em 4 partes); a sessão só roda os testes ligados à mudança.

O backup (Ajustes › Dados e backup) leva o universo, as imagens, as versões guardadas com nome e o livro escolhido no aparelho.

## Como continuar

1. Ramo novo a partir do main, mudança pequena, `npx tsc -b` e os testes e2e da área mexida (o CI roda o resto).
2. Pedido (PR) para o main, com a descrição em português: o que muda, para quem, o que foi testado e o que **não** foi. Um pacote por vez; com o CI verde e sem depender de outro PR, o Claude junta.
3. Conferir no celular (360–390 px): é onde a maioria usa.
4. **As personas** (`docs/07-personas.md`): `node scripts/personas/rodar.mjs` faz a Lia, a Duda, o Rafa e o Beto usarem o app desde a apresentação e salva fotos; é o jeito de pedir um novo retorno.
5. Nos testes e2e, use os ajudantes de `e2e/areas.ts`: `openPart`, `openGraph`, `abrirFiltros`, `fecharCriador`, `abaFicha`, `escolherLivro`.

Ao pedir uma mudança a um assistente, ajuda mandar a foto da tela, dizer a área (“Mundo › Ligações”) e pedir uma coisa por vez.

## Ideias que ficaram na fila

Vieram do quiz de opinião e das conversas, mais ou menos em ordem de valor:

(As antigas “Achar as funções” e “Primeira vez mais curta” foram feitas: Menu em grupos, “Todas as ferramentas”, passeios e a Nova cara.)

1. **Coleções em todo lugar:** elas filtram as telas e, em Publicar, o volume novo pode nascer com os livros de uma coleção. Faltam a wiki só de uma coleção (decidir o que entra: a ficha que aparece nos dois lados), o link de leitura e o compartilhar.
2. **Mundo:** idiomas e nomes por cultura, e linha do tempo por região.
3. (Feito: a wiki, em todos os formatos e pelo link, traz a árvore de cada sistema e os poderes de cada personagem, sem spoiler.)
4. (Feito: a wiki do link já vai só até a cena escolhida em Compartilhar e na página Wiki; `settings.wiki.upToScene`.)
5. **Retorno das personas** que ficou: nada pendente (os 9 itens da última rodada entraram).

## O que ainda não foi testado de verdade

- Duas pessoas ao vivo, ao mesmo tempo: na Mesa, no Mundo a quatro mãos e com conflitos na nuvem.
- O AU com contas de verdade, no servidor de verdade (o teste usa um servidor de mentira), e uma história do AU que mistura cenas do original.
- A ficha de blocos com duas pessoas arrumando a mesma página ao mesmo tempo; a galeria de imagens num bloco (o e2e não sobe arquivo).
- Poderes na wiki: só conferido pelos testes de unidade e o HTML gerado, não aberto em Safari e Firefox.
- Sugestões do texto: o “Muda ou revela” na barra do celular só foi conferido pelos tipos; o padrão do Quem é só pega “Nome, um/uma/o/a Opção”.
- Backup: importar “como novo” dentro de Ajustes não traz as versões guardadas; backup do Oz inteiro com imagens.
- Os arquivos abertos em outros programas:
  - EPUB num leitor de e-book;
  - Word no Word;
  - .md no Obsidian;
  - a wiki no Safari e no Firefox;
  - o PDF numa gráfica.
- O app instalado (PWA) no iPhone, e o Folhear em celulares mais fracos.
- A Nova cara e as coleções num celular de verdade (os testes são num navegador simulado); as coleções com a nuvem e com dois aparelhos.
- A wiki pelo link com o servidor de verdade (o teste usa o servidor de mentira), com imagens, e aberta em Safari e Firefox.
- Arrastar e pinçar as Ligações grandes num Android de verdade.

## Cuidados que valem lembrar

- Os dados ficam no navegador: sem conta, o backup (Ajustes → Seus dados) é o que protege o trabalho.
- `src/styles/views.css` é grande: blocos novos vão no fim, com um título em comentário.
- Campo novo no esquema é sempre opcional, para universos antigos continuarem abrindo.
