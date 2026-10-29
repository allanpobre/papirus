import { modKey } from '../ui/keys'

/** Um passo do tour de uma tela: o que destacar (seletor) e o que dizer. */
export interface PageStep {
  /** Sem alvo (ou com o alvo fora da tela), o balão fica no centro. */
  target?: string
  title: string
  body: string
  /** Pula o passo quando o alvo não está na tela (partes que só existem com conteúdo). */
  optional?: boolean
}

export interface PageTourDef {
  title: string
  steps: PageStep[]
}

/** O caminho até os nomes novos, que o Papirus conta mas não marca no texto. */
const NOMES_NOVOS =
  'O Papirus não marca nomes novos no texto: ele conta. Na margem, o botão Revisar mostra “1 nome novo” quando aparece uma palavra com maiúscula, no meio da frase, que ainda não tem ficha. Toque para ver a lista e, para cada nome, criar a ficha, juntar como apelido de outra ficha ou ignorar. No celular, abra a margem pelo botão no alto da página.'

/**
 * Os tours de cada tela, abertos pelo botão (?) dela. Só explicam o que está na tela;
 * não trocam de tela nem mexem em nada.
 */
export const PAGE_TOURS = {
  // ─── Dentro de um universo ────────────────────────────────────────
  inicio: {
    title: 'Início',
    steps: [
      { target: '.home-chips', title: 'O seu dia', body: 'As palavras escritas hoje (com a meta, se você tiver uma) e quantos dias seguidos você escreveu.' },
      { target: '.home-quick', title: 'Atalhos', body: `Anotar uma ideia, buscar em tudo (${modKey} K), compartilhar o universo com alguém e pôr uma capa.` },
      {
        target: '[data-tour="continuar"]',
        title: 'Onde você parou',
        body: 'A última cena em que você mexeu, com o fim do texto. Continue, comece uma cena nova ou leia o livro como um leitor, sem spoiler. Numa campanha sem texto, aqui aparece a próxima sessão da mesa.',
      },
      { target: '.home-challenge', title: 'Treino de hoje', body: 'Uma proposta por dia num sprint com tempo e um mínimo de palavras ou caracteres. Cada tentativa fica guardada, e o texto pode virar uma cena.' },
      { target: '.home-doors', title: 'O seu mundo', body: 'Cada parte do universo, com quanto já tem nela. Toque para ir até lá.' },
      { target: '.home-day', title: 'Seu ritmo', body: 'O prazo (se você tiver uma meta com prazo), o calendário de quanto escreveu em cada dia e o seu progresso.' },
      { target: '.home-tip', title: 'Dica do dia', body: 'Uma dica da Oficina, puxada pelo gênero do seu mundo. “Ver mais” abre a Oficina.', optional: true },
      { target: '[aria-label="Pede atenção"]', title: 'Pede atenção', body: 'Perguntas de continuidade, ideias esperando, fichas em rascunho, tramas abertas e a próxima sessão da mesa. Toque para resolver.', optional: true },
      { target: '[aria-label="Mexido por último"]', title: 'Mexido por último', body: 'As cenas e fichas em que você mexeu por último, para voltar rápido.', optional: true },
    ],
  },
  escrever: {
    title: 'Escrever',
    steps: [
      { target: '.write-tree', title: 'Manuscrito', body: 'Histórias, capítulos e cenas, na ordem do livro. Toque numa cena para abrir. O botão no canto da barra esconde ou mostra esta lista.', optional: true },
      { target: '[data-tour="editor"]', title: 'A página', body: `Escreva aqui; o título fica em cima. Os nomes das fichas que você já tem ficam com um sublinhado pontilhado. ${modKey} + clique num nome abre a ficha.` },
      {
        target: '.scene-text',
        title: 'Selecione um trecho',
        body: 'Aparece uma barra para: Vincular o trecho a uma ficha, guardar um Fato (com quem disse e se é verdade), criar uma Ficha, Comentar ou Guardar em Ideias. No celular, a barra fica em cima do teclado. Nada vira ficha sozinho.',
      },
      { target: '.margin-review, [aria-label="Mostrar margem"]', title: 'Nomes novos', body: NOMES_NOVOS },
      { target: '[data-tour="margem"]', title: 'A margem', body: 'Quem aparece no parágrafo e na cena, comentários, leitores beta, pistas ligadas a quem está em cena e perguntas de continuidade. Dá para fechar.', optional: true },
      {
        target: '.write-bar-actions',
        title: 'Detalhes da cena',
        body: 'Estado, história, ponto de vista, local, data, elenco, sinopse e notas. No menu de três pontos: versões da cena, ler, exportar e apagar. Ao lado, o modo foco e a margem.',
      },
      { target: '.write-foot', title: 'Rodapé', body: 'As palavras da cena e as de hoje (com a meta), e o Sprint: escrever sem parar por alguns minutos.' },
    ],
  },
  'escrever-vazio': {
    title: 'Escrever',
    steps: [
      { target: '.write-welcome .btn', title: 'A primeira cena', body: 'Cria uma cena solta e abre a página para escrever. Histórias e capítulos podem vir depois, no Manuscrito, ou nunca.' },
      {
        title: 'Depois da primeira cena',
        body: 'Esta tela vira a página de escrever. O (?) passa a mostrar o texto, a barra da seleção, os nomes novos (contados no botão Revisar da margem), os detalhes da cena e o rodapé com as metas e o Sprint.',
      },
    ],
  },
  organizar: {
    title: 'Estrutura',
    steps: [
      { target: '.organize-view .tabs', title: 'Três jeitos de ver', body: 'Quadro de cenas (como fichas de cortiça), Presença (quem aparece em cada cena) e Ritmo (o tamanho das cenas, os pontos de vista e as tramas abertas).' },
      { target: '.corkboard', title: 'Quadro de cenas', body: 'Cada cartão é uma cena, agrupada pela história. Arraste pela alça ⠿ para mudar a ordem ou levar para outra história; no teclado, use as setas na alça.', optional: true },
      { target: '.organize-view .table-wrap', title: 'Presença', body: 'Cada linha é uma cena e cada coluna um personagem: ponto de vista, presente ou só mencionado. Bom para ver quem sumiu da história.', optional: true },
      { target: '.rhythm', title: 'Ritmo', body: 'O tamanho de cada cena, quantas cenas cada ponto de vista tem e as tramas ainda abertas.', optional: true },
      { title: 'Tudo vem das cenas', body: 'Estado, história, ponto de vista e elenco são os Detalhes da cena, no Escrever. Mudou lá, muda aqui.' },
    ],
  },
  livro: {
    title: 'Livro',
    steps: [
      { target: '.book-view .view-head .btn', title: 'Novo livro', body: 'Junte histórias num livro à parte, com a sua capa. Uma série pode ter um livro por volume, todos com o mesmo estilo.', optional: true },
      { target: '.shelf', title: 'Estante', body: 'Com mais de um livro, escolha aqui qual ver.', optional: true },
      { target: '.book-hero', title: 'Seu livro', body: 'A capa e as contas do livro: capítulos, palavras e páginas. Toque na capa para diagramar. Ainda sem livro? “Criar o livro” junta as histórias com uma capa.' },
      {
        target: '[data-tour="livro-acoes"]',
        optional: true,
        title: 'O que dá para fazer',
        body: 'Diagramar e gerar o PDF, ler como leitor, Revisar (repetições, frases longas, aspas, travessões), baixar o e-book (EPUB) e começar o próximo volume com o mesmo estilo.',
      },
      { target: '.shelf-publish', title: 'No seu perfil', body: 'Com uma conta, escolha quem vê este livro no seu perfil: só você, os amigos ou todo mundo, com uma sinopse de contracapa.', optional: true },
      { target: '.book-how', title: 'Como funciona', body: 'Os passos para chegar ao livro pronto.', optional: true },
    ],
  },
  fichas: {
    title: 'Fichas',
    steps: [
      { target: '.split-list .quick-create', title: 'Nova ficha', body: 'Escreva o nome, escolha o tipo (personagem, lugar, facção, objeto…) e crie. Um nome basta; o resto vem quando for útil.' },
      { target: '.name-ideas', title: 'Sugerir nomes', body: 'Sem ideia de nome? O Papirus sugere nomes no estilo dos que você já tem e do gênero do mundo.' },
      { target: '[aria-label="Filtrar fichas"]', title: 'Achar uma ficha', body: 'Filtre por nome, apelido ou etiqueta. Os botões logo abaixo mostram só um tipo.' },
      { target: '.entity-list', title: 'A lista', body: 'Toque numa ficha para abrir ao lado (no celular, ela abre por cima).', optional: true },
      {
        target: '.mode-switch',
        title: 'Ler ou editar',
        body: 'Ler mostra a ficha como uma página de enciclopédia. Editar abre tudo: resumo, campos livres, segredos (só você vê), relações, fatos, o que ela sabe e as cenas em que aparece.',
        optional: true,
      },
      { title: 'Fichas nascem do texto também', body: 'No Escrever, selecione um nome e escolha “Ficha”. E os nomes novos que você ainda não cadastrou aparecem no botão Revisar da margem.' },
    ],
  },
  relacoes: {
    title: 'Relações',
    steps: [
      {
        target: '.graph-controls',
        title: 'Centrar e filtrar',
        body: 'Centre numa ficha para ver só quem está perto dela, e até que distância. “Incluir fica em” mostra onde cada lugar fica; “Só fichas com relações” esconde as soltas.',
      },
      { target: '.graph-mode', title: 'Ligações ou família', body: 'Com relações de família (pai de, casado com…), dá para ver a Árvore da família.', optional: true },
      { target: '.graph-bar', title: 'Tipos e tempo', body: 'Mostre ou esconda tipos de ficha. “Num ponto da história” mostra só o que vale numa cena, e o botão de tocar passa a história cena a cena.', optional: true },
      { target: '.graph-wrap', title: 'O mapa', body: 'Arraste as fichas para arrumar e o fundo para mover. Os botões + e − aproximam e afastam. Toque numa ficha para ver as relações dela.', optional: true },
      { title: 'De onde vêm', body: 'As relações nascem nas fichas: no modo Editar, adicione “irmão de”, “serve a”, “rival de”… Elas aparecem aqui sozinhas.' },
    ],
  },
  timeline: {
    title: 'Linha do tempo',
    steps: [
      { target: '.timeline-view .quick-create', title: 'Novo evento', body: 'O nome e o ano, no calendário do seu mundo. Toque num evento para mudar o tipo (uma Era é uma faixa de tempo), a importância, quem participa e onde.' },
      { target: '.timeline-filters', title: 'Filtrar', body: 'Mostre só o que envolve certas fichas, só os eventos mais importantes, e escolha se as cenas com data aparecem.' },
      { target: '.era-strip', title: 'Eras', body: 'As faixas de tempo do mundo, uma por linha.', optional: true },
      { target: '.timeline', title: 'Ano a ano', body: 'Os eventos e as cenas com data narrativa. Toque num evento para editar; numa cena, para abrir no editor.', optional: true },
      { title: 'O calendário', body: 'Meses, dias e o rótulo dos anos (como “DC”) ficam em Ajustes → Universo. O Papirus avisa datas impossíveis.' },
    ],
  },
  atlas: {
    title: 'Atlas',
    steps: [
      { target: '.atlas-view .view-head', title: 'Mapas', body: 'Cada mapa numa aba. “Adicionar mapa” envia uma imagem: desenho à mão, Inkarnate, qualquer coisa.' },
      { target: '.atlas-toolbar', title: 'Marcar lugares', body: '“Marcar lugar” e toque no mapa para pôr um marcador ligado a uma ficha. Os botões − e + mudam o zoom, e os tipos mostram ou escondem marcadores.', optional: true },
      { target: '.atlas-route-pick', title: 'Caminho de', body: 'Escolha um personagem: o trajeto dele pelas cenas aparece no mapa, numerado na ordem.', optional: true },
      { target: '.atlas-scroll', title: 'O mapa', body: 'Toque num marcador para ver a ficha, mudar o nome que aparece no mapa, Mover ou Remover. Com o mouse, dá para arrastar.', optional: true },
      { title: 'Na mesa', body: 'Numa campanha, o mestre revela o mapa aos jogadores; no Codex aparecem só os marcadores que a mesa já conhece.' },
    ],
  },
  tramas: {
    title: 'Pistas e mistérios',
    steps: [
      { target: '.seeds-view .quick-create', title: 'Plantar', body: 'Uma promessa ao leitor ou uma pergunta. Semente liga uma preparação a um pagamento futuro; Mistério junta pistas.' },
      { target: '.seeds-view .filter-chips', title: 'Mostrar', body: 'Todas, só as sementes ou só os mistérios.' },
      { target: '.board', title: 'O quadro', body: 'Colunas por estado: aberta, parcial, resolvida, abandonada. Toque num cartão para ligar as fichas envolvidas, a cena em que foi preparada, a cena em que se paga e as pistas. Nenhuma precisa ser resolvida.', optional: true },
      { title: 'Lembretes no texto', body: 'Quando alguém ligado a uma trama aberta volta a uma cena, ela aparece na margem do Escrever, para você não esquecer.' },
    ],
  },
  conhecimento: {
    title: 'Quem sabe o quê',
    steps: [
      {
        target: '.knowledge-view .tabs',
        title: 'Quatro jeitos de ver',
        body: 'Fatos (tudo o que você guardou), Quem sabe o quê (o que cada personagem sabe, suspeita ou acredita), O que o leitor sabe (até cada cena) e Versões que divergem.',
      },
      { target: '.knowledge-view .filters-row', title: 'Filtros', body: 'Mudam com a aba: texto, canon e estado nos fatos; a ficha e o ponto da história em Quem sabe o quê; a cena em O que o leitor sabe.', optional: true },
      { target: '.knowledge-view .table-wrap', title: 'Fatos', body: 'Cada fato com quem disse (ou o narrador), o canon (estabelecido, rumor, lenda, disputado, secreto, falso), o estado e a cena de onde veio.', optional: true },
      { title: 'De onde vêm', body: 'No Escrever, selecione um trecho e escolha “Fato”: o trecho fica guardado como fonte. Um fato falso dito por alguém aparece no Codex da mesa só como “segundo fulano”.' },
    ],
  },
  inbox: {
    title: 'Ideias',
    steps: [
      { target: '.inbox-capture', title: 'Anotar', body: `Escreva antes que fuja e guarde. De qualquer tela: ${modKey} Shift I.` },
      { target: '.inbox-view .view-head .btn', title: 'Importar', body: 'Traga notas de um arquivo .txt ou .md; textos longos viram vários itens.' },
      { target: '.inbox-view .filter-chips', title: 'Abertos e guardados', body: 'O que ainda espera, o que você já resolveu (Feito) e o que arquivou.' },
      { target: '.inbox-actions', title: 'O que fazer com cada ideia', body: 'Criar ficha, Virar cena, guardar como Fato ou procurar Nomes novos no texto. Depois, marque como Feito ou arquive. Nada vira ficha sozinho.', optional: true },
    ],
  },
  archivist: {
    title: 'Perguntar ao mundo',
    steps: [
      { target: '.archivist-view .view-head .btn', title: 'Chave e modelo', body: 'Usa a sua chave da API da Anthropic, guardada só neste navegador; cada pergunta é cobrada na sua conta. Escolha o modelo e a profundidade.' },
      { target: '.archivist-ask', title: 'Pergunte', body: 'Sobre a sua lore: quem sabe o quê, o que não fecha, como algo aconteceu. A resposta só lê; nunca muda nada no universo.' },
      { target: '.archivist-options', title: 'O que vai junto', body: 'Só vai o que tem a ver com a pergunta. Escolha fichas extras, se vão segredos e trechos do manuscrito, e veja exatamente o que será enviado antes.' },
      { target: '.archivist-history', title: 'Respostas', body: 'Ficam só nesta visita. Guarde em Ideias o que quiser manter.', optional: true },
    ],
  },
  config: {
    title: 'Ajustes',
    steps: [
      { target: '.settings-search', title: 'Procurar', body: 'Escreva o que procura (tema, backup, calendário) e só aparece o que tem a ver.' },
      {
        target: '.settings-nav ul',
        title: 'Categorias',
        body: 'Aparência (tema, cor, fonte, som ao digitar), Universo (nome, calendário, metas), Escrita (destacar nomes, procurar nomes novos, perguntas de continuidade), Menu e ajuda, Dados e backup, Lixeira e histórico, Livros e wiki, Conta e servidor.',
      },
      { target: '.settings-grid', title: 'Os ajustes', body: 'Tudo muda na hora e fica salvo. Apagar o universo pede confirmação.' },
      { title: 'Ajuda', body: 'Em Menu e ajuda dá para refazer o tour completo. Em cada tela, o botão (?) explica só ela.' },
    ],
  },

  // ─── Janelas que funcionam como tela ─────────────────────────────
  revisao: {
    title: 'Revisão',
    steps: [
      {
        target: '.modal .tabs',
        title: 'Três listas',
        body: 'Nomes novos (palavras com maiúscula, no meio da frase, que ainda não têm ficha), Perguntas de continuidade e Pendências (o que você marcou como erro, fatos em rascunho e ideias esperando).',
      },
      { target: '.review-toolbar', title: 'Onde procurar', body: 'Só nesta cena ou em todo o manuscrito. Marque vários nomes para criar as fichas ou ignorar de uma vez.', optional: true },
      {
        target: '.candidate',
        title: 'Cada nome novo',
        body: 'Quantas vezes aparece e um trecho onde está. Criar ficha (escolha o tipo), “É outro nome de…” (vira apelido de uma ficha), Deixar em aberto ou Ignorar (nunca mais sugerir; dá para desfazer em Ajustes → Escrita).',
        optional: true,
      },
      { title: 'Só uma sugestão', body: 'A busca é simples e pode errar ou deixar passar nomes. Nada é criado sem o seu clique.' },
    ],
  },
  versoes: {
    title: 'Versões',
    steps: [
      { target: '#version-name', title: 'Guardar o texto atual', body: 'Dê um nome (como “antes de mudar o final”) e guarde. Além disso, a cena guarda sozinha uma versão por dia.' },
      { target: '.version-list', title: 'As versões', body: 'Toque numa para comparar com o texto de agora.', optional: true },
      { target: '.version-detail', title: 'Comparar e voltar', body: 'O que entrou e o que saiu desde aquela versão. “Voltar para esta versão” guarda o texto atual como versão antes, então nada se perde.', optional: true },
    ],
  },
  'revisar-livro': {
    title: 'Revisar o livro',
    steps: [
      {
        target: '.review-group',
        title: 'Apontamentos',
        body: 'Agrupados por tipo: cenas vazias ou sem título, travessões, aspas, reticências, espaços, grafia, frases longas, palavras repetidas perto e cenas curtas.',
        optional: true,
      },
      { target: '.review-group .btn', title: 'Corrigir de uma vez', body: 'A tipografia (travessões, aspas, reticências, espaços) se corrige no livro todo com um toque, e dá para desfazer.', optional: true },
      { target: '.review-item', title: 'Ir até o trecho', body: 'Toque num apontamento para abrir a cena no lugar certo.', optional: true },
      { title: 'O livro é seu', body: 'São só apontamentos. Repetição pode ser estilo, e frase longa pode ser de propósito.' },
    ],
  },
  compartilhar: {
    title: 'Compartilhar',
    steps: [
      { target: '.share-intro', title: 'Três jeitos', body: 'Pode ver (lê tudo, não muda nada), Pode editar (escreve junto, ao vivo) e Link de leitura (quem tiver o link lê sem conta).', optional: true },
      { target: '.share-invite', title: 'Convidar', body: 'O e-mail da pessoa e o que ela pode fazer. Ela entra no Papirus com esse e-mail e o universo aparece em “Compartilhados com você”.', optional: true },
      { target: '.share-members', title: 'Quem tem acesso', body: 'Troque o que cada pessoa pode fazer, ou tire o acesso, quando quiser.', optional: true },
      { target: '[aria-labelledby="share-link"]', title: 'Link de leitura', body: 'Para quem não tem conta: leitores beta, a mesa de RPG. Abre como livro ou como o universo inteiro. Trocar o link faz o antigo parar de funcionar.', optional: true },
      { target: '[aria-labelledby="share-segredos"]', title: 'Segredos', body: 'Desmarcado, fichas, fatos e relações secretas e os trechos de segredo não saem do seu Papirus para quem só lê. Quem pode editar vê tudo.', optional: true },
      { title: 'Quem garante', body: 'Quem pode o quê é o servidor que garante, não só a tela.' },
    ],
  },
  entrar: {
    title: 'Entrar',
    steps: [
      { target: '.account-hero', title: 'A conta é opcional', body: 'Sem conta, tudo fica neste navegador. Com conta, os universos vão para todos os seus aparelhos e você ganha um perfil para amigos verem a sua estante.' },
      { target: '.account-tabs', title: 'Entrar ou criar', body: 'Já tem conta? Entre. Senão, crie em dois passos: o acesso e o seu perfil (o @ é como as pessoas te acham).', optional: true },
      { target: '.account-form', title: 'E-mail e senha', body: 'O olho ao lado da senha mostra o que você digitou.', optional: true },
    ],
  },
  conta: {
    title: 'Sua conta',
    steps: [
      { target: '.social-me', title: 'Você', body: 'O seu nome, o seu @ e o e-mail da conta.' },
      {
        target: '.social-tabs',
        title: 'As seções',
        body: 'Novidades (o que os amigos fizeram), Perfil (nome, foto, o seu link e se os amigos sabem quando você bate a meta), Amigos (procure pelo @ e aceite pedidos), Desafios (entre amigos) e Conta (sincronização dos universos e sair).',
      },
      { title: 'Seus livros', body: 'Só aparecem no seu perfil se você escolher, livro por livro, na página Livro: só você, amigos ou todo mundo.' },
    ],
  },
  perfil: {
    title: 'Perfil',
    steps: [
      { target: '.social-profile-head', title: 'A pessoa', body: 'Nome, @ e a apresentação. Aqui você pede amizade, aceita um pedido ou desfaz a amizade.' },
      { target: '.social-person-view .social-h', title: 'Estante', body: 'Os livros que a pessoa mostrou para você (só os de amigos ou de todo mundo). Dá para ler direto, dizer que quer ler e comentar.', optional: true },
    ],
  },
  treinos: {
    title: 'Seus treinos',
    steps: [
      { target: '.treino-stats', title: 'Os números', body: 'Quantos treinos, quantos bateram o mínimo, os dias seguidos e o seu melhor ritmo.', optional: true },
      { target: '.treino-list', title: 'Cada treino', body: 'A proposta e o resultado. Toque para ler o texto e refazer o mesmo desafio.', optional: true },
      { target: '.treino-text', title: 'O texto', body: 'O que você escreveu naquele treino.', optional: true },
      { target: '.treino-detail-actions', title: 'Refazer', body: 'Faça o mesmo desafio de novo e compare com as outras tentativas.', optional: true },
      { target: '.treino-cloud', title: 'Onde ficam', body: 'Só neste aparelho, ou na nuvem com uma conta (e aí no placar).' },
    ],
  },
  placar: {
    title: 'Placar',
    steps: [
      { target: '.placar-switches', title: 'De quem e quando', body: 'Entre amigos ou de todo mundo; na semana ou no mês.' },
      { target: '.placar-list', title: 'As posições', body: 'Os pontos, os dias e os treinos de cada um. Só números: o texto nunca aparece.', optional: true },
      { target: '.placar-empty', title: 'Sem conta', body: 'Os seus pontos neste aparelho. Com uma conta, você entra no placar.', optional: true },
      { target: '.placar-vis', title: 'Quem vê os seus pontos', body: 'Ninguém, os amigos ou todo mundo. Você sempre vê a sua linha.', optional: true },
      { target: '.placar-how', title: 'Como contam os pontos', body: 'Os minutos de treino com o mínimo batido, até 60 por dia. O servidor confere cada treino e deixa de fora o que foi colado ou chegou dias depois.' },
    ],
  },
  medalhas: {
    title: 'Medalhas',
    steps: [{ target: '.play-medal-list', title: 'As medalhas', body: 'Cada uma e como ganhar. As que faltam ficam com o cadeado. Nada disso é obrigatório: é só para quem gosta.' }],
  },
  'dado-fisico': {
    title: 'Dado de verdade',
    steps: [
      { target: '.physical-roll-what', title: 'A rolagem', body: 'Quem rola, o quê e a fórmula, com os bônus da ficha já somados.' },
      { target: '.physical-roll-dice, .physical-roll .field', title: 'O que saiu', body: 'Role os dados de verdade e digite o número de cada um. Com muitos dados, um campo só, com os números separados por espaço.', optional: true },
      { target: '.physical-roll-result', title: 'A conta', body: 'O total, o crítico e, num ataque com alvo, se acerta.' },
      { target: '.physical-roll .inline-fields', title: 'Registrar', body: '“Registrar” manda para a bandeja e o registro. Sem dados à mão? “Rolar no app” sorteia.' },
    ],
  },

  convidar: {
    title: 'Convidar jogadores',
    steps: [
      { target: '.invite-qr', title: 'O código', body: 'Cada jogador aponta a câmera do celular para o código e o Codex abre, sem conta e sem instalar nada.', optional: true },
      { target: '.invite-side', title: 'O link', body: 'Copie e mande no grupo da mesa, ou use “Enviar” para escolher o aplicativo. É o mesmo link para todos.', optional: true },
      { target: '.invite:not(.is-on)', title: 'Criar o link', body: 'A primeira vez, crie o link da mesa. Ele continua o mesmo nas próximas sessões.', optional: true },
      { target: '.invite-who', title: 'Na mesa agora', body: 'Quem está com o Codex aberto, pelo personagem que escolheu. Aparece também no alto da mesa, ao lado de “Convidar”.' },
    ],
  },

  anunciar: {
    title: 'Anunciar para a mesa',
    steps: [
      { target: '.announce-presets', title: 'Atalhos', body: 'Para improvisar rápido: um toque e o aviso fica pronto, já com o tom certo. Dá para mudar o texto depois.' },
      { target: '.announce-tones', title: 'O tom', body: 'Aviso (uma notícia, uma pausa), Perigo (o celular vibra mais forte) ou Mistério. Muda a cor do aviso no celular.' },
      { target: '.announce-who', title: 'Quem aparece', body: 'Opcional. Escolha ou crie na hora quem entra em cena: o nome vai para o Codex e, se for briga, ele entra na iniciativa.' },
      { target: '.modal-footer', title: 'Anunciar', body: 'Vai na hora para a tela inteira de cada celular e fica no registro da sessão. Ctrl+Enter também anuncia.' },
    ],
  },

  // ─── Mesa de RPG (uma aba de cada vez) ───────────────────────────
  'rpg-mestre': {
    title: 'Painel do mestre',
    steps: [
      { target: '.mesa-hero-meta', title: 'A mesa', body: 'Qual mesa (grupo de jogadores), o sistema dela e se há uma sessão ao vivo, com a hora em que começou.', optional: true },
      { target: '.mesa-presence', title: 'Quem está na mesa', body: 'Os jogadores com o Codex aberto no celular aparecem aqui, pelo personagem. “Convidar” mostra o QR code e o link para eles entrarem.', optional: true },
      { target: '.mesa-dice-mode', title: 'Dados', body: 'Na mesa (o padrão): você rola os dados de verdade e diz o que saiu; o app soma o bônus e vê o crítico. No app: ele sorteia.' },
      { target: '[aria-label="Tema da mesa"]', title: 'Tema', body: 'O clima da mesa, pelo gênero do jogo. Os jogadores veem o mesmo no Codex e só escolhem claro ou escuro.', optional: true },
      { target: '.mesa-tabs', title: 'As abas', body: 'Na mesa (o combate e os dados durante o jogo), Sessões, Personagens, Revelações e Codex, Dados e tabelas, Sistemas. Cada aba tem o seu (?).' },
      { target: '.gm-next', title: 'Próxima sessão', body: 'A sessão marcada e a sua preparação. “Começar agora” abre a sessão na tela inteira e leva para a mesa.', optional: true },
      { target: '[data-tour="gm-sistema"]', title: 'Sistema da mesa', body: 'As regras desta mesa: escolha um sistema que você já tem ou crie um a partir de um modelo. “Editar sistemas” abre a aba Sistemas.', optional: true },
      { target: '[data-tour="gm-grupo"]', title: 'Grupo', body: 'Os personagens de jogador, com a vida e as condições de cada um. “Convidar jogadores” manda o link do Codex para os celulares.', optional: true },
      { target: '[data-tour="gm-segredos"]', title: 'Segredos ainda guardados', body: 'O que a mesa ainda não sabe, e o que ela conhece só em parte (o nome ou o resumo).', optional: true },
      { target: '[data-tour="gm-misterios"]', title: 'Mistérios em jogo', body: 'Os mistérios abertos e quantas pistas cada um tem. Toque para abrir em Pistas e mistérios.', optional: true },
      { target: '[data-tour="gm-mesas"]', title: 'Mesas', body: 'Um universo pode ter várias mesas (grupos de jogadores), cada uma com o que já descobriu. Renomeie ou apague aqui.', optional: true },
      { target: '.mesa-back', title: 'Sair', body: 'Volta para as campanhas (ou, num livro, para a escrita).' },
    ],
  },
  'rpg-mesa': {
    title: 'Na mesa',
    steps: [
      { target: '.table-start', title: 'Começar a sessão', body: 'Ao começar, a sessão abre na tela inteira: o resumo da última vez, quem já está na mesa e o convite. Depois, as rolagens e as anotações vão direto para o registro.', optional: true },
      { target: '.table-start-who', title: 'Quem já chegou', body: 'Quem abriu o link no celular aparece aqui antes mesmo de começar. “Convidar jogadores” mostra o QR code.', optional: true },
      {
        target: '.table-initiative',
        title: 'Iniciativa',
        body: 'Adicione os jogadores (o app rola a iniciativa do sistema), NPCs e combatentes avulsos com PV e Defesa. “Próxima vez” passa a vez e conta as rodadas. Quem chega a zero aparece como derrotado, e a vez pula os inimigos derrotados.',
        optional: true,
      },
      {
        target: '.turn-panel',
        title: 'A vez',
        body: 'Os ataques de quem está na vez, a um toque. O app pergunta em quem, compara com a Defesa e diz se acerta. Quem não tem ficha usa o ataque rápido, com bônus e dano.',
        optional: true,
      },
      { target: '.table-announce', title: 'Anunciar', body: 'Para improvisar: “Um inimigo aparece!”, “Emboscada!”, “Pausa de 10 minutos”. Aparece na tela inteira de cada celular, na hora, e quem aparece pode entrar no Codex e na iniciativa.', optional: true },
      { target: '.table-panel[aria-label="Grupo"]', title: 'Grupo', body: 'A vida de cada um com − e +, os atributos para rolar e as condições.', optional: true },
      { target: '.pc-card-foot', title: 'Quem não veio', body: 'Embaixo de cada personagem: joga, o mestre conduz (vira NPC nesta sessão) ou fica de fora (sai da iniciativa e vai para o fim da lista).', optional: true },
      { target: '.table-panel[aria-label="Dados"]', title: 'Dados e tabelas', body: 'Os dados rápidos, uma rolagem qualquer (como 2d6+3) e as tabelas aleatórias da mesa.', optional: true },
      { target: '.table-secrets', title: 'Segredos', body: 'O que a mesa ainda não sabe, à mão: “Revelar” mostra no Codex de cada celular na hora. “Revelar mais” para quem já conhecem só em parte; fatos, pistas e mapas também.', optional: true },
      { target: '.table-panel[aria-label="Registro"]', title: 'Registro', body: 'Anote o que aconteceu; as rolagens entram sozinhas, com a hora.', optional: true },
      { target: '.mesa-dice-mode', title: 'Dados na mesa ou no app', body: 'Na mesa: cada rolagem pergunta o que saiu nos dados de verdade, e o app faz a conta. No app: ele sorteia.' },
      {
        title: 'A bandeja de rolagens',
        body: 'Cada rolagem aparece no canto da tela. Depois de um ataque que acerta, “Rolar dano”; depois do dano, “Tirar PV” do alvo. As rolagens dos jogadores pelo Codex também chegam ali.',
      },
      { target: '.table-full', title: 'Tela cheia', body: 'Para o tablet na mesa, sem o resto do app em volta.', optional: true },
      { target: '.table-end', title: 'Encerrar', body: 'No fim do jogo: mostra quanto durou e o que rolou, avisa os celulares e manda o registro para Ideias.', optional: true },
    ],
  },
  'rpg-sessoes': {
    title: 'Sessões',
    steps: [
      { target: '.split-list[aria-label="Sessões"]', title: 'As sessões', body: 'Crie a próxima e toque numa para abrir. Cada uma tem número, data, preparação, registro e o que foi revelado nela.' },
      { target: '.session-head', title: 'Começar e encerrar', body: '“Começar” abre a sessão na tela inteira e leva para a mesa; as rolagens vão para o registro dela. Ao encerrar, aparece o resumo e o registro vai para Ideias, para você revisar com calma.', optional: true },
      { target: '.session-attendance', title: 'Quem joga', body: 'Cada personagem com o seu jogador. Quem não veio: o mestre conduz o personagem nesta sessão, ou ele fica de fora. Dá para marcar antes, ao planejar.', optional: true },
      { target: '.session-log', title: 'Registro da mesa', body: 'O que aconteceu, com a hora. Nada vira canon sem a sua revisão.', optional: true },
      { target: '.session-reveal', title: 'Revelado nesta sessão', body: 'Revele uma ficha (só o nome, nome e resumo, ou tudo) ou um fato. O Codex dos jogadores recebe na hora.', optional: true },
      { target: '.session .initiative', title: 'Iniciativa', body: 'A ordem do combate desta sessão, a mesma da aba Na mesa.', optional: true },
    ],
  },
  'rpg-personagens': {
    title: 'Personagens',
    steps: [
      { target: '[aria-label="Personagens da mesa"] .quick-create', title: 'Novo personagem', body: 'De jogador ou NPC, já com os atributos e recursos do sistema da mesa.' },
      { target: '[aria-label="Personagens da mesa"] .filter-chips', title: 'Mostrar', body: 'Todos, só os jogadores ou só os NPCs.' },
      { target: '[aria-label="Modo da ficha de jogo"]', title: 'Jogar ou editar', body: 'Jogar é a ficha feita para a mesa: tudo a um toque. Editar monta a ficha: atributos, perícias, quem joga e a ficha ligada no mundo.', optional: true },
      { target: '.sp-pools', title: 'Vida e mana', body: 'Grandes, com − e +. Toque no número para dano ou cura maiores.', optional: true },
      { target: '.sp-attrs', title: 'Toque para rolar', body: 'Atributos e perícias rolam com o bônus da ficha. Com dados na mesa, você diz o que saiu.', optional: true },
      { target: '[aria-labelledby^="sp-atq-"]', title: 'Ataques', body: 'O teste e o dano a um toque. Em combate, o app pergunta em quem, diz se acerta pela Defesa e oferece tirar o dano da vida do alvo.', optional: true },
      { target: '.sp-init', title: 'Entrar na iniciativa', body: 'Com uma sessão em andamento, coloca o personagem no combate, já com a iniciativa rolada.', optional: true },
      { title: 'E mais', body: 'Condições, poderes (Usar desconta o PM), perícias com busca, inventário (“3 tochas” vira 3 × tochas) e anotações.' },
    ],
  },
  'rpg-codex': {
    title: 'Revelações e Codex',
    steps: [
      { target: '.codex-manage', title: 'Revelações', body: 'Só entra no Codex o que você revelar: fichas, fatos, eventos, pistas, mapas, marcadores e ligações. Trechos secretos das fichas nunca aparecem.' },
      { target: '.codex-preview', title: 'Como a mesa vê', body: 'Exatamente o que os jogadores veem. Dá para copiar ou baixar.' },
      {
        target: '.share-panel',
        title: 'Codex ao vivo',
        body: 'Um link (e um QR code) para o celular dos jogadores. Cada revelação chega na hora; em combate, eles veem a ordem e de quem é a vez.',
        optional: true,
      },
      {
        title: 'Os jogadores na mesa',
        body: 'No celular, cada jogador diz quem é e rola pela própria ficha, com o dado de verdade ou no celular. A rolagem chega para você (na bandeja e no registro) e para o grupo, e o “acerta” ou “erra” volta para todos.',
      },
    ],
  },
  'rpg-dados': {
    title: 'Dados e tabelas',
    steps: [
      { target: '.dice-form', title: 'Qualquer rolagem', body: 'Escreva e role: 2d6+3, 4d6kh3 (os 3 maiores), 2d20kh1 (vantagem), 2d20kl1 (desvantagem), d%.' },
      { target: '.dice-quick', title: 'Dados rápidos', body: 'Um toque em cada dado, mais vantagem e desvantagem.' },
      { target: '.dice-result', title: 'Resultado', body: 'O total e cada dado que saiu. Com uma sessão em andamento, vai para o registro.' },
      { target: '.dice-history', title: 'Histórico', body: 'As últimas rolagens.', optional: true },
      { target: '.tables', title: 'Tabelas aleatórias', body: 'Nomes de taverna, rumores, encontros: crie a lista e sorteie uma linha na hora.', optional: true },
    ],
  },
  'rpg-sistemas': {
    title: 'Sistemas',
    steps: [
      { target: '.split-list[aria-label="Sistemas"]', title: 'Os sistemas', body: 'As regras das suas mesas. Cada mesa usa um; várias podem usar o mesmo.' },
      { target: '.template-picker', title: 'Começar de um modelo', body: 'D&D 5e, Tormenta 20, Ordem Paranormal, Call of Cthulhu, parada de dados ou sem sistema. Os modelos trazem só a estrutura; ajuste tudo.', optional: true },
      { target: '.system-editor', title: 'Editar', body: 'Atributos, recursos (PV, PM, Defesa), perícias, fórmulas de rolagem e condições. As fichas da mesa seguem o sistema.', optional: true },
    ],
  },

  // ─── Fora de um universo ─────────────────────────────────────────
  'hub-escrita': {
    title: 'Escrita',
    steps: [
      { target: '.hub-tabs', title: 'Três setores', body: 'Escrita (livros e mundos), RPG (campanhas) e Oficina (aprender). Cada um com a sua cara.' },
      { target: '.hub-continue', title: 'Continuar', body: 'O universo em que você mexeu por último, a um toque.', optional: true },
      { target: '.treino-card', title: 'Treino de hoje', body: 'A proposta do dia num sprint com tempo e mínimo de palavras ou caracteres. Seus treinos ficam guardados, e há um placar entre amigos.' },
      { target: '.library-list[aria-label="Universos"]', title: 'Seus universos', body: 'Todos os seus mundos de escrita. Toque para abrir.', optional: true },
      { target: '.start-card, .library-new', title: 'Novo universo', body: 'Dê um nome e comece. Dá para começar em branco ou com um modelo de gênero.' },
      { target: '.sample-card', title: 'O exemplo', body: 'Um mundo já montado, para ver tudo funcionando. Fica só neste aparelho; mexa à vontade.', optional: true },
      { target: '.library-alt', title: 'Instalar e importar', body: 'Instale o Papirus como app, traga um backup (.json) ou abra uma pasta do computador.', optional: true },
      { target: '.hub-social', title: 'Com os amigos', body: 'Novidades, amigos, desafios e o seu perfil. Precisa de uma conta, que é opcional.', optional: true },
      { target: '[data-tour="conta"]', title: 'Conta', body: 'Sem conta, tudo fica neste navegador. Com conta, os universos aparecem em todos os seus aparelhos.', optional: true },
    ],
  },
  'hub-rpg': {
    title: 'RPG',
    steps: [
      { target: '.hub-tabs', title: 'Três setores', body: 'Escrita, RPG e Oficina. Aqui ficam as campanhas.' },
      { target: '.hub-continue', title: 'Continuar a campanha', body: 'A campanha em que você mexeu por último.', optional: true },
      { target: '.library-list[aria-label="Campanhas"]', title: 'Suas campanhas', body: 'Toque para abrir a mesa.', optional: true },
      { target: '.start-card, .library-new', title: 'Nova campanha', body: 'Dê um nome e escolha o sistema. A mesa já vem pronta: o sistema, a sessão 1 e uma tabela de rumores.' },
      { target: '.hub-player', title: 'É jogador?', body: 'Peça ao mestre o link do Codex. Ele abre no navegador, sem conta, com a sua ficha, o mapa e o que o grupo já descobriu, e dá para rolar por ele.', optional: true },
    ],
  },
  'hub-oficina': {
    title: 'Oficina',
    steps: [
      { target: '.hub-tabs', title: 'Três setores', body: 'Escrita, RPG e Oficina. Aqui você aprende.' },
      { target: '.oficina-hero', title: 'Oficina', body: 'Gêneros, técnicas e guias para mestres: dicas, armadilhas, livros para estudar, curiosidades e exercícios. O seu progresso fica marcado.' },
      { target: '.oficina-tip', title: 'Dica do dia', body: 'Uma dica nova por dia. Toque para abrir o guia dela.' },
      { target: '.oficina-shelf-section', title: 'Os guias', body: 'Toque num gênero ou técnica para abrir o guia.' },
      { target: '.oficina-ideas', title: 'Gerador de ideias', body: 'Para escrever (quem, quer, mas, onde) ou para a mesa (ganchos de aventura).', optional: true },
    ],
  },
  oficina: {
    title: 'Oficina',
    steps: [
      { target: '.oficina-hero', title: 'Oficina', body: 'Gêneros, técnicas e guias para mestres: dicas, armadilhas, livros para estudar, curiosidades e exercícios. O seu progresso fica marcado.' },
      { target: '.oficina-tip', title: 'Dica do dia', body: 'Uma dica nova por dia. Toque para abrir o guia dela.' },
      { target: '.oficina-shelf-section', title: 'Os guias', body: 'Toque num gênero ou técnica para abrir o guia. A etiqueta mostra o do seu universo.' },
      { target: '.oficina-ideas', title: 'Gerador de ideias', body: 'Sorteie uma ideia para escrever ou um gancho para a mesa. Dentro de um universo, ela vira uma cena com um toque.', optional: true },
    ],
  },
  'oficina-guia': {
    title: 'Guia',
    steps: [
      { target: '.oficina-guide-hero', title: 'O guia', body: 'Um gênero ou uma técnica, do básico ao que dá trabalho.' },
      { target: '[aria-labelledby="of-funciona"]', title: 'O que funciona', body: 'O que os bons livros do gênero fazem.', optional: true },
      { target: '[aria-labelledby="of-armadilhas"]', title: 'Armadilhas', body: 'Os erros mais comuns, para evitar.', optional: true },
      { target: '[aria-labelledby="of-livros"]', title: 'Livros para estudar', body: 'O que ler, e o que cada um ensina.', optional: true },
      { target: '[aria-labelledby="of-curiosidades"]', title: 'Curiosidades', body: 'Toque num cartão para virar.', optional: true },
      { target: '[aria-labelledby="of-exercicios"]', title: 'Exercícios', body: 'Dentro de um universo, cada exercício vira uma cena para você praticar, e fica marcado como feito.', optional: true },
    ],
  },
  treino: {
    title: 'Treino',
    steps: [
      { target: '.treino-prompt-card', title: 'O desafio', body: 'A proposta de hoje. Não gostou? Toque em “Outra proposta”.' },
      { target: '.treino-units', title: 'Contar em', body: 'Palavras ou caracteres.' },
      { target: '.treino-presets', title: 'Escolha o treino', body: 'Um tempo e um mínimo prontos, do leve ao puxado.' },
      { target: '.treino-custom', title: 'Do seu jeito', body: 'Outro tempo e outro mínimo.', optional: true },
      { target: '.treino-go', title: 'Começar', body: 'O relógio corre em cima; dá para pausar e terminar antes. Embaixo, quanto você já escreveu e quanto falta para o mínimo.' },
      { title: 'Depois', body: 'Cada treino fica guardado com o texto, para refazer e comparar. Com conta, vai para a nuvem e entra no placar: pontos são os minutos com o mínimo batido, até 60 por dia.' },
    ],
  },
  'treino-resultado': {
    title: 'Resultado do treino',
    steps: [
      { target: '.treino-stats', title: 'Como foi', body: 'Palavras, caracteres, o tempo e o ritmo. Quando você bate o seu melhor neste desafio, aparece o recorde.', optional: true },
      {
        target: '.treino-result-actions',
        title: 'E agora',
        body: 'Refazer o mesmo desafio, guardar o texto como uma cena (dentro de um universo), escolher outro treino ou ver todos os seus treinos.',
      },
    ],
  },
  rolar: {
    title: 'Rolar',
    steps: [
      { target: '.player-sheet .segmented', title: 'Dado de verdade ou no celular', body: 'Com o dado de verdade, você rola na mesa e digita o que saiu. No celular, ele sorteia.' },
      { target: '.player-sheet-attacks', title: 'Ataques', body: 'O teste (com o bônus) e o dano. Em combate, você escolhe em quem; o mestre confere a Defesa e o “acerta” volta para todos.', optional: true },
      { target: '[aria-labelledby="ps-atr"]', title: 'Atributos', body: 'Toque para rolar, já com os números da sua ficha.', optional: true },
      { target: '[aria-labelledby="ps-per"]', title: 'Perícias', body: 'As treinadas aparecem primeiro; procure qualquer outra pelo nome.', optional: true },
      { target: '[aria-labelledby="ps-dados"]', title: 'Dado livre', body: 'Um d4, d6, d8, d10, d12, d20 ou d100, sem ficha.' },
    ],
  },
  'codex-jogador': {
    title: 'Codex',
    steps: [
      { target: '.player-live', title: 'Ao vivo', body: 'O Codex se atualiza sozinho quando o mestre revela algo. “Novidades do mestre” aparece quando chega coisa nova.' },
      { target: '.player-session', title: 'Sessão ao vivo', body: 'Aparece quando o mestre começa a sessão. O celular vibra no começo e avisa quando ela termina.', optional: true },
      { target: '.player-people', title: 'Na mesa agora', body: 'O mestre e os outros jogadores que estão com o Codex aberto, pelo personagem.', optional: true },
      { target: '.player-notice', title: 'Avisos do mestre', body: 'Quando o mestre anuncia algo (“Um inimigo aparece!”), aparece na tela inteira e o celular vibra. O último aviso fica aqui.', optional: true },
      { target: '.player-who', title: 'Quem é você?', body: 'Escolha o seu personagem para rolar pela ficha dele. Fica lembrado neste aparelho.', optional: true },
      { target: '.codex-combat', title: 'Combate', body: 'A ordem da iniciativa e de quem é a vez. Quando for a sua, o celular avisa.', optional: true },
      { target: '.codex-party', title: 'O grupo', body: 'A vida e as condições de cada um. Em “Ficha completa”, atributos, perícias, ataques, poderes e inventário.', optional: true },
      {
        target: '.player-dock',
        title: 'Rolar',
        body: 'Role pela sua ficha (ataques, atributos, perícias) ou um dado livre, com o dado de verdade ou no celular. A rolagem aparece para o mestre e para o grupo; num ataque, o mestre confere a Defesa e o “acerta” volta para todos.',
      },
      { target: '[aria-label="Tema claro"], [aria-label="Tema escuro"]', title: 'Claro ou escuro', body: 'As cores são as da mesa, escolhidas pelo mestre; você só escolhe claro ou escuro.' },
    ],
  },
  leitor: {
    title: 'Modo leitor',
    steps: [
      { target: '.leitor-where', title: 'Onde você está', body: 'O livro e a cena. Escolha outra na lista; a barra mostra quanto já leu.' },
      { target: '.leitor-aids-wrap', title: 'Como ler', body: 'O que aparece durante a leitura (caderno, novidades) e o jeito da página.' },
      { target: '.leitor-caderno-btn', title: 'Caderno', body: 'Quem é quem, o que já se sabe, ligações e linha do tempo, só até onde você leu. Sem spoiler.', optional: true },
      { target: '[title="Ouvir o capítulo em voz alta"]', title: 'Ouvir', body: 'O capítulo em voz alta, para revisar de olhos fechados.', optional: true },
      { target: '.leitor-reactions', title: 'Reagir', body: 'Deixe uma reação no capítulo para quem escreveu.', optional: true },
      { target: '.leitor-nav', title: 'Próxima cena', body: 'Avance ou volte; o Papirus lembra onde você parou.', optional: true },
    ],
  },
  diagramar: {
    title: 'Diagramar',
    steps: [
      { target: '.book-top-title', title: 'O livro', body: 'Capítulos, palavras e páginas, contados enquanto você muda o estilo.' },
      {
        target: '.book-panel',
        title: 'Opções',
        body: 'Modelo, capa e contracapa, o que entra, folha de rosto, página, texto, capítulos, quebra de cena, cabeçalho e números. Tudo aparece na prévia na hora.',
      },
      { target: '.book-panel-toggle', title: 'Opções ou páginas', body: 'No celular, alterna entre as opções e a prévia.', optional: true },
      { target: '.book-preview', title: 'Prévia', body: 'As páginas como vão sair.', optional: true },
      { target: '.book-top .btn-primary', title: 'Gerar', body: '“Imprimir ou salvar PDF” abre a impressão (escolha “Salvar como PDF”). Também dá para baixar o e-book (EPUB) ou um arquivo para imprimir depois.' },
    ],
  },
} satisfies Record<string, PageTourDef>

export type PageTourId = keyof typeof PAGE_TOURS
