import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

/*
 * Jornada de quem escreve, no celular, do zero ao livro e à wiki: cria o universo, escreve 3 cenas, cria
 * personagens pela Revisão, monta um lugar no mapa, dá uma língua a um povo, marca um segredo, diagrama o
 * livro e baixa a wiki. Conta os toques por etapa (auditoria 15).
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

function counter() {
  let taps = 0
  const marks: Record<string, number> = {}
  return {
    tap: async (l: Locator) => {
      taps++
      await l.click()
    },
    mark: (etapa: string) => {
      marks[etapa] = taps
    },
    marks: () => marks,
  }
}

const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })
const editor = (page: Page) => page.getByRole('textbox', { name: 'Texto da cena' })

test('a escritora vai do zero ao livro e à wiki', async ({ page }) => {
  test.setTimeout(90_000)
  const { tap, mark, marks } = counter()

  // 1. Cria o universo.
  await page.goto('/')
  await tap(page.getByRole('link', { name: 'Começar a escrever' }).first())
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Maré Alta')
  await tap(page.getByRole('button', { name: 'Criar universo' }))
  await expect(nav(page, 'Escrever')).toBeVisible()
  mark('1 universo')

  // 2. Escreve 3 cenas.
  await tap(page.getByRole('button', { name: 'Começar a escrever' }).first())
  await tap(editor(page))
  await page.keyboard.type('Era noite em Ostria quando Kaya desceu do navio. O capitão Brenn esperava no cais.')
  const cenas = ['Kaya seguiu Brenn pela escadaria da Torre de Marfim, sem dizer nada.', 'No alto da torre, Brenn abriu a janela e mostrou o mar a Kaya.']
  for (const [i, texto] of cenas.entries()) {
    await tap(page.getByRole('button', { name: 'Nova cena depois desta' }))
    // Espera a cena nova abrir (digitar antes disso perde as primeiras letras: ninguém digita em 50 ms).
    await expect(page.locator('.page-pos')).toContainText(`cena ${i + 2} de`)
    await page.waitForTimeout(500)
    await tap(editor(page))
    await expect(editor(page)).toBeFocused()
    await page.keyboard.type(texto)
    await expect(editor(page)).toContainText(texto)
  }
  await expect(page.locator('.page-pos')).toContainText('cena 3 de 3')
  mark('2 três cenas')

  // 3. Cria os personagens e o lugar pela Revisão (todo o manuscrito).
  await tap(editor(page))
  await tap(page.getByRole('toolbar', { name: 'Formatação' }).getByRole('button', { name: /nomes? novos?/ }))
  const revisao = page.getByRole('dialog', { name: 'Revisão' })
  await tap(revisao.getByText('Todo o manuscrito', { exact: true }))
  for (const nome of ['Kaya', 'Brenn', 'Ostria']) {
    const candidato = revisao.locator('.candidate').filter({ has: page.locator('.candidate-name', { hasText: new RegExp(`^${nome}$`) }) })
    await tap(candidato.getByRole('button', { name: 'Criar ficha' }))
    await expect(page.getByText(`Ficha “${nome}” criada`)).toBeVisible()
  }
  await page.keyboard.press('Escape')
  mark('3 fichas pela Revisão')

  // 4. Monta um lugar no mapa: gera um continente e marca Ostria.
  await tap(nav(page, /^Mundo/))
  await tap(page.locator('[data-tour="partes"]').getByRole('button', { name: 'Mapas' }))
  await tap(page.getByRole('button', { name: 'Gerar', exact: true }))
  await tap(page.getByRole('button', { name: 'Marcar lugar' }))
  const mapa = page.locator('.atlas-image').first()
  const box = (await mapa.boundingBox())!
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.45)
  const qual = page.getByRole('combobox', { name: /Lugar/ }).or(page.getByPlaceholder('Lugar…')).first()
  await qual.fill('Ostria')
  await tap(page.getByRole('option', { name: /Ostria/ }).first().or(page.getByRole('button', { name: /^Ostria/ }).first()))
  await expect(page.locator('.pin')).toHaveCount(1)
  mark('4 lugar no mapa')

  // 5. Dá uma língua a um povo (uma cultura com sílabas).
  await tap(page.locator('[data-tour="partes"]').getByRole('button', { name: 'Fichas' }))
  await tap(page.getByRole('button', { name: 'Nova ficha' }))
  const nova = page.getByRole('dialog', { name: 'Nova ficha' })
  await nova.getByRole('textbox', { name: 'Nome' }).fill('Gente do Sal')
  await nova.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Cultura' })
  await tap(nova.getByRole('button', { name: 'Criar e abrir' }))
  // A ficha nasce em cartas; aqui a jornada vai direto para a Língua (as cartas têm a sua spec).
  await tap(page.getByRole('dialog', { name: /^Nascimento/ }).getByRole('button', { name: 'Pular' }))
  const idioma = page.locator('details.fold', { has: page.locator('summary', { hasText: 'Língua' }) })
  await tap(idioma.locator('summary'))
  await idioma.getByLabel('Sílabas').fill('sal- vo ra mi -dun -esh')
  await tap(idioma.getByRole('button', { name: 'Pessoas' }))
  await expect(idioma.getByLabel('Nomes de pessoas')).toContainText('Pessoas:')
  mark('5 língua do povo')

  // 6. Marca um segredo na última cena.
  await tap(nav(page, 'Escrever'))
  await tap(editor(page))
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' [segredo]Kaya é a herdeira perdida de Ostria.[/segredo]')
  await expect(editor(page)).toContainText('herdeira perdida')
  await page.waitForTimeout(800)
  mark('6 segredo')

  // 7. Diagrama o livro (com o teclado aberto a barra de baixo some: um toque para fechá-lo).
  await tap(page.getByRole('button', { name: 'Fechar o teclado' }))
  await tap(page.getByRole('button', { name: 'Mais', exact: true }))
  await tap(page.getByRole('group', { name: 'Todas as áreas' }).getByRole('button', { name: 'Publicar' }))
  await tap(page.getByRole('button', { name: 'Criar o livro' }))
  const designer = page.getByRole('dialog', { name: 'Diagramar o livro' })
  await tap(designer.getByRole('button', { name: /^Fantasia/ }))
  await tap(designer.getByRole('button', { name: 'Fechar' }))
  await expect(page.locator('[data-tour="livro-acoes"]')).toBeVisible()
  mark('7 livro diagramado')

  // 8. Baixa a wiki: o segredo não vai junto.
  await tap(page.locator('[data-tour="livro-acoes"]').getByRole('button', { name: /Baixar/ }))
  await tap(page.getByRole('menuitem', { name: /Wiki do mundo/ }).or(page.getByRole('button', { name: /Wiki do mundo/ })).first())
  const wiki = page.getByRole('dialog', { name: 'Wiki do mundo' })
  const download = page.waitForEvent('download')
  await tap(wiki.getByRole('button', { name: /Baixar a wiki/ }))
  const arquivo = await (await download).path()
  const html = await readFile(arquivo, 'utf8')
  expect(html).toContain('Kaya')
  expect(html).not.toContain('herdeira perdida')
  mark('8 wiki baixada')

  expect(marks()['8 wiki baixada'], 'toques da jornada inteira').toBeLessThanOrEqual(45)
  console.log('TOQUES ACUMULADOS POR ETAPA', JSON.stringify(marks()))
})

