import { expect, test } from './fixtures.ts'

const nav = (page: import('@playwright/test').Page, name: string) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name, exact: true })

test('tabelas de sorteio no Mundo: criar, encadear uma na outra e rolar', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible()
  await nav(page, 'Mundo').click()
  await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }).click()
  const grade = page.getByRole('region', { name: 'O que vamos criar hoje?' })
  if (!(await grade.getByRole('button', { name: 'Tabela' }).isVisible())) await grade.getByRole('button', { name: 'O que vamos criar hoje?' }).click()
  await grade.getByRole('button', { name: 'Tabela' }).click()
  const janela = page.getByRole('dialog', { name: 'Tabelas de sorteio' })

  // Uma tabela de tavernas e outra de rumores que chama a primeira.
  for (const [nome, linhas] of [
    ['Taverna', 'O Javali Bêbado'],
    ['Rumores', 'Dizem que o rei bebe n{Taverna}.'],
  ] as const) {
    await janela.getByRole('textbox', { name: 'Nome da tabela' }).first().fill(nome)
    await janela.getByRole('button', { name: 'Tabela', exact: true }).click()
    await janela.getByRole('textbox', { name: new RegExp(`Opções de ${nome}`) }).fill(linhas)
  }
  await janela.locator('.table-card').last().getByRole('button', { name: /Rolar/ }).click()
  await expect(janela.locator('.table-result')).toHaveText('Dizem que o rei bebe nO Javali Bêbado.')
})
