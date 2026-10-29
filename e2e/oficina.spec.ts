import { expect, test, type Page } from './fixtures.ts'

const nav = (page: Page, name: string | RegExp) => page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name })

test('Oficina: página à parte, com o gênero do universo, curiosidades, exercício que vira cena e o voltar do aparelho', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('textbox', { name: 'Nome do novo universo' }).fill('Mar')
  await page.getByRole('radiogroup', { name: 'Começar como' }).getByRole('radio', { name: 'Fantasia' }).click()
  await page.getByRole('button', { name: 'Criar universo' }).click()
  await nav(page, 'Oficina').click()
  const oficina = page.getByRole('dialog', { name: 'Oficina' })
  await expect(oficina.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
  // Na primeira vez, a pergunta sugere a trilha do gênero do universo.
  await expect(oficina.getByRole('button', { name: /^Fantasia, o gênero do seu universo/ })).toBeVisible()

  // Um guia da biblioteca; o "voltar" do aparelho volta para a capa e depois fecha.
  await oficina.getByRole('tab', { name: 'Biblioteca' }).click()
  await expect(oficina.getByRole('button', { name: /^Fantasia.*o seu universo/ })).toBeVisible()
  await oficina.getByRole('button', { name: /^Mistério/ }).click()
  await expect(oficina.getByRole('heading', { name: 'Mistério', level: 1 })).toBeVisible()
  const livros = oficina.locator('details', { hasText: 'Livros para estudar' })
  await livros.locator('summary').click()
  await expect(livros).toContainText('E Não Sobrou Nenhum')
  // As curiosidades, uma de cada vez.
  const curiosidades = oficina.getByRole('region', { name: 'Você sabia?' })
  await expect(curiosidades).toContainText('Agatha Christie é, segundo o Guinness')
  await curiosidades.getByRole('button', { name: 'Próxima curiosidade' }).click()
  await expect(curiosidades).toContainText('Rua Morgue')
  await page.goBack()
  await expect(oficina.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
  await page.goBack()
  await expect(oficina).toHaveCount(0)

  // De novo, até o exercício: vira uma cena e a Oficina fecha.
  await nav(page, 'Oficina').click()
  await oficina.getByRole('button', { name: /^Mistério/ }).click()
  const exercicios = oficina.locator('details', { hasText: 'Mais exercícios' })
  await exercicios.locator('summary').click()
  await exercicios.getByRole('button', { name: 'Virar uma cena' }).first().click()
  await expect(oficina).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Título da cena' })).toHaveValue('Exercício: Três pistas')
  await page.getByRole('button', { name: 'Detalhes da cena' }).click()
  await expect(page.getByRole('region', { name: 'Detalhes da cena' })).toContainText('três detalhes')
})

test('Oficina também abre pela tela de universos', async ({ page }) => {
  await page.goto('/app/')
  // A Oficina é um setor do início, ao lado de Escrita e RPG.
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Oficina' }).click()
  await page.getByRole('tab', { name: 'Biblioteca' }).click()
  await page.getByRole('button', { name: /^Terror/ }).click()
  const oficina = page.getByRole('dialog', { name: 'Oficina' })
  // Fora de um universo, o exercício não vira cena, mas dá para treinar ali mesmo.
  await oficina.locator('details', { hasText: 'Mais exercícios' }).locator('summary').click()
  await expect(oficina.getByRole('button', { name: 'Treinar aqui' }).first()).toBeVisible()
  await expect(oficina.getByRole('button', { name: 'Virar uma cena' })).toHaveCount(0)
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
  await page.getByRole('tab', { name: 'Biblioteca' }).click()
  await page.getByRole('button', { name: /^Fantasia/ }).click()
  const oficina = page.getByRole('dialog', { name: 'Oficina' })
  await expect(oficina.getByRole('heading', { name: 'Fantasia', level: 1 })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: /Escrever melhor/ })).toBeVisible()
  await expect(page.getByText('O Papirus encontrou um erro.')).toHaveCount(0)
})

test('desafio do dia é o treino de hoje: bater o mínimo conta para a medalha', async ({ page }) => {
  await page.goto('/app/?exemplo=ostria')
  const card = page.getByRole('region', { name: 'Treino de hoje' })
  await expect(card).toBeVisible()
  const prompt = (await card.locator('.play-prompt').innerText()).trim()
  await card.getByRole('button', { name: 'Começar o treino' }).click()
  const treino = page.getByRole('dialog', { name: 'Treino de escrita' })
  await expect(treino.getByText(prompt)).toBeVisible()
  await treino.getByRole('button', { name: /^Aquecimento/ }).click()
  await treino.getByRole('button', { name: /^Começar/ }).click()
  await treino.getByRole('textbox', { name: 'Texto do treino' }).fill(Array.from({ length: 105 }, (_, i) => `palavra${i}`).join(' '))
  await treino.getByRole('button', { name: 'Terminar' }).click()
  await expect(treino.getByText('Mínimo batido!')).toBeVisible()
  await treino.getByRole('button', { name: 'Fechar o treino' }).click()
  await expect(card).toContainText('Feito hoje: 105 palavras em 5 min')
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

  // O gerador sorteia e guarda a ideia nas Ideias do universo.
  const ideias = oficina.getByRole('region', { name: 'Gerador de ideias' })
  await ideias.getByRole('radio', { name: 'Para a mesa' }).click()
  await expect(ideias.getByText('Quem pede')).toBeVisible()
  await ideias.getByRole('button', { name: 'Guardar em Ideias' }).click()
  await expect(ideias.getByRole('button', { name: 'Guardada em Ideias' })).toBeDisabled()

  // A biblioteca tem técnicas e guias de mestre.
  await oficina.getByRole('tab', { name: 'Biblioteca' }).click()
  await expect(oficina.getByRole('heading', { name: 'Técnicas' })).toBeVisible()
  await expect(oficina.getByRole('heading', { name: 'Para mestres de RPG' })).toBeVisible()

  // Um guia de mestre: os títulos são da mesa, e o exercício fica marcado como feito.
  await oficina.getByRole('button', { name: /^Mestrar/ }).click()
  const sessao = oficina.locator('details', { hasText: 'Para a próxima sessão' })
  await sessao.locator('summary').click()
  await sessao.getByRole('button', { name: 'Marcar como feito' }).first().click()
  await expect(sessao.getByRole('button', { name: 'Feito', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await oficina.getByRole('button', { name: 'Oficina', exact: true }).click()
  await expect(oficina.getByRole('button', { name: /^Mestrar/ })).toContainText('1/3 feitos')
  await oficina.getByRole('button', { name: 'Fechar a Oficina' }).click()
  await page.getByRole('navigation', { name: 'Áreas' }).getByRole('button', { name: /^Ideias/ }).click()
  await expect(page.getByText(/pede ao grupo para/)).toBeVisible()
})

test('Oficina: a trilha do passo de hoje, com lição, treino, contas, perguntas e caderno', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Oficina' }).click()
  // Na primeira vez: o que você quer treinar?
  await page.getByRole('button', { name: /^Escrever melhor/ }).click()
  await expect(page.getByRole('heading', { name: 'Fundamentos', level: 2 })).toBeVisible()
  await page.getByRole('button', { name: 'Começar a trilha' }).click()

  const passo = page.getByRole('dialog', { name: 'Oficina: Desejo e obstáculo' })
  await expect(passo.getByText('Toda cena fica mais viva')).toBeVisible()
  await passo.getByRole('button', { name: /^Escrever/ }).click()
  await passo.getByRole('textbox', { name: 'Texto do passo' }).fill('Lia queria o último lugar no ônibus. Um homem chegou antes. Ela ficou de pé, contando os pontos até o hospital.')
  await passo.getByRole('button', { name: 'Terminar' }).click()
  await expect(passo.getByText('Olhe o que escreveu')).toBeVisible()
  await expect(passo.getByRole('region', { name: 'As contas do texto' })).toContainText('Frases')
  await expect(passo.getByText(/Faltaram \d+ palavras para o mínimo/)).toBeVisible()
  await passo.getByRole('radiogroup', { name: 'Dá para dizer em uma frase o que a personagem quer?' }).getByRole('radio', { name: 'Sim' }).click()
  await passo.getByRole('button', { name: 'Concluir o passo' }).click()
  await expect(passo.getByText('Passo concluído')).toBeVisible()

  // O próximo passo tem palavras proibidas: o app avisa enquanto escreve.
  await passo.getByRole('button', { name: 'Próximo: Mostrar e contar' }).click()
  const mostrar = page.getByRole('dialog', { name: 'Oficina: Mostrar e contar' })
  await expect(mostrar.getByText('Ela dobrou o guardanapo pela quarta vez.')).toBeVisible()
  // Mão em movimento: apagar fica desligado.
  await mostrar.getByRole('checkbox', { name: /Mão em movimento/ }).check()
  await mostrar.getByRole('button', { name: /^Escrever/ }).click()
  const area = mostrar.getByRole('textbox', { name: 'Texto do passo' })
  await area.pressSequentially('Ela sentiu pavor')
  await expect(mostrar.getByText('Fora da regra: “pavor”')).toBeVisible()
  await area.press('Backspace')
  await expect(area).toHaveValue('Ela sentiu pavor')
  await expect(mostrar.getByText('Sem apagar até o fim')).toBeVisible()
  await mostrar.getByRole('button', { name: 'Terminar' }).click()
  await mostrar.getByRole('button', { name: 'Fechar o passo' }).click()

  // A trilha mostra o passo feito; em Hoje, o passo seguinte. O caderno guarda os textos.
  await expect(page.locator('.oficina-node.is-done')).toHaveCount(1)
  await page.getByRole('tab', { name: 'Hoje' }).click()
  await expect(page.getByRole('region', { name: 'Mostrar e contar' })).toContainText('passo 2 de 8')
  await page.getByRole('tab', { name: 'Caderno' }).click()
  await expect(page.locator('.oficina-cad-item')).toHaveCount(2)
  await page.locator('.oficina-cad-item summary', { hasText: 'Desejo e obstáculo' }).click()
  await expect(page.locator('.oficina-cad-item', { hasText: 'Desejo e obstáculo' })).toContainText('Sim')
})

test('Oficina: a imitação de Machado esconde o trecho e compara lado a lado', async ({ page }) => {
  await page.goto('/app/')
  await page.getByRole('navigation', { name: 'Setores' }).getByRole('button', { name: 'Oficina' }).click()
  await page.getByRole('tab', { name: 'Trilhas' }).click()
  await page.getByRole('button', { name: /^Fundamentos/ }).click()
  await page.getByRole('button', { name: /^Imitação: Machado de Assis/ }).click()
  const passo = page.getByRole('dialog', { name: 'Oficina: Imitação: Machado de Assis' })
  await expect(passo.getByText(/As crônicas da vila de Itaguaí/)).toBeVisible()
  await passo.getByRole('button', { name: 'Já li · esconder o trecho' }).click()
  await expect(passo.getByText(/As crônicas da vila de Itaguaí/)).toHaveCount(0)
  await expect(passo.getByRole('list', { name: 'Palavras-chave' })).toContainText('Simão Bacamarte')
  await passo.getByRole('textbox', { name: 'Texto do passo' }).fill('Contam as crônicas de Itaguaí que ali viveu um médico, o Dr. Simão Bacamarte, o maior médico do Brasil.')
  await passo.getByRole('button', { name: 'Comparar' }).click()
  await expect(passo.getByText(/das palavras de Machado voltaram no seu texto/)).toBeVisible()
  await expect(passo.getByRole('region', { name: 'O original' }).locator('mark', { hasText: 'Bacamarte' })).toBeVisible()
})
