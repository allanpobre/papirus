import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createUniverse } from '../model/universe'
import { applyForeign, readForeign, unzipText, type ForeignFile } from './foreignWorld'

/*
 * Arquivos de exemplo no formato de exportação de cada app (e2e/fixtures/importar), feitos à mão com acentos,
 * imagens e links internos. Não são exportações reais: foram escritos a partir de como cada app guarda as coisas.
 */
const root = join(process.cwd(), 'e2e/fixtures/importar')
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
const IMG = /\.(png|jpe?g|webp|gif)$/i
const load = (sub: string): ForeignFile[] =>
  walk(join(root, sub))
    .filter((p) => /\.(md|json|png|jpe?g|webp|gif)$/i.test(p))
    .map((p) => (IMG.test(p) ? { path: relative(root, p), text: '', bytes: new Uint8Array(readFileSync(p)) } : { path: relative(root, p), text: readFileSync(p, 'utf8') }))
const byName = (w: ReturnType<typeof readForeign>, name: string) => w.entities.find((e) => e.name === name)!

describe('Obsidian: um cofre de verdade', () => {
  const w = readForeign(load('obsidian'))
  const kael = byName(w, 'Kael Arvoredo')

  it('uma ficha por nota, com o tipo da pasta ou do cabeçalho, e sem os moldes (Modelos)', () => {
    expect(w.sources).toEqual(['Obsidian (Markdown)'])
    expect(w.entities.map((e) => e.name).sort()).toEqual(['A Canção do Farol', 'Casa Valmar', 'Kael Arvoredo', 'Mira Arvoredo', 'Porto Velho', 'Torre de Marfim'])
    expect(w.entities.some((e) => /\{\{/.test(e.name))).toBe(false)
    expect(kael.kind).toBe('personagem')
    expect(byName(w, 'Porto Velho').kind).toBe('lugar')
    expect(byName(w, 'Casa Valmar').kind).toBe('faccao')
    expect(byName(w, 'A Canção do Farol').kind).toBe('documento')
  })

  it('os links [[…]] viram o nome (com título, alias e bloco), sem sobras de sintaxe', () => {
    expect(kael.description).toContain('Contrabandista do porto de Porto Velho.')
    expect(kael.description).toContain('Irmão de Mira Arvoredo e devedor da Casa Valmar.')
    expect(kael.description).not.toMatch(/\[\[|\]\]|#\^|\^origem/)
    expect(byName(w, 'Mira Arvoredo').description).not.toContain('^origem')
  })

  it('comentários, dataview e anexos ficam de fora; a chamada vira citação; o resumo é o texto corrido', () => {
    expect(kael.description).not.toContain('%%')
    expect(kael.description).not.toContain('dataview')
    expect(kael.description).not.toContain('![[')
    expect(kael.description).toContain('> Kael')
    expect(kael.description).toContain('A maré não perdoa quem hesita.')
    expect(kael.summary).toBe('Contrabandista do porto de Porto Velho.')
    // A tabela continua (é texto).
    expect(kael.description).toContain('| 340 | Chega ao porto |')
  })

  it('as propriedades do cabeçalho viram campos (sem os links), e as etiquetas e apelidos vêm junto', () => {
    expect(kael.fields).toEqual([
      { key: 'Idade', value: '34' },
      { key: 'Moradia', value: 'Porto Velho' },
      { key: 'Aliança', value: 'Casa Valmar' },
    ])
    expect(kael.aliases).toEqual(['Kael', 'O Contrabandista'])
    expect(kael.tags).toEqual(expect.arrayContaining(['personagem', 'porto', 'contrabando']))
    expect(kael.tags).not.toContain('#porto')
  })

  it('a imagem que a nota mostrava vem junto (pelo nome do arquivo, mesmo em outra pasta)', () => {
    expect(kael.imageFile?.name).toBe('retrato-kael.png')
    expect(kael.imageFile!.bytes.length).toBeGreaterThan(20)
    // O PNG de verdade (assinatura).
    expect([...kael.imageFile!.bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47])
    expect(byName(w, 'Porto Velho').imageFile).toBeNull()
  })

  it('o mesmo cofre em .zip (como o Obsidian leva) dá as mesmas fichas, com a imagem', () => {
    const files: Record<string, Uint8Array> = {}
    for (const p of walk(join(root, 'obsidian'))) files[relative(join(root, 'obsidian'), p).replace(/\\/g, '/')] = new Uint8Array(readFileSync(p))
    const zip = readForeign(unzipText('Cofre de Valmar.zip', zipSync(files)))
    expect(zip.entities.map((e) => e.name).sort()).toEqual(w.entities.map((e) => e.name).sort())
    expect(byName(zip, 'Kael Arvoredo').imageFile?.name).toBe('retrato-kael.png')
    // A configuração do Obsidian (.obsidian) não entra.
    expect(zip.skipped).toBeLessThanOrEqual(w.skipped + 1)
  })
})

describe('Kanka: a exportação da campanha', () => {
  const w = readForeign(load('kanka'))
  it('o tipo vem do arquivo (characters.json, locations.json…) e o subtipo vira o campo "Tipo"', () => {
    expect(w.sources).toEqual(['Kanka'])
    expect(w.entities).toHaveLength(6)
    expect(byName(w, 'Aldric Valmar').kind).toBe('personagem')
    expect(byName(w, 'Valmar').kind).toBe('lugar')
    expect(byName(w, 'Pedra Alta').kind).toBe('lugar')
    expect(byName(w, 'Ordem do Farol').kind).toBe('faccao')
    expect(byName(w, 'Profecia do Mar Calmo').kind).toBe('documento')
  })

  it('as menções [location:2] viram o nome, com ou sem o texto pronto do app', () => {
    // Com entry_parsed (os links já escritos).
    expect(byName(w, 'Aldric Valmar').description).toContain('Aldric governa Valmar com mão de ferro. Seu irmão, Brant Valmar, foi exilado.')
    expect(byName(w, 'Aldric Valmar').description).toContain('Chefe da Ordem do Farol.')
    // Só com o "entry": o nome vem do que a própria exportação diz, ou do apelido da menção.
    expect(byName(w, 'Brant Valmar').description).toContain('Irmão mais novo de Aldric Valmar. Vive escondido em Pedra Alta e sabe onde está a coroa.')
    expect(byName(w, 'Ordem do Farol').description).toContain('Seu chefe é o Rei.')
    expect(byName(w, 'Pedra Alta').description).toContain('Perto de Valmar.')
    for (const e of w.entities) expect(e.description, e.name).not.toMatch(/\[\w+:\d+|  /)
  })

  it('idade, título, pronomes e tipo viram campos; listas e citações mantêm a forma', () => {
    expect(byName(w, 'Aldric Valmar').fields).toEqual([
      { key: 'Título', value: 'Rei de Valmar' },
      { key: 'Tipo', value: 'Rei' },
      { key: 'Idade', value: '52' },
      { key: 'Sexo', value: 'homem' },
      { key: 'Pronomes', value: 'ele/dele' },
    ])
    expect(byName(w, 'Valmar').description).toContain('- Porto\n- Mercado das Sombras')
    expect(byName(w, 'Profecia do Mar Calmo').description).toContain('> Quando o mar calar, a coroa voltará.')
    expect(byName(w, 'Profecia do Mar Calmo').summary).toBe('Registrada por monges de Pedra Alta.')
  })

  it('o que era privado no Kanka vira segredo (e nunca sai em wiki ou leitor)', () => {
    expect(byName(w, 'Brant Valmar').secret).toBe(true)
    expect(byName(w, 'Aldric Valmar').secret).toBe(false)
    const out = applyForeign(createUniverse('K'), w)
    expect(out.universe.entities.find((e) => e.name === 'Brant Valmar')!.canon).toBe('secreto')
    expect(out.universe.entities.find((e) => e.name === 'Aldric Valmar')!.canon).not.toBe('secreto')
    expect(out.universe.entities.find((e) => e.name === 'Aldric Valmar')!.fields.map((f) => f.key)).toContain('Idade')
  })

  it('o mesmo em .zip, com cada tipo na sua pasta', () => {
    const files: Record<string, Uint8Array> = {}
    for (const p of walk(join(root, 'kanka'))) {
      const name = relative(join(root, 'kanka'), p)
      files[`${name.replace('.json', '')}/${name}`] = new Uint8Array(readFileSync(p))
    }
    const zip = readForeign(unzipText('campanha.zip', zipSync(files)))
    expect(zip.entities.map((e) => `${e.name}:${e.kind}`).sort()).toEqual(w.entities.map((e) => `${e.name}:${e.kind}`).sort())
  })
})

describe('World Anvil: os artigos', () => {
  const w = readForeign(load('worldanvil'))
  const lyra = byName(w, 'Lyra, a Cartógrafa')
  it('lê a lista de {"articles": […]} e usa a classe do artigo como tipo', () => {
    expect(w.sources).toEqual(['World Anvil'])
    expect(w.entities.map((e) => `${e.name}:${e.kind}`).sort()).toEqual([
      'Guilda dos Mapas:faccao',
      'Lyra, a Cartógrafa:personagem',
      'O Atlas do Sul:documento',
      'Porto Velho:lugar',
    ])
  })

  it('BBCode: títulos, listas e citações mantêm a forma; menções e links viram texto; a imagem do World Anvil sai', () => {
    expect(lyra.description).toContain('## Vida')
    expect(lyra.description).toContain('Nascida em Porto Velho, Lyra aprendeu a ler o mar com o pai.')
    expect(lyra.description).toContain('- Mapa da costa\n- Atlas do sul')
    expect(lyra.description).toContain('> O mar não tem dono, só mapas.')
    expect(lyra.description).toContain('Veja também o mapa antigo e a Guilda dos Mapas.')
    expect(lyra.description).not.toMatch(/\[|\]|@/)
    expect(lyra.summary).toBe('Mapeou a costa inteira, de Valmar às Brumas.')
    expect(byName(w, 'Porto Velho').description).toContain('Lá vive Lyra, a Cartógrafa.')
  })

  it('etiquetas "a, b" viram etiquetas; artigo privado vira segredo', () => {
    expect(lyra.tags).toEqual(['cartografia', 'guilda dos mapas'])
    expect(byName(w, 'Guilda dos Mapas').secret).toBe(true)
    expect(lyra.secret).toBe(false)
  })
})

describe('trazer para o universo', () => {
  it('os três cofres juntos: nada se perde nem se repete, e as fichas novas ganham campos e segredos', () => {
    const all = [...load('obsidian'), ...load('kanka'), ...load('worldanvil')]
    const w = readForeign(all)
    // "Porto Velho" e "Valmar" existem em mais de um app: o primeiro fica.
    expect(new Set(w.entities.map((e) => e.name)).size).toBe(w.entities.length)
    const out = applyForeign(createUniverse('Tudo junto'), w)
    expect(out.created).toBe(w.entities.length)
    const again = applyForeign(out.universe, w)
    expect(again.created).toBe(0)
    expect(again.existing).toBe(w.entities.length)
  })
})
