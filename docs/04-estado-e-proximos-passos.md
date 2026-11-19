# Estado e próximos passos

Retrato do Papirus na versão 1.6.0 (atualizado em 18 de novembro de 2026). Serve para retomar o trabalho depois de uma pausa, sozinho ou com qualquer assistente. As regras do dia a dia estão no [CLAUDE.md](../CLAUDE.md).

## Onde o app está

| Parte | Estado |
| --- | --- |
| **Escrever** (Mapa, Página, Revisão) | Completo. Procurar e trocar, metas, treino e leitores beta. |
| **Mundo** (Fichas, Ligações, Linha do tempo, Mapas) | Completo. Simples/Completo, Semente, Máquina do tempo, mapa político, lendas, efeito dominó, “No jogo”, trazer de outros apps. Nas Ligações, as fichas são afastadas até nenhum nome encostar em outro (o desenho pode ficar maior que a tela; “Enquadrar” mostra tudo). |
| **Fichas: a história do personagem** | Rework de novembro. A ficha é uma página de **blocos** editada no lugar (sem Ler/Editar; o formulário inteiro fica em “⋯ › Editar tudo de uma vez”). A **régua da história** (“Até onde na história”) mostra a ficha como está numa cena, com “Ver como o leitor”. **Fases** (o personagem muda: nome, resumo, campos, retrato, com o porquê) e comparar fases. **Revelações**: o leitor descobre o Quem é, uma ligação, um trecho ou a ficha inteira numa cena, com máscara até lá e aviso de jogo limpo. **Aparece em** com o nome em destaque, papel na cena e tira de presença. **Referências** (só do autor). **Poderes e magia**: árvore por sistema (modelos prontos), aprende numa cena, de nascença pela espécie, acende pela régua e avisa o que não fecha. **Sugestões do texto** (só regras): apelido pelo primeiro nome e “Fulano, uma X” na margem; “Muda ou revela” na seleção. |
| **Universos alternativos (AU)** | Criar a partir de um mundo autorizado, lore só leitura, novidades do original e canonizar (fichas, ligações, datas, fatos e histórias inteiras, com as cenas). |
| **Wiki do mundo** | Completa. Site num arquivo, .md e .json, quatro estilos, página com prévia. Também por link: o link de leitura tem o jeito “Wiki do mundo”, que abre a wiki sem conta e sem segredos (botão “Pegar o link da wiki” na página Wiki). |
| **Vários livros no universo** | A faixa **Livro** no alto (só com mais de um livro) escolhe em qual se está. Início, Escrever, Trama, Mundo e Publicar mostram só ele; “Todos os livros” mostra tudo. No celular, no Escrever, o livro se escolhe no topo da lista de cenas. A escolha fica no aparelho, por universo. |
| **Trama** | Pistas e mistérios, e quem sabe o quê. |
| **Publicar** | Livro em cinco passos, diagramação com Paged.js, livro 3D, Folhear, PDF, EPUB, Word e capa para gráfica. |
| **Mesa** | Escudo do mestre, combate com fila, cartão do jogador, Codex ao vivo, bestiário e diário. |
| **Oficina** | Trilhas, biblioteca, gerador de ideias e caderno. |
| **Conta e nuvem** | Opcional (Supabase). Cópias no aparelho e na nuvem, conflitos, amigos, estante e placar. |
| **Comunidade** | Setor no início do app: Novidades, Lendo (continuar de qualquer aparelho, capítulos novos), Pessoas (seguir, bloquear), Seus livros (até onde leram, só números), denunciar comentário e pedir AU pelo perfil. Precisa de `supabase/comunidade.sql`. Testado só com o servidor de mentira. |
| **Exemplos** | O principal é a Terra de Oz: "O Mágico de Oz" (Baum, 1900) inteiro, traduzido para o Papirus, com os quatro países no mapa político, "Quem é" (Povo e Feito de, com exceção), segredos, linha do tempo e uma Mesa d20. Também traz trechos dos livros 2 (“A Maravilhosa Terra de Oz”: Tip é Ozma, e quem a escondeu foi o Mágico) e 3 (“Ozma de Oz”), e de “A Rainha Zixi de Ix”, do mesmo mundo mas sem personagem em comum, cada um com o seu livro na estante. Os dois exemplos marcam o papel de cada um na história. Quem abriu um exemplo antigo recebe o atual dele ao abrir (o Alienista antigo vira o Alienista, não o Oz). A tradução não teve revisão humana; `scripts/revisar-oz.mjs` procura inglês, nomes de dois jeitos, pontuação e frases repetidas (não achou erro claro). |

Os testes automáticos cobrem tudo isso: cerca de 610 testes de unidade (`npm run check`) e 290 no navegador (`e2e/`).

O backup (Ajustes › Dados e backup) leva o universo, as imagens, as versões guardadas com nome e o livro escolhido no aparelho.

## Como continuar

1. Ramo novo a partir do main, mudança pequena, `npm run check` e os testes e2e da área mexida.
2. Pedido (PR) para o main, com a descrição em português: o que muda, para quem, o que foi testado.
3. Conferir no celular (360–390 px): é onde a maioria usa.

Ao pedir uma mudança a um assistente, ajuda mandar a foto da tela, dizer a área (“Mundo › Ligações”) e pedir uma coisa por vez.

## Ideias que ficaram na fila

Vieram do quiz de opinião e das conversas, mais ou menos em ordem de valor:

1. **Achar as funções:** agrupar o menu “Mais”, ter uma lista “Todas as ferramentas” em Ajustes e explicar melhor “Simples ou Completo” (o quiz disse: “não entendi” e “o menu Mais confunde”).
2. **Primeira vez mais curta:** menos coisas na tela do primeiro universo, com as ferramentas aparecendo conforme o uso.
3. **Mundo:** idiomas e nomes por cultura, e linha do tempo por região.
4. **Livros:** escolher dois ou três livros juntos (uma série dentro do universo); a wiki do link só até um ponto da história.

## O que ainda não foi testado de verdade

- Duas pessoas ao vivo, ao mesmo tempo: na Mesa, no Mundo a quatro mãos e com conflitos na nuvem.
- O AU com contas de verdade, no servidor de verdade (o teste usa um servidor de mentira), e uma história do AU que mistura cenas do original.
- A ficha de blocos com duas pessoas arrumando a mesma página ao mesmo tempo; a galeria de imagens num bloco (o e2e não sobe arquivo).
- Poderes: a árvore ainda não entra na wiki nem no link de leitura; vista em constelação ainda não existe.
- Sugestões do texto: o “Muda ou revela” na barra do celular só foi conferido pelos tipos; o padrão do Quem é só pega “Nome, um/uma/o/a Opção”.
- Backup: importar “como novo” dentro de Ajustes não traz as versões guardadas; backup do Oz inteiro com imagens.
- Os arquivos abertos em outros programas:
  - EPUB num leitor de e-book;
  - Word no Word;
  - .md no Obsidian;
  - a wiki no Safari e no Firefox;
  - o PDF numa gráfica.
- O app instalado (PWA) no iPhone, e o Folhear em celulares mais fracos.
- A wiki pelo link com o servidor de verdade (o teste usa o servidor de mentira), com imagens, e aberta em Safari e Firefox.
- Arrastar e pinçar as Ligações grandes num Android de verdade.

## Cuidados que valem lembrar

- Os dados ficam no navegador: sem conta, o backup (Ajustes → Seus dados) é o que protege o trabalho.
- `src/styles/views.css` é grande: blocos novos vão no fim, com um título em comentário.
- Campo novo no esquema é sempre opcional, para universos antigos continuarem abrindo.
