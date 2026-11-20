# Auditoria 13 — Trazer de outros apps

Playwright a 390×844 em universo novo. Arquivos de teste feitos à mão (fora do repositório): nota `.md`, cofre `.zip` com pasta e imagem, arquivo vazio, `.zip` quebrado, `.json` cortado, `.md` de 36 MB. 20/11/2026.

## Funciona bem

- **Onde achar**: no Início, "Trazer de outro app" (junto de "Plantar a semente" e "Escrever uma lenda").
- **Explicação em uma frase**: "Do Obsidian (notas .md ou o cofre em .zip), do Kanka ou do World Anvil (exportação em .json ou .zip). Cada nota vira uma ficha, com o tipo tirado da pasta ou da categoria; as menções viram links sozinhas."
- **Antes de trazer, mostra o que achou** e pede confirmação: "Achei 1 ficha (…)" + botão "Trazer 1 ficha" / "Cancelar". Nada entra sem tocar.
- **Arquivos ruins** têm mensagem clara, em vermelho:
  - vazio: "Não achei fichas nesses arquivos. Use notas .md, exportações .json ou um .zip."
  - `.zip` quebrado e `.json` cortado: "Não consegui ler esses arquivos."
- **Cofre em .zip** com 2 notas e uma imagem: "Trazer 2 fichas".
- **Arquivo gigante (36 MB de Markdown)** foi lido em menos de 4 s e virou 1 ficha, sem travar a tela.
- **Specs existentes** (cofre do Obsidian em .zip, Kanka, World Anvil): 3 passam, inclusive segredos (privado vira segredo) e menções preservadas.
- Sem rolagem lateral.

## Defeitos

1. *(baixa, português)* **"Achei 1 ficha (Obsidian (Markdown)): 1 conceitos."** — plural errado quando há só um item, e "conceitos" é um tipo interno que o usuário não escolheu. **Consertado neste PR**: o resumo usa o singular ("1 conceito"). Arquivo: `src/views/ForeignImport.tsx`.
2. *(descartado depois)* **A mensagem de erro anterior continua na tela** quando o arquivo seguinte dá certo: depois de um arquivo vazio, o aviso vermelho "Não achei fichas…" ficou por cima da tela mesmo com "Achei 1 ficha" aberto. Devia sumir ao escolher outro arquivo. **Depois conferi:** é um toast que some em poucos segundos; a auditoria carregou os arquivos em sequência rápida. Não é defeito.

## Confuso ou difícil

- **A janela repete o título**: "Trazer de outro app" no alto da janela e "Trazer de outro app" no cartão de dentro.
- **O tipo "conceito"** (o que sobra quando o tipo não é reconhecido) não aparece na lista de tipos de ficha do app com esse nome para quem escreve; vale trocar por "Outro" ou "Ficha".
- **Não diz o que se perde.** O resumo cita "N com imagem", "N eram privadas" e "N arquivos ficaram de fora (moldes, configurações…)", o que é ótimo, mas não diz se **links entre notas** e **campos** (propriedades do Obsidian) foram levados.
- Dois campos de arquivo na janela (um para imagens, outro para notas); não deu para ver na tela qual é qual sem ler o `accept`.

## Pode mudar

- Limpar o aviso vermelho ao escolher um novo arquivo.
- "Tipo não reconhecido: Outro" no lugar de "conceito".
- Um resumo "O que não veio" (links quebrados, imagens não achadas) depois de trazer.

## Consertado neste PR

- **"1 conceitos"** (defeito 1): teste `e2e/importar-singular.spec.ts` (falha antes, passa depois). Também rodei `importar-arquivos.spec.ts`: passa.

## Não testado

- Importar o livro do Word (.docx) e Markdown por "Importar" no Publicar (só o caminho das fichas foi usado).
- Exportações reais do Kanka e do World Anvil (só as das specs).
- O que se perde em links, campos e imagens no cofre do Obsidian.
- Arquivo corrompido por dentro mas com a extensão certa (apenas um `.zip` falso e um `.json` cortado).
