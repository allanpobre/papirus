import { expect, test, type Page } from './fixtures.ts'

/*
 * O texto alimenta o mundo (só regras): o primeiro nome sozinho vira proposta de apelido na margem, e um trecho
 * selecionado cria a fase do personagem ("Muda ou revela"). Nada muda sem um toque.
 */
const editor = (page: Page) => page.getByRole('textbox', { name: 'Texto da cena' })
const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })

test('sugestão de apelido na margem e "Muda ou revela" na seleção', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Brumas')
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await nav(page, /^Mundo/).click()
  await page.getByRole('textbox', { name: 'Nome da nova ficha' }).fill('Ilvani Saren')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await nav(page, 'Escrever').click()
  await page.getByRole('button', { name: 'Começar a escrever' }).click()
  await page.keyboard.type('Ilvani Saren chegou ao porto. Ilvani perdeu a mão esquerda na luta.')

  // A margem propõe "Ilvani" como apelido; aceitar liga as duas menções.
  const sugestoes = page.getByRole('region', { name: 'Sugestões do texto' })
  await expect(sugestoes).toContainText('“Ilvani” aparece sozinho 1 vez')
  await sugestoes.getByRole('button', { name: 'Aceitar' }).click()
  await expect(sugestoes).toHaveCount(0)

  // Um trecho muda o personagem: vira uma fase com a causa.
  await editor(page).evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
    const t = 'perdeu a mão esquerda'
    const node = nodes.find((n) => n.data.includes(t))!
    const range = document.createRange()
    range.setStart(node, node.data.indexOf(t))
    range.setEnd(node, node.data.indexOf(t) + t.length)
    getSelection()!.removeAllRanges()
    getSelection()!.addRange(range)
  })
  await page.getByRole('toolbar', { name: 'Ações da seleção' }).getByRole('button', { name: 'Muda ou revela' }).click()
  const dialog = page.getByRole('dialog', { name: 'Muda ou revela' })
  await expect(dialog.getByRole('combobox', { name: 'Quem' })).toHaveValue(/.+/)
  await dialog.getByRole('textbox', { name: 'Nome da fase (opcional)' }).fill('Sem a mão')
  await dialog.getByRole('button', { name: 'Criar fase' }).click()
  await expect(page.getByText('Nova fase de Ilvani Saren')).toBeVisible()

  // Na ficha: a fase, com o trecho como o porquê.
  await nav(page, /^Mundo/).click()
  await page.getByRole('region', { name: 'Lista de fichas' }).getByRole('button', { name: /^Ilvani/ }).first().click()
  await expect(page.getByRole('textbox', { name: 'Nome da fase' })).toHaveValue('Sem a mão')
  await expect(page.getByRole('textbox', { name: 'Por quê' })).toHaveValue('perdeu a mão esquerda')
})
