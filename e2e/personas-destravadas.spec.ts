import { zipSync, strToU8 } from 'fflate'
import { expect, test } from './fixtures.ts'

// Auditoria 26: onde cada persona travou, refeito do jeito que ela faria.

test.describe('no computador', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Rafa: o NPC criado na Mesa vira ficha do Mundo e se revela no Codex', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: /Mesa/ }).click()
    await page.getByRole('textbox', { name: 'Nome da campanha' }).fill('Sombras de Varn')
    await page.getByRole('button', { name: 'Criar campanha' }).click()
    await page.getByRole('tab', { name: 'Grupo' }).click()
    await page.getByRole('radio', { name: 'NPC do mestre' }).click()
    await page.locator('#nova-ficha-jogo').fill('Corvo Velho')
    await page.getByRole('button', { name: 'Criar personagem' }).click()

    await page.getByRole('tab', { name: 'Codex' }).click()
    await page.getByPlaceholder('Buscar ficha…').fill('Corvo')
    await page.getByRole('option', { name: /Corvo Velho/ }).first().click()
    await page.getByRole('button', { name: 'Revelar', exact: true }).click()
    await expect(page.getByRole('region', { name: /Como a mesa vê/i }).or(page.locator('.codex-preview, .codex')).first()).toContainText('Corvo Velho')
  })

  test('Duda: “Já tenho um mundo em outro app” abre o importador, e as ligações escritas viram propostas', async ({ page }) => {
    await page.goto('/app/')
    await page.getByRole('button', { name: /Já tenho um mundo em outro app/ }).click()
    const janela = page.getByRole('dialog', { name: 'Trazer de outro app' })
    await expect(janela).toBeVisible()
    const zip = zipSync({
      'Meu Mundo/Personagens/Kael.md': strToU8('# Kael\nIrmão de [[Mira]]. Nasceu no [[Porto de Varn]] e serve à [[Casa Vaelor]].'),
      'Meu Mundo/Personagens/Mira.md': strToU8('# Mira\nIrmã de [[Kael]].'),
      'Meu Mundo/Lugares/Porto de Varn.md': strToU8('# Porto de Varn\nCidade de sal.'),
      'Meu Mundo/Facções/Casa Vaelor.md': strToU8('# Casa Vaelor\nA casa real.'),
    })
    await janela.locator('input[type=file]').setInputFiles({ name: 'mundo.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) })
    await janela.getByRole('button', { name: /Trazer 4 fichas/ }).click()

    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: 'Mundo', exact: true }).click()
    await page.locator('[data-tour="partes"]').getByRole('button', { name: 'Ligações' }).click()
    const faixa = page.getByRole('region', { name: 'Ligações achadas no texto' })
    await expect(faixa).toContainText('3 ligações')
    await faixa.getByRole('button', { name: 'Ver e aceitar' }).click()
    const lista = page.getByRole('dialog', { name: 'Ligações achadas no texto' })
    await expect(lista).toContainText('Kael irmão de Mira')
    await expect(lista).toContainText('Kael nasceu em Porto de Varn')
    await expect(lista).toContainText('Kael serve a Casa Vaelor')
    // Desmarca uma: as outras viram ligação, e a desmarcada não volta a ser proposta.
    await lista.getByRole('checkbox').nth(1).uncheck()
    await lista.getByRole('button', { name: 'Criar 2 ligações' }).click()
    await expect(faixa).toHaveCount(0)
    await expect(page.locator('.graph .edge').first()).toBeAttached()
  })
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('Lia: a protagonista que abre duas frases aparece, o “Salvo” não cobre as abas e o livro tem o nome do universo', async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem('papirus:escrita-modo', 'pagina'))
    await page.goto('/app/')
    await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('A Coroa de Sal')
    await page.getByRole('radio', { name: 'Fantasia' }).click()
    await page.getByRole('button', { name: 'Criar universo' }).click()
    await page.getByRole('button', { name: /Começar a escrever/ }).first().click()
    await page.getByRole('textbox', { name: 'Texto da cena' }).click()
    await page.keyboard.type('Selene chegou ao porto de Varn. Selene sorriu para o mar.')
    // O “Salvo” aparece embaixo, longe das abas Estrutura · Página · Revisão.
    const selo = page.locator('.mobile-save.is-shown')
    await expect(selo).toBeVisible({ timeout: 5000 })
    const abas = (await page.locator('[data-tour="modos"]').boundingBox())!
    expect((await selo.boundingBox())!.y).toBeGreaterThan(abas.y + abas.height + 200)
    // A Selene (duas vezes no começo da frase) está entre os nomes novos.
    await page.getByRole('button', { name: 'Fechar o teclado' }).click().catch(() => {})
    await page.getByRole('button', { name: /nomes? novos?/ }).first().click()
    await expect(page.getByRole('dialog').first()).toContainText('Selene')
    await expect(page.getByRole('dialog').first()).toContainText('Selecione ele no texto')
    await page.getByRole('dialog').first().getByRole('button', { name: /^Fechar/ }).first().click()

    // O primeiro livro nasce com o nome do universo, e não “Livro I”.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^(Mais|Menu)/ }).click()
    await page.getByRole('group', { name: 'Escrever' }).getByRole('button', { name: /^Publicar/ }).click()
    await page.getByRole('button', { name: 'Criar o livro' }).click()
    await expect(page.getByText('Diagramar: A Coroa de Sal')).toBeVisible()
  })

  test('Beto: “Ou só ler o livro” na apresentação abre direto no leitor', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Ou só ler o livro' }).click()
    await expect(page.getByRole('dialog', { name: 'Modo leitor' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('dialog', { name: 'Modo leitor' }).getByRole('heading', { name: 'O ciclone' })).toBeVisible()
  })
})
