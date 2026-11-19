import { expect, test, type Page } from './fixtures.ts'
import { fichaModo } from './areas.ts'

test('lixeira e histórico: apagar, recuperar e voltar como estava', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('button', { name: /^Kael/ }).first().click()
  const resumo = page.getByRole('textbox', { name: 'Resumo' })
  const original = await resumo.inputValue()
  await resumo.fill('Contrabandista. Mudei isto.')

  // Apaga a ficha (com confirmação).
  await page.getByRole('button', { name: 'Apagar ficha' }).click()
  await page.getByRole('button', { name: 'Apagar ficha' }).last().click()
  await expect(page.getByRole('button', { name: /^Kael/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Ajustes e dados' }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Lixeira e histórico' }).click()
  const lixeira = page.getByRole('region', { name: 'Lixeira' })
  await expect(lixeira).toContainText(/Kael \(e \d+ ligaç/)
  const historico = page.getByRole('region', { name: 'Histórico de mudanças' })
  await expect(historico).toContainText('Você apagou a ficha Kael')
  await expect(historico).toContainText('Você editou a ficha')

  await lixeira.getByRole('button', { name: 'Recuperar' }).click()
  await expect(lixeira).toContainText('A lixeira está vazia.')
  await expect(historico).toContainText('Você recuperou a ficha')

  // Voltar a como estava antes da edição do resumo.
  await historico.getByRole('listitem').filter({ hasText: 'editou a ficha' }).getByRole('button', { name: 'Voltar a como estava' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
  await page.getByRole('button', { name: /^Kael/ }).first().click()
  await expect(page.getByRole('textbox', { name: 'Resumo' })).toHaveValue(original)
})

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })
const tree = (page: Page) => page.getByRole('complementary', { name: 'Manuscrito' })

async function openTrash(page: Page) {
  await page.getByRole('button', { name: 'Ajustes e dados' }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Lixeira e histórico' }).click()
  return page.getByRole('region', { name: 'Lixeira' })
}

test('com mais de um livro: apagar cenas e livros e recuperar devolve cada cena ao livro certo, e o livro dela vem junto', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Mar')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.getByRole('textbox', { name: 'Título da cena' }).fill('Prólogo')
  // Dois livros, cada um com cenas.
  for (const nome of ['Livro um', 'Livro dois']) {
    await tree(page).getByRole('button', { name: 'Nova história' }).click()
    await tree(page).getByRole('region', { name: 'Nova história' }).getByRole('textbox', { name: 'Título da história' }).fill(nome)
  }
  for (const [livro, cena] of [['Livro um', 'Um-A'], ['Livro dois', 'Dois-A'], ['Livro dois', 'Dois-B']] as const) {
    await tree(page).getByRole('region', { name: livro }).getByRole('button', { name: 'Nova cena' }).click()
    await page.getByRole('textbox', { name: 'Título da cena' }).fill(cena)
  }
  const livro = (nome: string) => tree(page).getByRole('region', { name: nome })
  await expect(livro('Livro dois')).toContainText('Dois-A')
  await expect(livro('Livro dois')).toContainText('Dois-B')

  // Apaga a cena Dois-B e, depois, o Livro dois inteiro (a Dois-A vira cena solta).
  await livro('Livro dois').getByRole('button', { name: 'Dois-B', exact: true }).click()
  await page.getByRole('button', { name: 'Mais ações da cena' }).click()
  await page.getByRole('button', { name: 'Apagar cena' }).click()
  await page.getByRole('group', { name: 'Apagar esta cena?' }).getByRole('button', { name: 'Apagar cena' }).click()
  await expect(tree(page).getByRole('button', { name: 'Dois-B', exact: true })).toHaveCount(0)
  await livro('Livro dois').getByRole('button', { name: 'Remover história' }).click()
  await livro('Livro dois').getByRole('button', { name: 'Remover história' }).click()
  await expect(livro('Livro dois')).toHaveCount(0)
  await expect(tree(page).getByRole('region', { name: 'Sem capítulo' })).toContainText('Dois-A')

  // A lixeira diz o que volta junto.
  let lixeira = await openTrash(page)
  const itemLivro = lixeira.getByRole('listitem').filter({ hasText: 'Livro dois' }).filter({ hasText: 'Remov' }).or(lixeira.getByRole('listitem').filter({ hasText: /história/ }))
  await expect(itemLivro.first()).toContainText('A cena dele ficou solta; volta para o livro ao recuperar.')
  const itemCena = lixeira.getByRole('listitem').filter({ hasText: 'Dois-B' })
  await expect(itemCena).toContainText('O livro dela, “Livro dois”, também está na lixeira e volta junto.')

  // Recupera a cena: o livro dela volta junto, e a outra cena (a Dois-A) também volta para ele.
  await itemCena.getByRole('button', { name: 'Recuperar' }).click()
  await expect(lixeira).toContainText('A lixeira está vazia.')
  await nav(page, 'Escrever').click()
  await expect(livro('Livro dois')).toContainText('Dois-A')
  await expect(livro('Livro dois')).toContainText('Dois-B')
  await expect(livro('Livro um')).toContainText('Um-A')
  await expect(livro('Livro um')).not.toContainText('Dois')
  await expect(tree(page).getByRole('region', { name: 'Sem capítulo' })).not.toContainText('Dois')
  await expect(tree(page).getByRole('region', { name: 'Sem capítulo' })).toContainText('Prólogo')

  // Apaga o livro de novo e recupera só o livro: as duas cenas voltam para ele, na ordem de antes.
  await livro('Livro dois').getByRole('button', { name: 'Remover história' }).click()
  await livro('Livro dois').getByRole('button', { name: 'Remover história' }).click()
  lixeira = await openTrash(page)
  await lixeira.getByRole('button', { name: 'Recuperar' }).click()
  await nav(page, 'Escrever').click()
  expect((await livro('Livro dois').locator('.tree-scene-link').allInnerTexts()).map((t) => t.match(/Dois-[AB]/)![0])).toEqual(['Dois-A', 'Dois-B'])
  await expect(tree(page).getByRole('region', { name: 'Sem capítulo' })).not.toContainText('Dois')
})

test('apagar uma ficha e recuperar: volta com as ligações, o ponto de vista das cenas e quem estava presente', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await nav(page, 'Mundo').click()
  await page.getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  // Antes: Kael é irmão da Mira e desconfia de gente.
  const ficha = page.getByRole('region', { name: 'Ficha: E se sumir?' }).or(page.getByRole('main'))
  await expect(ficha.first()).toContainText('irmão de')

  await page.getByRole('button', { name: 'Mais da ficha' }).click()
  await page.getByRole('button', { name: 'Apagar ficha' }).click()
  await page.getByRole('button', { name: 'Apagar ficha' }).last().click()
  await expect(page.getByRole('button', { name: /^Kael/ })).toHaveCount(0)
  // Sem ele, a cena "A chegada" fica sem ponto de vista.
  await nav(page, 'Escrever').click()
  await page.getByRole('button', { name: /A chegada/ }).first().click()
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  const detalhes = page.getByRole('region', { name: 'Detalhes da cena' })
  await expect(detalhes).toContainText('Ponto de vista')
  await expect(detalhes).not.toContainText('Kael')

  const lixeira = await openTrash(page)
  await lixeira.getByRole('button', { name: 'Recuperar' }).click()
  await expect(lixeira).toContainText('A lixeira está vazia.')

  // Depois: a ficha, as ligações e o ponto de vista da cena voltaram.
  await nav(page, 'Mundo').click()
  await page.getByRole('button', { name: /^Kael/ }).first().click()
  await fichaModo(page, 'Ler')
  await expect(ficha.first()).toContainText('irmão de')
  await nav(page, 'Escrever').click()
  await page.getByRole('button', { name: /A chegada/ }).first().click()
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  await expect(page.getByRole('region', { name: 'Detalhes da cena' }).locator('.picker-value', { hasText: 'Kael' }).first()).toBeVisible()
})
