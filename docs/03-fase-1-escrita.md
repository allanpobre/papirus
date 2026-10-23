# Fase 1 — Escrita

Status: **E1 a E5 entregues na versão 1** (ver detalhes abaixo e no README).

### O que a E1 já entrega
- Editor de cena com TipTap: negrito, itálico, tachado, citação, listas e separador de cena (`* * *`, ou `---` numa linha vazia).
- Histórias com cenas e cenas soltas; remover uma história nunca apaga as cenas (elas viram cenas soltas).
- Salvamento automático local (IndexedDB, com localStorage como alternativa), versão anterior preservada, cópia de emergência síncrona ao fechar a página e pedido de armazenamento persistente ao navegador.
- Formato salvo versionado e validado, com estrutura de migrações.
- Exportação da cena ou de tudo em Markdown, e backup completo em JSON.

### Entregue depois da E1
- E2: margem viva e espiar ficha (Ctrl/⌘ + clique num nome).
- E3: captura de fatos pela seleção, com fala tratada como afirmação de personagem; menções como *marks*.
- E4: revisão sob demanda (nomes novos, perguntas de continuidade, pendências).
- E5: ritmo e presença na área Organizar.
- Extra: versões de cena com comparação, leitura e ensaio.

### Ainda em aberto
- Comentários inline no texto.
- Importação de livros inteiros com extração assistida.

## Regras da fase

1. Nada interrompe durante a digitação.
2. Tudo é reversível; nada vira canon sem confirmação.
3. Funciona inteiro sem IA.
4. O sistema só fala quando o autor pede, ou num momento que o autor escolheu.
5. **Liberdade:** cada recurso desta fase é opcional e pode ser desligado individualmente (ver [01-principios.md](01-principios.md)).

## 1. Editor

- Formatação mínima: itálico, negrito, separador de cena, diálogo.
- Menções confirmadas armazenadas no texto; destaques de detecção apenas visuais (não persistidos).
- Comentários inline, undo confiável, uso por teclado, desempenho em cenas longas.
- **Recomendação:** ProseMirror via TipTap — *marks* para menções confirmadas, *decorations* para detecção; caminho para sincronização/colaboração via Yjs.
- **Unidade de documento:** a cena. Capítulos, atos e livros são contêineres. Cenas soltas, sem livro ou capítulo, também são permitidas.
- **Formato:** JSON do editor + projeção em texto puro para busca/detecção + exportação Markdown.
- **Migração:** texto simples → parágrafos; âncoras reposicionadas por citação literal + contexto; ambíguas marcadas para revisão.

## 2. Margem viva

- Margem recolhida por padrão: faixa fina com contadores discretos. Pode ser desligada por completo.
- Conteúdo conforme o parágrafo do cursor: quem está presente, onde e quando, sementes abertas relacionadas. (O que o POV sabe entra na fase de Conhecimento.)
- Atualiza após pausa na digitação ou mudança de parágrafo, sem animação.
- **Espiar ficha:** clique ou atalho abre um resumo sobreposto; Esc volta ao ponto exato do cursor.
- **Modo foco:** a margem desaparece.

## 3. Captura de fatos

- Selecionar texto + atalho ou botão de seleção → proposta estruturada (ex.: *Vaelor · nasceu em · Ostria*). O autor ajusta, confirma ou descarta.
- Trecho dentro de diálogo → padrão é "afirmação de *quem fala*", não canon.
- **Anotar como pendente:** guarda o trecho numa fila sem estruturar — para estruturar depois ou nunca.
- Formato: sujeito, relação, valor, fonte (cena + âncora), quem afirma, canon, estado editorial.
- Relações são livres: o autor pode digitar qualquer relação, não só as de uma lista.
- IA opcional, só para sugerir estrutura de frases complexas.

## 4. Perguntas de continuidade

- Tipos iniciais (só com dados já registrados): presença simultânea em dois lugares, cronologia (morto aparecendo, idade incoerente), deslocamento (apenas se o autor registrou distâncias).
- Formuladas como pergunta, nunca como erro.
- Respostas: **erro** (lista de correções ligada ao trecho), **intencional** (não pergunta de novo), **explicação** (texto livre, pode virar fato), **depois**.
- Cada tipo de pergunta pode ser desligado.
- Respostas ficam ligadas à âncora; se o trecho mudar, a pergunta é reavaliada.

## 5. Revisão de fim de sessão

- Reúne nomes novos, perguntas de continuidade e fatos pendentes.
- Resolução em lote ou adiamento de tudo.
- Reaproveita a descoberta de referências existente.
- Quando aparece é escolha do autor (sob pedido, ao fechar a cena, ao sair do modo Escrever, ou nunca).

## 6. Ritmo e presença

- Apenas no modo Organizar, nunca em Escrever.
- Matriz capítulos × personagens, sementes abertas há muito tempo, distribuição de POV, tamanho de cenas.
- Somente leitura; nenhuma sugestão de correção.

## Entregas

| Etapa | Entrega |
|---|---|
| E1 | Editor TipTap, migração, menções como marks, exportação Markdown |
| E2 | Margem viva + espiar ficha |
| E3 | Captura de fatos + fila de pendentes |
| E4 | Revisão de fim de sessão + perguntas de continuidade |
| E5 | Ritmo e presença |

## Decisões em aberto

1. TipTap ou Lexical? (recomendado: TipTap)
2. Comentários inline na E1 ou depois?
3. Status padrão de fato capturado na voz do narrador? (recomendado: canon "estabelecido no texto", editorial "provisório" — sempre editável)
4. Padrão da revisão de fim de sessão? (recomendado: sob pedido)
