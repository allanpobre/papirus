import { expect, test, type Page } from './fixtures.ts'
import { openPart } from './areas.ts'
import { readFile } from 'node:fs/promises'

const editor = (page: Page) => page.getByRole('textbox', { name: 'Texto da cena' })
const status = (page: Page) => page.getByRole('status').first()
const tree = (page: Page) => page.getByRole('complementary', { name: 'Manuscrito' })
const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })

async function newUniverse(page: Page, name = 'Teste') {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill(name)
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
}

async function openSample(page: Page) {
  // O exemplo de fantasia (pequeno, com tudo): a base destes testes.
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  // Um universo abre no Início; estes testes são sobre a escrita.
  await nav(page, 'Escrever').click()
}

async function startWriting(page: Page) {
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await expect(editor(page)).toBeFocused()
}

/** Seleciona um trecho exato do texto da cena, mesmo que atravesse destaques. */
async function selectText(page: Page, text: string) {
  await editor(page).evaluate((el, t) => {
    const nodes: Text[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
    const full = nodes.map((n) => n.data).join('')
    const start = full.indexOf(t)
    if (start < 0) throw new Error(`Texto não encontrado: ${t}`)
    const at = (offset: number): [Text, number] => {
      let acc = 0
      for (const n of nodes) {
        if (offset <= acc + n.data.length) return [n, offset - acc]
        acc += n.data.length
      }
      throw new Error('fora do texto')
    }
    const range = document.createRange()
    range.setStart(...at(start))
    range.setEnd(...at(start + t.length))
    const sel = getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
  }, text)
}

test('escreve, salva sozinho e reabre o mesmo universo e cena', async ({ page }) => {
  await newUniverse(page, 'Cinzas')
  await startWriting(page)
  await page.keyboard.type('Era noite em ')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.type('Ostria')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.type('.')
  await page.keyboard.press('Enter')
  await page.keyboard.type('— Quem está aí?')
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('A chegada')

  await expect(status(page)).toHaveText('Salvo')
  await page.reload()

  // Reabre direto o último universo e a última cena.
  await expect(editor(page)).toContainText('Era noite em Ostria.')
  await expect(editor(page)).toContainText('— Quem está aí?')
  await expect(editor(page).locator('strong')).toHaveText('Ostria')
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('A chegada')
})

test('não perde o texto ao recarregar logo depois de digitar', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Texto urgente')
  // Recarrega antes do salvamento automático ocorrer.
  await page.reload()
  await expect(editor(page)).toContainText('Texto urgente')
})

test('separador de cena e exportação em Markdown', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Antes.')
  await page.getByRole('button', { name: 'Separador de cena' }).click()
  await page.keyboard.type('Depois.')
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Duas partes')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Exportar cena' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('duas-partes.md')
  expect(await readFile(await download.path(), 'utf8')).toBe('# Duas partes\n\nAntes.\n\n* * *\n\nDepois.\n')
})

test('remover uma história preserva as cenas como cenas soltas', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Prólogo')
  await tree(page).getByRole('button', { name: 'Nova história' }).click()
  const story = tree(page).getByRole('region', { name: 'Nova história' })
  await story.getByRole('textbox', { name: 'Título da história' }).fill('Livro um')
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  await page.getByRole('combobox', { name: 'História' }).selectOption({ label: 'Livro um' })
  const livro = tree(page).getByRole('region', { name: 'Livro um' })
  await expect(livro.getByRole('button', { name: /Prólogo/ })).toBeVisible()

  await livro.getByRole('button', { name: 'Remover história' }).click()
  await livro.getByRole('button', { name: 'Remover história' }).click()

  await expect(tree(page).getByRole('region', { name: 'Livro um' })).toHaveCount(0)
  await expect(tree(page).getByRole('region', { name: 'Sem capítulo' }).getByRole('button', { name: /Prólogo/ })).toBeVisible()
})

test('apagar uma cena pede confirmação e pode ser desfeito', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Algo importante')
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Importante')

  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Apagar cena' }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(tree(page).getByRole('button', { name: /Importante/ })).toBeVisible()

  await page.getByRole('button', { name: 'Apagar cena' }).click()
  await page.getByRole('group', { name: 'Apagar esta cena?' }).getByRole('button', { name: 'Apagar cena' }).click()
  await expect(tree(page).getByRole('button', { name: /Importante/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await tree(page).getByRole('button', { name: /Importante/ }).click()
  await expect(editor(page)).toContainText('Algo importante')
})

test('cria ficha a partir de uma seleção e a vê na margem e nas Fichas', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Kael chegou ao porto antes do amanhecer.')
  await selectText(page, 'Kael')
  await page.getByRole('toolbar', { name: 'Ações da seleção' }).getByRole('button', { name: 'Ficha' }).click()
  await expect(page.getByRole('dialog', { name: 'Nova ficha' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Nova ficha' }).getByRole('button', { name: 'Criar ficha' }).click()

  await expect(editor(page).locator('.mention')).toHaveText('Kael')
  const margin = page.getByRole('complementary', { name: 'Margem viva' })
  await expect(margin.getByRole('button', { name: 'Kael', exact: true }).first()).toBeVisible()

  await nav(page, /^Mundo/).click()
  await page.locator('.entity-row-name', { hasText: /^Kael$/ }).click()
  const ficha = page.getByRole('region', { name: 'Ficha' })
  await expect(ficha.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Kael')
  await expect(ficha.getByRole('button', { name: 'Nova cena', exact: true })).toBeVisible()
})

test('a revisão encontra nomes novos e cria fichas sem interromper a escrita', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Ontem Lyra subiu a Torre de Marfim. Depois, Lyra desceu.')
  const margin = page.getByRole('complementary', { name: 'Margem viva' })
  await expect(margin.getByText('2 nomes novos')).toBeVisible()

  await margin.getByRole('button', { name: /Revisar/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Revisão' })
  const torre = dialog.getByRole('listitem').filter({ has: page.getByText('Torre de Marfim', { exact: true }) })
  await torre.getByRole('combobox').selectOption('lugar')
  await torre.getByRole('button', { name: 'Criar ficha' }).click()
  await dialog.getByRole('listitem').filter({ has: page.getByText('Lyra', { exact: true }) }).getByRole('button', { name: 'Ignorar' }).click()
  await expect(dialog.getByText('Nenhum nome novo por aqui.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Fechar' }).click()

  // O nome reconhecido passa a ser destacado no texto.
  await expect(editor(page).locator('.detected')).toHaveText('Torre de Marfim')
})

test('captura um fato a partir de uma fala, como afirmação de personagem', async ({ page }) => {
  await newUniverse(page)
  await nav(page, /^Mundo/).click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Vaelor')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await nav(page, 'Escrever').click()
  await startWriting(page)
  await page.keyboard.type('— Vaelor tem olhos cinzentos — disse a menina.')
  await selectText(page, 'Vaelor tem olhos cinzentos')
  await page.getByRole('toolbar', { name: 'Ações da seleção' }).getByRole('button', { name: 'Fato' }).click()

  const dialog = page.getByRole('dialog', { name: 'Capturar fato' })
  await expect(dialog.getByRole('button', { name: 'Vaelor' })).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'É verdade no mundo?' })).toHaveValue('rumor')
  await dialog.getByRole('combobox', { name: 'Relação' }).fill('tem olhos')
  await dialog.getByRole('textbox', { name: 'Valor em texto' }).fill('cinzentos')
  await dialog.getByRole('button', { name: 'Registrar' }).click()

  await openPart(page, 'Quem sabe o quê')
  // Cada fato numa frase: o que é, se é verdade, e o trecho de onde veio.
  const fact = page.locator('.fact-card').filter({ hasText: 'Vaelor tem olhos cinzentos.' }).filter({ hasText: 'É boato.' })
  await expect(fact).toContainText('“Vaelor tem olhos cinzentos”')
})

test('busca global encontra uma ficha pelo apelido, sem acento', async ({ page }) => {
  await openSample(page)
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Buscar no universo' }).fill('principe perdido')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('Vaelor')
})

test('RPG: revelar uma ficha a um grupo coloca no Codex dos jogadores', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Mesa').click()
  await page.getByRole('tab', { name: 'Codex' }).click()

  const codex = page.getByRole('region', { name: 'Codex como os jogadores veem' })
  await expect(codex.getByRole('heading', { name: 'Ostria' })).toBeVisible()
  await expect(codex.getByRole('heading', { name: 'Ilsa' })).toHaveCount(0)

  await page.getByRole('combobox', { name: 'Revelar ficha' }).fill('Ilsa')
  await page.getByRole('option', { name: /Ilsa/ }).click()
  await page.getByRole('button', { name: 'Revelar', exact: true }).click()
  await expect(codex.getByRole('heading', { name: 'Ilsa' })).toBeVisible()
  await expect(codex).toContainText('Guardiã da Torre de Marfim')
})

test('RPG: registro de sessão vai para Ideias ao encerrar', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Mesa').click()
  await page.getByRole('tab', { name: 'Sessões' }).click()
  await page.getByRole('button', { name: 'Começar', exact: true }).click()
  await page.getByRole('button', { name: 'Começar a jogar' }).click()
  await page.getByRole('textbox', { name: 'Anotar no registro' }).fill('Os jogadores entraram na Torre.')
  await page.getByRole('button', { name: 'Anotar' }).click()
  await page.getByRole('button', { name: 'Mais da sessão' }).click()
  await page.getByRole('button', { name: 'Encerrar sessão' }).click()
  await page.getByRole('group', { name: 'Encerrar a sessão?' }).getByRole('button', { name: 'Encerrar' }).click()
  // O fim da sessão mostra o resumo e leva o registro para Ideias.
  const fim = page.getByRole('dialog', { name: 'Fim da sessão' })
  await expect(fim).toContainText('Notas1')
  await fim.getByRole('button', { name: 'Revisar em Ideias' }).click()
  await expect(page.getByRole('textbox', { name: 'Texto do item' }).first()).toHaveValue(/Os jogadores entraram na Torre\./)
})

test('dados: rola expressões e recusa as inválidas', async ({ page }) => {
  await openSample(page)
  await nav(page, 'Mesa').click()
  await page.getByRole('tab', { name: 'Dados e tabelas' }).click()
  await page.getByRole('radiogroup', { name: 'Dados' }).getByRole('radio', { name: 'Do app' }).click()
  await page.getByRole('textbox', { name: 'Rolagem' }).fill('2d6+100')
  await page.getByRole('button', { name: 'Rolar', exact: true }).first().click()
  const total = Number(await page.locator('.dice-total').textContent())
  expect(total).toBeGreaterThanOrEqual(102)
  expect(total).toBeLessThanOrEqual(112)
  await page.getByRole('textbox', { name: 'Rolagem' }).fill('banana')
  await page.getByRole('button', { name: 'Rolar', exact: true }).first().click()
  await expect(page.getByRole('alert')).toContainText('Não entendi')
})

test('snapshot: restaura o estado anterior e guarda o atual', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Versão um.')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Dados e backup' }).click()
  await page.getByRole('textbox', { name: 'Nome do snapshot' }).fill('Primeira versão')
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  await expect(page.getByText('Snapshot criado')).toBeVisible()

  await nav(page, 'Escrever').click()
  await editor(page).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Versão dois.')
  await nav(page, 'Ajustes e dados').click()
  const snap = page.getByRole('listitem').filter({ hasText: 'Primeira versão' })
  await snap.getByRole('button', { name: 'Restaurar' }).click()
  await snap.getByRole('group').getByRole('button', { name: 'Restaurar' }).click()

  await nav(page, 'Escrever').click()
  await expect(editor(page)).toContainText('Versão um.')
  await nav(page, 'Ajustes e dados').click()
  await expect(page.getByText('Antes de restaurar o snapshot')).toBeVisible()
})

test('Ideias: captura rápida de qualquer lugar e vira cena solta', async ({ page }) => {
  await newUniverse(page)
  await page.keyboard.press('ControlOrMeta+Shift+I')
  await page.getByRole('textbox', { name: 'Ideia' }).fill('Um navio sem nome no casco.')
  await page.getByRole('button', { name: 'Guardar em Ideias' }).click()
  await nav(page, /^Ideias/).click()
  await page.getByRole('button', { name: 'Virar cena' }).click()
  await page.getByRole('button', { name: 'Abrir', exact: true }).click()
  await expect(editor(page)).toContainText('Um navio sem nome no casco.')
})

test('adota um save da primeira versão do Papirus sem perder o texto', async ({ page }) => {
  // Cópia de emergência no formato 1, como gravada pela versão anterior.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('semeado')) return
    sessionStorage.setItem('semeado', '1')
    localStorage.setItem(
      'papirus:emergency',
      JSON.stringify({
        schemaVersion: 1,
        revision: 3,
        universe: {
          id: 'antigo',
          name: 'Meu universo',
          stories: [],
          scenes: [
            {
              id: 'c1',
              title: 'Texto antigo',
              storyId: null,
              order: 0,
              doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Escrito na versão 1.' }] }] },
              text: 'Escrito na versão 1.',
              createdAt: '2026-10-22T00:00:00.000Z',
              updatedAt: '2026-10-22T00:00:00.000Z',
            },
          ],
          createdAt: '2026-10-22T00:00:00.000Z',
          updatedAt: '2026-10-22T00:00:00.000Z',
        },
      }),
    )
  })
  await page.goto('/app/')
  await page.getByRole('button', { name: /Meu universo/ }).click()
  // O Início já mostra o trecho; "Continuar escrevendo" abre a cena.
  await expect(page.getByText('Escrito na versão 1.')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar escrevendo' }).click()
  await expect(editor(page)).toContainText('Escrito na versão 1.')
})

test('versões: guarda, compara e volta para uma versão anterior da cena', async ({ page }) => {
  await newUniverse(page)
  await startWriting(page)
  await page.keyboard.type('Era noite em Ostria.')
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Versões da cena' }).click()
  await page.getByRole('textbox', { name: 'Nome da versão' }).fill('Noite')
  await page.getByRole('button', { name: 'Guardar texto atual' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()

  await editor(page).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Era madrugada em Ostria.')
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Versões da cena' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('del')).toHaveText('noite')
  await expect(dialog.locator('ins')).toHaveText('madrugada')
  await dialog.getByRole('button', { name: 'Voltar para esta versão' }).click()
  await dialog.getByRole('button', { name: 'Voltar', exact: true }).click()

  await expect(editor(page)).toHaveText('Era noite em Ostria.')
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Versões da cena' }).click()
  await expect(page.getByRole('dialog').getByText('Antes de voltar para “Noite”')).toBeVisible()
})

test('leitura: ensaio mostra um parágrafo por vez', async ({ page }) => {
  await openSample(page)
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Ler', exact: true }).click()
  const reading = page.getByRole('dialog', { name: /Leitura/ })
  await expect(reading.getByText('Era noite em Ostria')).toBeVisible()
  await reading.getByRole('radio', { name: 'Ensaio' }).click()
  await expect(reading.getByText('O estranho parou.')).toHaveCount(0)
  await reading.getByRole('button', { name: 'Avançar' }).click()
  await reading.getByRole('button', { name: 'Avançar' }).click()
  await reading.getByRole('button', { name: 'Avançar' }).click()
  await expect(reading.getByText(/O estranho parou\./)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(reading).toHaveCount(0)
})

test('Perguntar ao mundo: mostra o contexto antes de enviar e exibe a resposta', async ({ page }) => {
  let sent: { model?: string; fallbacks?: unknown; messages?: { content: { text: string }[] }[] } = {}
  await page.route('https://api.anthropic.com/v1/messages**', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: 'msg_teste',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: '**Registrado**\n- Ilsa é guardiã da Torre de Marfim.\n\n**Inferência**\n- Ela pode saber onde Vaelor esteve.' }],
        stop_reason: 'end_turn',
        stop_details: null,
        usage: { input_tokens: 900, output_tokens: 60 },
      }),
    })
  })

  await openSample(page)
  await nav(page, 'Perguntar ao mundo').click()
  await page.getByRole('textbox', { name: 'Chave da API da Anthropic' }).fill('sk-ant-teste')
  await page.getByRole('textbox', { name: 'Pergunta' }).fill('O que Ilsa guardava?')
  await page.getByRole('button', { name: 'Ver o que será enviado' }).click()
  const preview = page.getByRole('region', { name: 'Contexto que será enviado' })
  await expect(preview).toContainText('### Ilsa')
  await expect(preview).not.toContainText('### Vaelor')

  await page.getByRole('button', { name: 'Perguntar', exact: true }).click()
  await expect(page.locator('.archivist-answer')).toContainText('Ilsa é guardiã da Torre de Marfim.')
  expect(sent.model).toBe('claude-opus-5-5')
  expect(sent.fallbacks).toBe('default')
  expect(sent.messages?.[0].content[0].text).toContain('### Ilsa')
  await page.getByRole('button', { name: 'Guardar em Ideias' }).click()
  await expect(page.getByRole('button', { name: 'Guardada em Ideias' })).toBeDisabled()
})

test('Mapa, Página e Revisão: escreve com a porta fechada e revisa com ela aberta', async ({ page }) => {
  await openSample(page)
  const modes = page.getByRole('navigation', { name: 'Momento da escrita' })
  const margin = page.getByRole('complementary', { name: 'Margem viva' })
  await expect(margin).toBeVisible()

  // Página: só o texto, com o que a cena precisa fazer no alto; a margem e o manuscrito saem.
  await modes.getByRole('button', { name: 'Página' }).click()
  await expect(modes.getByRole('button', { name: 'Página' })).toHaveAttribute('aria-current', 'page')
  await expect(margin).toHaveCount(0)
  await expect(tree(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mostrar margem' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'O que esta cena precisa fazer' })).toContainText('Kael quer saber quem desceu do navio')
  // A lista de cenas abre por cima e fecha ao escolher.
  await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
  await tree(page).getByRole('button', { name: /A Torre fechada/ }).click()
  await expect(tree(page)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('A Torre fechada')

  // As perguntas esperam a Revisão; o rodapé leva até lá.
  await page.getByRole('button', { name: 'Mostrar manuscrito' }).click()
  await tree(page).getByRole('button', { name: /A chegada/ }).click()
  await page.getByRole('button', { name: /esperando a revisão/ }).click()
  await expect(modes.getByRole('button', { name: 'Revisão' })).toHaveAttribute('aria-current', 'page')
  const review = margin.getByRole('region', { name: 'Esta cena' })
  await expect(review).toContainText('Vira: termina pior')
  await expect(review).toContainText('Planta A espada embrulhada')
  await review.getByRole('radio', { name: /Melhor/ }).click()
  await expect(review.getByRole('radio', { name: /Melhor/ })).toHaveAttribute('aria-checked', 'true')
  await review.getByRole('button', { name: 'Próxima cena' }).click()
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('A Torre fechada')

  // Mapa: a faixa, as promessas, o modelo e as perguntas (tiradas só do que foi marcado).
  await modes.getByRole('button', { name: 'Estrutura' }).click()
  await expect(page.getByRole('heading', { name: 'Estrutura' })).toBeAttached()
  await expect(page.getByRole('button', { name: 'A chegada: termina melhor' })).toBeVisible()
  const promises = page.getByRole('region', { name: 'Promessas' })
  await expect(promises.getByRole('listitem').filter({ hasText: 'Os trezentos e doze degraus' })).toContainText('parada')
  await page.getByRole('combobox', { name: 'Modelo de estrutura de “Livro I — A Maré Volta”' }).selectOption('save-the-cat')
  await expect(page.locator('.beat-chip', { hasText: 'Catalisador' })).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Como “O regente” termina' }).getByRole('radio', { name: /Igual/ }).click()
  const notices = page.getByRole('region', { name: 'Vale olhar' })
  const notice = notices.getByRole('listitem').filter({ hasText: '“O regente” está marcada como “igual”. Alguma coisa muda nela?' })
  await notice.getByRole('button', { name: 'Abrir cena' }).click()
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('O regente')

  // O modo fica guardado: a escrita volta para a Revisão de onde saiu.
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: 'Revisão' })).toHaveAttribute('aria-current', 'page')
})

test('no Mapa, o cartão da cena se escreve ali mesmo', async ({ page }) => {
  await openSample(page)
  await page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: 'Estrutura' }).click()
  const card = page.locator('[data-scene]').filter({ hasText: 'Nas brumas' })
  await card.getByRole('button', { name: '+ O que esta cena precisa fazer' }).click()
  await card.getByRole('textbox', { name: 'Quem quer o quê' }).fill('Kael quer achar o caminho')
  await card.getByRole('textbox', { name: 'Como termina' }).fill('Igual: a névoa não deixa')
  await card.getByRole('button', { name: 'Pronto' }).click()
  await expect(card.getByRole('region', { name: 'O que esta cena precisa fazer' })).toContainText('Kael quer achar o caminho')
})

test('Página: onde estou, próxima cena e nova cena logo depois desta', async ({ page }) => {
  await openSample(page)
  const modes = page.getByRole('navigation', { name: 'Momento da escrita' })
  await modes.getByRole('button', { name: 'Página' }).click()
  const title = page.getByRole('textbox', { name: 'Título da cena' })
  await expect(title).toHaveValue('A chegada')
  await expect(page.locator('.write-pos')).toHaveText('Livro I — A Maré Volta · cena 1 de 8')

  // O rodapé (palavras, meta e Sprint) fica à vista mesmo com a faixa do exemplo no alto.
  const foot = await page.locator('.write-foot').boundingBox()
  expect(foot!.y + foot!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)

  const end = page.getByRole('navigation', { name: 'Depois desta cena' })
  await end.getByRole('button', { name: /Próxima cena/ }).click()
  await expect(title).toHaveValue('A Torre fechada')
  await expect(page.locator('.write-pos')).toContainText('cena 2 de 8')

  await page.getByRole('navigation', { name: 'Depois desta cena' }).getByRole('button', { name: 'Nova cena depois desta' }).click()
  // Cena nova sem título: o campo fica vazio (a lista mostra o começo do texto no lugar de "Nova cena").
  await expect(title).toHaveValue('')
  await expect(title).toHaveAttribute('placeholder', 'Título (opcional)')
  await expect(title).toBeFocused()
  await page.keyboard.type('Entre as duas')
  await expect(page.locator('.write-pos')).toContainText('cena 3 de 9')
  // Entrou logo depois de "A Torre fechada", não no fim do livro.
  await page.locator('.write-pos').click()
  await expect(tree(page).locator('.tree-scene-title').nth(2)).toHaveText('Entre as duas')
  expect((await tree(page).locator('.tree-scene-title').allInnerTexts()).slice(0, 4)).toEqual(['A chegada', 'A Torre fechada', 'Entre as duas', 'Nas brumas'])
})

test('o Aa muda a letra e a largura sem sair da cena', async ({ page }) => {
  await openSample(page)
  const article = page.locator('article.page')
  await page.getByRole('button', { name: 'Texto da página' }).click()
  const size = Number(await page.locator('.text-menu-value').innerText())
  await page.getByRole('button', { name: 'Letra maior' }).click()
  await expect(article).toHaveAttribute('style', new RegExp(`--editor-size: ${size + 1}px`))
  await page.getByRole('radiogroup', { name: 'Fonte' }).getByRole('radio', { name: 'Máquina' }).click()
  await expect(article).toHaveClass(/font-maquina/)
  await page.getByRole('radiogroup', { name: 'Largura' }).getByRole('radio', { name: 'Larga' }).click()
  await expect(article).toHaveClass(/page-larga/)
  await page.locator('.text-menu').getByText('Linha no meio da tela').click()
  await expect(article).toHaveClass(/typewriter/)
  // Vale para o aparelho: continua depois de recarregar.
  await page.reload()
  await expect(page.locator('article.page')).toHaveClass(/font-maquina/)
})

test('procurar e trocar: na cena, no livro todo e ao renomear uma ficha', async ({ page }) => {
  await openSample(page)
  await page.getByRole('navigation', { name: 'Momento da escrita' }).getByRole('button', { name: 'Página' }).click()
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('A chegada')
  await editor(page).click()

  // Na cena: os achados destacados, Enter vai para o próximo.
  await page.keyboard.press('ControlOrMeta+f')
  const bar = page.getByRole('search', { name: 'Procurar na cena' })
  await bar.getByRole('textbox', { name: 'Procurar na cena' }).fill('Kael')
  await expect(bar.locator('.find-count')).toHaveText('1 de 3')
  await expect(editor(page).locator('.search-hit')).toHaveCount(3)
  await page.keyboard.press('Enter')
  await expect(bar.locator('.find-count')).toHaveText('2 de 3')
  await bar.getByRole('textbox', { name: 'Trocar por' }).fill('Kiel')
  await bar.getByRole('button', { name: 'Trocar este' }).click()
  await expect(bar.locator('.find-count')).toHaveText('2 de 2')
  await bar.getByRole('button', { name: /Trocar todos/ }).click()
  await expect(bar.locator('.find-count')).toHaveText('Nada')
  await expect(editor(page)).not.toContainText('Kael')
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(editor(page)).toContainText('Kael')

  // No livro todo: cada trecho com o que sai e o que entra; o desmarcado fica como estava.
  await bar.getByRole('button', { name: 'No livro todo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Procurar e trocar no livro' })
  await dialog.getByRole('textbox', { name: 'Procurar' }).fill('Mira')
  await dialog.getByRole('textbox', { name: 'Trocar por' }).fill('Mirela')
  await dialog.getByRole('checkbox', { name: 'Palavra inteira' }).check()
  await expect(dialog.locator('.replace-summary')).toContainText('8 achados em 5 cenas')
  const first = dialog.getByRole('region', { name: 'A chegada' })
  await first.locator('.replace-hit input').first().uncheck()
  await dialog.getByRole('button', { name: 'Trocar 7' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(editor(page)).toContainText('Mira jurou')
  await page.locator('.write-pos').click()
  await tree(page).getByRole('button', { name: /A Torre fechada/ }).click()
  await expect(editor(page)).toContainText('Mirela subiu os degraus')
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(editor(page)).toContainText('Mira subiu os degraus')

  // Renomear uma ficha oferece trocar o nome antigo nas cenas, mostrando antes.
  await nav(page, /^Mundo$/).click()
  await page.locator('.entity-row').filter({ has: page.locator('.entity-row-name', { hasText: /^Kael$/ }) }).click()
  await page.getByRole('group', { name: 'Modo da ficha' }).getByRole('button', { name: 'Editar' }).click()
  await page.locator('#entity-name').fill('Kaelan')
  await page.locator('#entity-name').blur()
  await page.getByRole('button', { name: 'Ver e trocar' }).click()
  const rename = page.getByRole('dialog', { name: 'Procurar e trocar no livro' })
  await expect(rename.getByRole('textbox', { name: 'Procurar' })).toHaveValue('Kael')
  await expect(rename.getByRole('textbox', { name: 'Trocar por' })).toHaveValue('Kaelan')
  await expect(rename.getByRole('checkbox', { name: 'Palavra inteira' })).toBeChecked()
  await expect(rename.locator('.replace-summary')).toContainText('achados')
})
