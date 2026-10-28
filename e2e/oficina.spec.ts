import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })

test('Oficina: página à parte, com o gênero do universo, cartas que viram, exercício que vira cena e o voltar do aparelho', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Mar')
  await page.getByRole('radiogroup', { name: 'Começar como' }).getByRole('radio', { name: 'Fantasia' }).click()
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await nav(page, 'Oficina').click()
  const oficina = page.getByRole('dialog', { name: 'Oficina' })
  await expect(oficina.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
  await expect(oficina.getByRole('button', { name: /^Fantasia.*o seu universo/ })).toBeVisible()

  // Um gênero; o "voltar" do aparelho volta para a capa e depois fecha.
  await oficina.getByRole('button', { name: /^Mistério/ }).click()
  await expect(oficina.getByRole('heading', { name: 'Mistério', level: 1 })).toBeVisible()
  await expect(oficina.getByRole('region', { name: 'Livros para estudar' })).toContainText('E Não Sobrou Nenhum')
  const carta = oficina.getByRole('button', { name: 'Você sabia? Curiosidade 1' })
  await carta.click()
  await expect(oficina.getByRole('button', { name: /Agatha Christie é, segundo o Guinness/ })).toHaveAttribute('aria-pressed', 'true')
  await page.goBack()
  await expect(oficina.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
  await page.goBack()
  await expect(oficina).toHaveCount(0)

  // De novo, até o exercício: vira uma cena e a Oficina fecha.
  await nav(page, 'Oficina').click()
  await oficina.getByRole('button', { name: /^Mistério/ }).click()
  await oficina.getByRole('region', { name: 'Experimente' }).getByRole('button', { name: 'Escrever este exercício' }).first().click()
  await expect(oficina).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('Exercício: Três pistas')
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  await expect(page.getByRole('region', { name: 'Detalhes da cena' })).toContainText('três detalhes')
})

test('Oficina também abre pela tela de universos', async ({ page }) => {
  await page.goto('/app/')
  // A Oficina é um setor do início, ao lado de Escrita e RPG.
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Oficina' }).click()
  await page.getByRole('button', { name: /^Terror/ }).click()
  const oficina = page.getByRole('dialog', { name: 'Oficina' })
  await expect(oficina.getByRole('region', { name: 'Experimente' })).toContainText('Abra um universo')
  await page.goBack()
  await expect(oficina).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
})

test('meta com prazo e calendário de escrita no Início', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Universo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Meta do livro: palavras' }).fill('5000')
  await expect(page.getByLabel('Até')).toBeVisible()
  await nav(page, 'Escrever').click()
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' Mais umas palavras para hoje contar.')
  await expect(page.getByRole('status').first()).toHaveText('Salvo')
  await nav(page, 'Início').click()
  await expect(page.locator('.deadline-line')).toContainText('de 5.000 palavras até')
  await expect(page.getByText(/palavras por dia para chegar lá/)).toBeVisible()
  await expect(page.getByRole('img', { name: /Calendário de escrita: 1 dia com escrita|Calendário de escrita: \d+ dias com escrita/ })).toBeVisible()
  await expect(page.getByText(/1 dia seguido escrevendo/)).toBeVisible()
})

test('backup sozinho toda semana', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Ajustes e dados').click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Dados e backup' }).click()
  await page.getByText('Baixar o backup sozinho toda semana').click()
  await expect(page.getByRole('switch', { name: /Baixar o backup sozinho/ })).toBeChecked()
  // Dez dias depois, ao abrir, o arquivo baixa sem perguntar (e sem o aviso de backup).
  await page.clock.setFixedTime(Date.now() + 10 * 86400000)
  const download = page.waitForEvent('download')
  await page.reload()
  expect((await download).suggestedFilename()).toMatch(/backup.*\.json$/)
  await expect(page.getByText(/dias sem backup/)).toHaveCount(0)
})

test('ouvir o livro: lê em voz alta e segue para o capítulo seguinte', async ({ page }) => {
  // O navegador de teste não fala: uma voz de mentira conta o que seria lido.
  await page.addInitScript(() => {
    const w = window as unknown as { falas: string[] }
    w.falas = []
    const synth = {
      cancel() {},
      pause() {},
      resume() {},
      getVoices: () => [{ lang: 'pt-BR', name: 'teste' }],
      speak(u: { text: string; onend?: () => void }) {
        w.falas.push(u.text)
        setTimeout(() => u.onend?.(), 20)
      },
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth })
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = function (this: { text: string }, t: string) {
      this.text = t
    }
  })
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('button', { name: 'Ler como livro' }).first().click()
  const leitor = page.getByRole('dialog', { name: 'Modo leitor' })
  await leitor.getByRole('button', { name: 'Ouvir' }).click()
  await expect(leitor.getByRole('group', { name: 'Leitura em voz alta' })).toBeVisible()
  await expect(leitor.locator('#leitor-cena')).not.toHaveValue('0', { timeout: 10_000 })
  expect(await page.evaluate(() => (window as unknown as { falas: string[] }).falas.length)).toBeGreaterThan(3)
  await leitor.getByRole('button', { name: 'Parar de ouvir' }).click()
  await expect(leitor.getByRole('group', { name: 'Leitura em voz alta' })).toHaveCount(0)
})

test('a dica do dia no Início leva à Oficina', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  const tip = page.getByRole('region', { name: 'Dica do dia' })
  await expect(tip).toBeVisible()
  await tip.getByRole('button', { name: 'Ver mais na Oficina' }).click()
  await expect(page.getByRole('dialog', { name: 'Oficina' })).toBeVisible()
})

test('Oficina funciona mesmo quando o navegador (ou uma extensão) muda o scrollTo', async ({ page }) => {
  // Algumas extensões de rolagem suave fazem scrollTo devolver um número; isso derrubava o app.
  await page.addInitScript(() => {
    const original = Element.prototype.scrollTo
    Element.prototype.scrollTo = function (this: Element, ...args: unknown[]) {
      ;(original as (...a: unknown[]) => void).apply(this, args)
      return 1 as unknown as undefined
    }
  })
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Oficina' }).click()
  await page.getByRole('button', { name: /^Fantasia/ }).click()
  const oficina = page.getByRole('dialog', { name: 'Oficina' })
  await expect(oficina.getByRole('heading', { name: 'Fantasia', level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
  await expect(page.getByText('O Papirus encontrou um erro.')).toHaveCount(0)
})

test('desafio do dia: vira cena, 100 palavras e está feito, com comemoração e medalha', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  const card = page.getByRole('region', { name: 'Desafio de hoje' })
  await expect(card).toBeVisible()
  const prompt = (await card.locator('.play-prompt').innerText()).trim()
  // Espera o app registrar as medalhas que já existiam (sem comemorar as antigas).
  await page.waitForTimeout(2500)
  await card.getByRole('button', { name: 'Escrever agora' }).click()
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue(/^Desafio de \d\d\/\d\d$/)
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  await expect(page.getByRole('region', { name: 'Detalhes da cena' })).toContainText(prompt.slice(0, 30))
  await page.getByRole('textbox', { name: 'Texto da cena' }).click()
  await page.keyboard.insertText(Array.from({ length: 105 }, (_, i) => `palavra${i}`).join(' '))
  await expect(page.getByText('🎲 Desafio do dia feito!')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Nova medalha: Topei o desafio')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Início' }).click()
  await expect(page.getByRole('region', { name: 'Desafio de hoje' })).toContainText('Feito!')
  // As medalhas, com as que faltam.
  await page.getByRole('button', { name: /Medalhas: \d+ de \d+/ }).click()
  const medalhas = page.getByRole('dialog', { name: 'Medalhas' })
  await expect(medalhas.getByRole('listitem').filter({ hasText: 'Topei o desafio' })).toHaveClass(/is-got/)
  await expect(medalhas.getByRole('listitem').filter({ hasText: 'Hábito de escritor' })).not.toHaveClass(/is-got/)
})

test('Oficina: técnicas, guias de mestre, gerador de ideias e exercícios feitos', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Oficina/ }).click()
  const oficina = page.getByRole('dialog', { name: 'Oficina' })
  await expect(oficina.getByRole('heading', { name: 'Técnicas' })).toBeVisible()
  await expect(oficina.getByRole('heading', { name: 'Para mestres de RPG' })).toBeVisible()

  // O gerador sorteia e guarda a ideia nas Ideias do universo.
  const ideias = oficina.getByRole('region', { name: 'Gerador de ideias' })
  await ideias.getByRole('radio', { name: 'Para a mesa' }).click()
  await expect(ideias.getByText('Quem pede')).toBeVisible()
  await ideias.getByRole('button', { name: 'Guardar em Ideias' }).click()
  await expect(ideias.getByRole('button', { name: 'Guardada em Ideias' })).toBeDisabled()

  // Um guia de mestre: os títulos são da mesa, e o exercício fica marcado como feito.
  await oficina.getByRole('button', { name: /^Mestrar/ }).click()
  await expect(oficina.getByRole('heading', { name: 'Para a próxima sessão' })).toBeVisible()
  await oficina.getByRole('button', { name: 'Marcar como feito' }).first().click()
  await expect(oficina.getByRole('button', { name: 'Feito', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await oficina.getByRole('button', { name: 'Todos os gêneros' }).click()
  await expect(oficina.getByRole('status')).toContainText('1 exercício feito')
  await expect(oficina.getByRole('button', { name: /^Mestrar/ })).toContainText('1/3 feitos')
  await oficina.getByRole('button', { name: 'Fechar a Oficina' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Ideias/ }).click()
  await expect(page.getByText(/pede ao grupo para/)).toBeVisible()
})
