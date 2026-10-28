import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('tour na primeira vez: destaca as partes, pode ser pulado e refeito', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()

  // Começa sozinho.
  const tour = page.getByRole('dialog', { name: 'Bem-vindo ao Papirus' })
  await expect(tour).toBeVisible()
  await expect(tour.getByRole('button', { name: 'Rápido' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('.tour-card').analyze()
  expect(violations.map((v) => v.id)).toEqual([])

  await tour.getByRole('button', { name: 'Rápido' }).click()
  await expect(page.getByRole('dialog', { name: 'O menu' })).toContainText('1 de 12')
  await expect(page.locator('.tour-spot')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Seus universos' })).toBeVisible()

  // Vai mudando de área quando precisa.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Próximo' }).click()
  await expect(page.getByRole('dialog', { name: 'Escrever' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Texto da cena' })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByRole('dialog', { name: 'Início' })).toBeVisible()

  // Pular (Esc) fecha e não volta sozinho.
  await page.keyboard.press('Escape')
  await expect(page.locator('.tour')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Exemplo — O Alienista' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Exemplo — O Alienista' })).toBeVisible()
  await page.waitForTimeout(1200)
  await expect(page.locator('.tour')).toHaveCount(0)

  // Refazer pelo Início, agora o completo, até o fim: passa por cada área.
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Ajustes e dados' }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Menu e ajuda' }).click()
  await page.getByRole('button', { name: 'Refazer o tour' }).click()
  await page.getByRole('dialog', { name: 'Bem-vindo ao Papirus' }).getByRole('button', { name: 'Completo' }).click()
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Relações' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Relações' }).first()).toBeVisible()
  for (let i = 0; i < 30 && !(await page.getByRole('button', { name: 'Começar' }).count()); i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Pronto!' })).toBeVisible()
  await page.getByRole('button', { name: 'Começar' }).click()
  await expect(page.locator('.tour')).toHaveCount(0)
})

test('dá para sair do mundo de exemplo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await expect(page.getByText('Mundo de exemplo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair do exemplo' }).click()
  await expect(page.getByRole('navigation', { name: 'Setores' })).toBeVisible()
  // O exemplo fica à parte dos universos da pessoa.
  await expect(page.getByRole('list', { name: 'Universos' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Continuar o exemplo' }).click()
  await page.getByRole('button', { name: 'Seus universos' }).click()
  await expect(page.getByRole('navigation', { name: 'Setores' })).toBeVisible()
})

test('aviso do exemplo é discreto, dá para esconder, e exemplo antigo vira o atual', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('papirus:prefs', JSON.stringify({ tourDone: true })))
  await page.goto('/app/')
  await page.getByRole('button', { name: 'Abrir um universo de exemplo' }).click()
  await expect(page.getByText('Mundo de exemplo', { exact: true })).toBeVisible()

  // Simula um exemplo de uma versão antiga do Papirus.
  await page.getByRole('button', { name: 'Ajustes e dados' }).click()
  await page.getByRole('navigation', { name: 'Categorias dos ajustes' }).getByRole('button', { name: 'Universo', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Exemplo velho')
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Universo de exemplo. Um reino em ruínas, um estranho de rosto pálido e uma herdeira que não sabe quem é.')
  await expect(page.getByRole('status').filter({ hasText: 'Salvo' }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Esconder este aviso' }).click()
  await expect(page.getByText('Mundo de exemplo', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: /trocar de universo/i }).first().click()
  await expect(page.getByRole('region', { name: 'Exemplo velho' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar o exemplo' }).click()
  // Trocado pelo exemplo atual, e o aviso continua escondido.
  await expect(page.getByRole('button', { name: 'Exemplo — O Alienista: trocar de universo' })).toBeVisible()
  await expect(page.getByText('Mundo de exemplo', { exact: true })).toHaveCount(0)
})
