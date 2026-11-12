# Estado e próximos passos

Retrato do Papirus na versão 1.6.0 (12 de novembro de 2026). Serve para retomar o trabalho depois de uma pausa, sozinho ou com qualquer assistente. As regras do dia a dia estão no [CLAUDE.md](../CLAUDE.md).

## Onde o app está

| Parte | Estado |
| --- | --- |
| **Escrever** (Mapa, Página, Revisão) | Completo. Procurar e trocar, metas, treino e leitores beta. |
| **Mundo** (Fichas, Ligações, Linha do tempo, Mapas) | Completo. Simples/Completo, Semente, Máquina do tempo, mapa político, lendas, efeito dominó, “No jogo”, trazer de outros apps. |
| **Universos alternativos (AU)** | Novo. Criar a partir de um mundo autorizado, lore só leitura, novidades do original e canonizar. |
| **Wiki do mundo** | Completa. Site num arquivo, .md e .json, quatro estilos, página com prévia. |
| **Trama** | Pistas e mistérios, e quem sabe o quê. |
| **Publicar** | Livro em cinco passos, diagramação com Paged.js, livro 3D, Folhear, PDF, EPUB, Word e capa para gráfica. |
| **Mesa** | Escudo do mestre, combate com fila, cartão do jogador, Codex ao vivo, bestiário e diário. |
| **Oficina** | Trilhas, biblioteca, gerador de ideias e caderno. |
| **Conta e nuvem** | Opcional (Supabase). Cópias no aparelho e na nuvem, conflitos, amigos, estante e placar. |

Os testes automáticos cobrem tudo isso: cerca de 390 testes de unidade (`npm run check`) e 170 no navegador (`e2e/`).

## Como continuar

1. Ramo novo a partir do main, mudança pequena, `npm run check` e os testes e2e da área mexida.
2. Pedido (PR) para o main, com a descrição em português: o que muda, para quem, o que foi testado.
3. Conferir no celular (360–390 px): é onde a maioria usa.

Ao pedir uma mudança a um assistente, ajuda mandar a foto da tela, dizer a área (“Mundo › Ligações”) e pedir uma coisa por vez.

## Ideias que ficaram na fila

Vieram do quiz de opinião e das conversas, mais ou menos em ordem de valor:

1. **Achar as funções:** agrupar o menu “Mais”, ter uma lista “Todas as ferramentas” em Ajustes e explicar melhor “Simples ou Completo” (o quiz disse: “não entendi” e “o menu Mais confunde”).
2. **Wiki com link:** publicar a wiki online, com um endereço para mandar aos jogadores, além do arquivo.
3. **Primeira vez mais curta:** menos coisas na tela do primeiro universo, com as ferramentas aparecendo conforme o uso.
4. **Mundo:** idiomas e nomes por cultura, e linha do tempo por região.

## O que ainda não foi testado de verdade

- Duas pessoas ao vivo, ao mesmo tempo: na Mesa, no Mundo a quatro mãos e com conflitos na nuvem.
- O AU com contas de verdade, no servidor de verdade (o teste usa um servidor de mentira). Também falta canonizar histórias inteiras do AU: hoje vão fichas, ligações, datas e fatos.
- Os arquivos abertos em outros programas:
  - EPUB num leitor de e-book;
  - Word no Word;
  - .md no Obsidian;
  - a wiki no Safari e no Firefox;
  - o PDF numa gráfica.
- O app instalado (PWA) no iPhone, e o Folhear em celulares mais fracos.

## Cuidados que valem lembrar

- Os dados ficam no navegador: sem conta, o backup (Ajustes → Seus dados) é o que protege o trabalho.
- `src/styles/views.css` é grande: blocos novos vão no fim, com um título em comentário.
- Campo novo no esquema é sempre opcional, para universos antigos continuarem abrindo.
