# Papirus — Resumo Geral do Programa

## 1. Visão do produto

**Papirus é um ambiente de worldbuilding e escrita contextual** para escritores, mestres de RPG e criadores de universos ficcionais. Ele ajuda a organizar uma lore já existente e conectar personagens, lugares, instituições, acontecimentos e histórias. Não deve substituir a criatividade do autor nem inventar um mundo inteiro por conta própria.

O autor decide o que é verdade, o que é canon e o que permanece misterioso. O sistema pode sugerir relações e apontar possíveis problemas, mas não transforma sugestões em fatos automaticamente.

**Princípio central: escrever primeiro, estruturar quando for útil.**

## 2. Organização do universo

A estrutura contextual é:

- **Universo:** conjunto completo da lore.
- **Realm:** mundo, plano ou dimensão.
- **História:** obra narrativa situada em um ou mais realms.
- **Manuscrito:** livros, atos, capítulos e cenas.

É possível ver o universo inteiro, um realm ou uma história. Fichas compartilhadas mantêm o mesmo ID; não são duplicadas para cada história. O contexto é uma forma de visualizar os dados, não uma cópia. Para explorar versões alternativas da realidade, existe **What If**.

A interface agrupa as áreas em menus recolhíveis e oferece modos **Explorar**, **Escrever** e **Organizar**, além de um modo de foco que esconde distrações durante a escrita.

## 3. Fichas e lore

O universo é composto por fichas de entidades, incluindo:

- Personagens e grupos;
- Reinos, cidades, regiões e outros lugares;
- Casas, famílias, facções e organizações;
- Culturas e religiões;
- Sistemas de magia;
- Eventos históricos e eras;
- Artefatos e objetos;
- Segredos, tramas e fontes;
- Outros tipos extensíveis.

As fichas podem conter nome, resumo, descrição, tags, datas, metadados e referências a outras fichas. O usuário pode criar uma ficha mínima e completá-la depois.

Dois estados são independentes:

- **Canon:** natureza da informação no universo — por exemplo, estabelecida, rumor, lenda, disputada, secreta, falsa ou desconhecida.
- **Estado editorial:** maturidade do conteúdo — por exemplo, rascunho, provisório ou não decidido.

Uma informação pode estar editorialmente bem documentada sem ser verdade canônica. O sistema não deve obrigar o autor a preencher todos os campos.

## 4. Relações, Atlas e Timeline

### Relações e grafo
Entidades podem ter relações explícitas, como parentesco, aliança, rivalidade, serviço, autoria, causalidade, participação e localização. Referências estruturadas, como local de nascimento ou participantes de um evento, também podem aparecer como conexões derivadas. O grafo permite explorar vizinhanças e relações entre entidades; genealogias usam os mesmos registros.

### Atlas
O Atlas mostra o mapa do universo, lugares, reinos, conexões geográficas e camadas temáticas, como culturas, religiões, conflitos, magia e população. A geometria atual deriva de um sistema procedural anterior; ainda não existe um editor cartográfico livre nem reconstrução automática de fronteiras históricas.

### Timeline
A Timeline reúne eventos, eras, intervalos, importância, filtros e comparação temporal. A timeline de uma entidade deriva dos mesmos eventos e vínculos do restante do sistema. Selecionar um ano para explorar não avança o calendário canônico nem executa uma simulação automaticamente.

## 5. Conhecimento, fontes, segredos e revelações

É possível registrar o que um personagem ou grupo sabe, quando aprendeu ou esqueceu algo, em qual história ocorreu e qual fonte ou crença está associada ao conhecimento.

Revelações podem ser relacionadas ao leitor, a um grupo de jogadores ou ao Codex público, com limites por história, data ou ordem narrativa. O sistema distingue a verdade autoral do que um personagem ou leitor sabe, suspeita ou acredita.

Fichas de fontes registram dados como autor, perspectiva e confiabilidade. O sistema pode identificar fontes que discordam sobre uma afirmação, mas não decide sozinho qual está dizendo a verdade.

**Limite:** parte do controle de divulgação ainda funciona no nível da ficha inteira. Se um segredo estiver escrito na descrição de uma ficha pública, o sistema não consegue garantir que apenas esse trecho seja ocultado. A perspectiva é uma ferramenta editorial, não um sistema completo de permissões entre usuários.

## 6. Manuscrito e escrita contextual

O Manuscrito contém livros, atos, capítulos e cenas. O editor atual usa **texto simples com autosave**, seleção de trechos e ferramentas contextuais na margem; ainda não é um editor rico completo.

Lentes contextuais disponíveis incluem:

- **Elenco:** personagens ligados à cena, presença registrada e último local conhecido;
- **Atlas:** lugares associados à cena;
- **Timeline:** eventos relevantes para a data narrativa;
- **Relações:** conexões relevantes;
- **Conhecimento:** informações registradas para o ponto de vista (POV);
- **Continuidade:** algumas verificações de cronologia e localização;
- **Tramas e objetos:** sementes narrativas, artefatos e vínculos;
- **Fontes:** fontes relacionadas;
- **Rascunhos:** notas, outline, trechos guardados e versões alternativas.

As lentes reutilizam os registros do Papirus; não criam cópias de entidades ou timelines.

### Menções e descoberta de novas referências

O sistema procura nomes e aliases conhecidos e permite vincular trechos a fichas. O autor confirma as anotações; a detecção não cria fatos canônicos. As âncoras guardam a citação literal e contexto para tentar manter a ligação quando o texto muda. Se a correspondência ficar ambígua, a anotação é destacada para revisão em vez de ser reassociada silenciosamente.

Também existe descoberta local de referências ainda não cadastradas. Após uma pausa na digitação, o sistema analisa o texto localmente, agrupa candidatos e exibe discretamente quantas referências merecem revisão. **Não chama uma IA a cada tecla e não abre popups durante a escrita.**

Na revisão, o autor pode criar uma ficha em rascunho, vincular uma ficha existente, manter a referência em aberto, ignorá-la ou revisar vários candidatos em lote. A detecção usa heurísticas e pode errar ou deixar passar nomes. A decisão final é sempre do autor.

### Identidades narrativas e mistérios

Uma pessoa pode aparecer por nome, título, epíteto, alias, identidade falsa ou identidade secreta. Essas formas podem ser representadas como **identidades/personas narrativas** ligadas a uma entidade, mas nomes diferentes não são fundidos automaticamente quando há dúvida.

Exemplo: “The Pale Man” pode continuar misterioso e, capítulos depois, ser associado a Vaelor. O texto antigo permanece igual. O vínculo autoral é separado do que um personagem ou leitor sabe, suspeita ou acredita. Uma crença falsa pode continuar registrada mesmo quando o autor conhece a verdade.

Uma identidade intencionalmente misteriosa não é considerada erro nem campo obrigatório a resolver.

### Rascunhos e ensaio

O Manuscrito oferece scratchpad, outline, trechos salvos (*scraps*) e versões alternativas de cenas. As versões permitem comparar texto guardado com texto atual e preservar o conteúdo antes de uma troca. O ensaio oferece leitura instantânea, gradual ou pausada, navegação por segmentos e marcações para voltar a um trecho. A identificação de falas usa padrões textuais simples; não há voz sintetizada nem atuação de personagens.

## 7. Lore Inbox, sessões e sementes narrativas

A **Lore Inbox** recebe capturas rápidas e arquivos `.txt` ou `.md`. O autor pode pedir a um provedor de IA para extrair propostas de entidades e relações. O autor revisa as propostas antes de confirmá-las; novas fichas e relações não viram canon automaticamente. O original é preservado como fonte, e a extração tem limites de tamanho — não processa automaticamente um livro inteiro.

O modo **Sessão** registra sessões de RPG/jogo. Ao encerrar, a transcrição vai para a Inbox para revisão, sem criar eventos canônicos automaticamente.

As **sementes narrativas** conectam uma preparação a um payoff futuro e podem estar abertas, parciais, resolvidas ou abandonadas. A área de mistérios organiza questões e pistas em fichas, mas ainda não oferece um quadro livre de investigação com hipóteses posicionadas.

## 8. Archivist — IA generativa

O Archivist ajuda a investigar a lore, comparar fontes, encontrar lacunas e contradições, explorar conexões, consequências, conhecimento e impacto narrativo. É opcional: os recursos determinísticos do Papirus continuam utilizáveis sem IA.

Os provedores documentados incluem OpenAI, Google Gemini, Anthropic, OpenRouter, Ollama e LM Studio/endpoints locais compatíveis. Chaves remotas são armazenadas no servidor de forma cifrada e separadas por usuário/provedor. Modelos locais são chamados diretamente pelo navegador e exigem que o runtime local esteja instalado e ativo. Uma falha local não deve provocar fallback automático para a nuvem.

O contexto enviado ao Archivist é limitado e construído a partir dos registros relevantes. Filtros de perspectiva e segredo são aplicados antes da seleção, mas o texto livre que o autor colocou explicitamente no manuscrito ou em uma ficha deve ser revisado antes do envio. A IA não altera a prosa nem o canon sem uma ação explícita.

O sistema distingue fatos registrados de inferências, sugestões, possibilidades, contradições e desconhecidos.

## 9. What If, versões e persistência

**What If** permite criar branches isoladas, explorar intervenções e considerar futuros alternativos sem alterar imediatamente o estado principal. Parte do motor numérico antigo — economia, população, diplomacia, guerra e eventos — permanece dentro de World Dynamics/What If. As antigas telas do simulador clássico foram retiradas da navegação principal.

Os universos são armazenados localmente no navegador, usando IndexedDB com fallback para localStorage. Há autosave, controle de revisão, histórico de recuperação, snapshots automáticos e nomeados, comparação, restauração e exportação/importação JSON.

**Não há sincronização em nuvem nem colaboração multiusuário implementada.** O histórico local não substitui um backup externo; o usuário deve exportar os dados regularmente.

## 10. Arquitetura técnica em linhas gerais

A aplicação web usa principalmente **React e TypeScript**, com módulos para escrita, menções, âncoras, identidades, contexto, persistência e provedores de IA. O modelo de mundo é validado por schemas e evolui por migrações versionadas, preservando IDs e registros existentes.

A escrita e a descoberta de referências devem continuar funcionando localmente sem chamadas generativas. A IA só é chamada quando o usuário solicita uma ação que precisa de um modelo. A arquitetura é modular; não é necessário convertê-la em microserviços para continuar evoluindo.

## 11. Limitações conhecidas

- Editor de texto simples; sem editor rico completo, comentários inline ou destaques semânticos avançados.
- Detecção lexical/heurística, não compreensão linguística perfeita.
- Fusão sugerida entre nomes diferentes e revisão de candidatos por IA em lote ainda são evoluções futuras.
- Continuidade cobre algumas regras; não é um motor geral de logística, inventário ou magia.
- Atlas sem edição cartográfica livre nem reconstrução automática de fronteiras históricas.
- Conhecimento e divulgação ainda não são estruturados por afirmação individual em todos os módulos.
- Sem sincronização remota ou colaboração.
- A documentação registra testes automatizados, TypeScript, lint e build, mas a prévia de navegador estava indisponível; não se deve presumir que todas as telas foram verificadas visualmente em navegador real.

## 12. Orientações para a IA que for trabalhar no projeto

1. Audite o repositório real antes de codificar e compare o código com esta visão geral.
2. Não trate funcionalidades planejadas como implementadas; confirme o estado no código.
3. Não reconstrua tudo nem crie sistemas paralelos de entidades, menções, manuscrito ou persistência sem necessidade.
4. Preserve IDs, dados existentes, exportações e migrações; mudanças no schema devem considerar saves antigos.
5. Trabalhe em incrementos pequenos: investigar, explicar a causa, corrigir, adicionar testes e executar typecheck, lint, build e testes.
6. Quando possível, valide em navegador real: teclado, foco, responsividade e ações visíveis.
7. Priorize a experiência de escrita: sem interrupções automáticas, sem canonização sem confirmação e sem obrigação de resolver mistérios.
8. Preserve a diferença entre verdade autoral, crença de personagem, informação do leitor e sugestão da IA.
9. Prefira arquitetura modular e simples. Introduza novas linguagens ou infraestrutura apenas quando resolverem um problema concreto.

**Princípio de produto:** o autor deve sentir que está escrevendo enquanto o Papirus presta atenção — não que está preenchendo um banco de dados.
