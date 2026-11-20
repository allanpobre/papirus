# Auditoria 22 — Os exemplos

Os três exemplos (`/app/?exemplo`, `?exemplo=alienista`, `?exemplo=ostria`) abertos a 390×844. Para cada um: contagens do Início, cada área do Mundo, Trama, Mesa, Publicar, erros de página, e uma busca nos arquivos `src/model/sample*.ts` por dados das oficinas novas. 20/11/2026.

## O que cada exemplo tem

| | Oz (principal) | O Alienista | Ostria |
|---|---|---|---|
| Fichas / mapa / eventos / ligações | 74 / 1 / 16 / 58 | 30 / 1 / 11 / 34 | 17 / 1 / 9 / 20 |
| Livros | 4 (3 + "A Rainha Zixi de Ix") | 1 (13 capítulos, 16.767 palavras) | 1 (**sem livro criado**) |
| Mapa: lugares / **rotas** | 7 / **0** | 7 / **0** | 5 / **9** |
| Mesa | grupo de 3, sessão 2 pronta | grupo de 3, sessão 2 | grupo de 3, sessão 2 |
| Erros de página | 0 | 0 | 0 |

## Funciona bem

- **Os três abrem sem erro e com todas as áreas cheias** (nenhuma tela vazia no Mundo, Ligações, Linha do tempo, Mapas, Trama e Mesa).
- **Oz** é uma ótima vitrine de escala: 74 fichas, 4 livros, mapa, mesa pronta, livro pronto no Publicar com capa gerada.
- **Alienista** mostra o Publicar inteiro (13 capítulos, "Revisar: Reticências e espaços", Diagramar, Ler, Folhear, Baixar).
- **Ostria** é a melhor vitrine do Mundo: segredos, mapa com rotas e dias, causa de um evento, religião, datas e ligações de período.
- Todos têm uma mesa de RPG pronta ("sessão 2 planejada") para **Começar agora** sem preparar nada.

## Defeitos

Nenhum de gravidade alta ou média. As lacunas abaixo são de **vitrine**, não de quebra:

1. *(média, produto)* **As oficinas do "Mundo mais fundo" quase não aparecem nos exemplos.** Procurando nos arquivos dos exemplos:
   - **Língua** (`language`): em nenhum dos três.
   - **Festas / cultura** (`feasts`, fichas do tipo Cultura): em nenhum.
   - **Tensões** ("em paz/tensão/guerra com"): em nenhum.
   - **Rotas e dias de viagem**: só no Ostria. **Oz e Alienista: nenhuma rota**, embora Oz tenha a "Estrada de tijolos amarelos" e seja o exemplo principal.
   - **Causa → consequência** (`causes`) nos eventos: só no Ostria, 1 caso.
   - **Religião / Panteão**: só o Ostria ("Fé da Maré"); Oz não tem nenhuma.
   Quem abre o Oz para conhecer o app nunca vê a Língua, o Panteão, o Poder e tensões nem as festas.
2. *(baixa)* **O Ostria abre o Publicar vazio** ("Estante vazia"), ao contrário do Oz e do Alienista.

## Confuso ou difícil

- **O Ostria é o único exemplo "de fantasia para o Mundo" e não tem livro; o Oz tem livro e não tem as oficinas.** Para ver tudo é preciso abrir dois exemplos.
- **A vitrine do Mundo está no exemplo mais difícil de achar:** o Início oferece "Abrir um universo de exemplo" (Oz) e "Ou um romance: O Alienista"; o Ostria só abre pela URL `?exemplo=ostria` (os "testes" da CLAUDE.md). Um novato nunca chega ao Ostria.
- **"O que falta para um novato entender o app só com o exemplo":** hoje o Oz mostra bem escrever, Mundo, Mapa e Mesa; falta ele mostrar Língua, Cultura, Panteão, Poder e tensões, Faixas com causas e Rolar no mundo com tabelas próprias.

## Pode mudar

- Acrescentar ao **Oz** (o principal), em dados, sem mexer no texto:
  - uma **rota** "Estrada de tijolos amarelos" (com dias a pé) e outras entre as cidades;
  - uma **Cultura** para os Munchkins ou os Winkies, com língua, festas e "um dia na vida";
  - um **panteão** curto (as quatro Bruxas e Glinda como "poderes" do mundo) ou crenças dos povos;
  - **tensões** (Oeste × Munchkins, Winkies × Quadlings) e uma **causa** ("A casa cai" → "A Bruxa do Leste morre").
- Dar ao Ostria um **livro** (Livro I) já criado no Publicar.
- Mostrar o Ostria como terceiro exemplo no Início ("Um mundo de fantasia só para ver as ferramentas").

## Consertado neste PR

Nada.

## Não testado

- Leitura do texto dos exemplos (tradução, formatação) e a Mesa ao vivo.
- Se "Recomeçar o exemplo" restaura tudo (só vi o botão).
- A wiki de cada exemplo (só do Ostria, no 10).
- Os exemplos em Nova cara.
