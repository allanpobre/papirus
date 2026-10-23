import { sceneToMarkdown } from '../export/markdown'
import { fileNameFor } from '../export/download'
import { codexMarkdown } from '../logic/codex'
import { CANON_LABEL, EDITORIAL_LABEL, formatYear, kindLabel, kindPlural } from '../model/labels'
import type { SavedFile, Universe } from '../model/schema'
import { entityName, scenesOf } from '../model/universe'

export interface FolderFile {
  /** Caminho relativo dentro da pasta, com "/" como separador. */
  path: string
  content: string
}

/** Nome do arquivo que lista o que o Papirus escreveu, para limpar arquivos antigos. */
export const MANIFEST = '.papirus-arquivos.json'
export const BACKUP_FILE = 'papirus.json'

const slug = (text: string, fallback: string) => fileNameFor(text || fallback, 'x').replace(/\.x$/, '')
const num = (n: number) => String(n).padStart(2, '0')

/**
 * O universo como arquivos legíveis: o backup completo (para reabrir no Papirus),
 * cada cena em Markdown e cada ficha num arquivo próprio. Funciona com Dropbox,
 * Google Drive, Git ou qualquer pasta comum.
 */
export function universeToFiles(universe: Universe, file: SavedFile): FolderFile[] {
  const files: FolderFile[] = []
  const suffix = universe.settings.calendarSuffix

  files.push({ path: BACKUP_FILE, content: JSON.stringify(file, null, 2) })
  files.push({
    path: 'LEIA-ME.txt',
    content: [
      `${universe.name} — salvo pelo Papirus`,
      '',
      `${BACKUP_FILE}: backup completo. Para reabrir, use "Abrir de uma pasta" ou "Importar backup" no Papirus.`,
      'manuscrito/: cada cena em Markdown, na ordem do manuscrito.',
      'fichas/: cada ficha do mundo num arquivo.',
      'codex/: o que cada mesa de RPG já descobriu.',
      '',
      'Os arquivos .md são cópias para leitura: editar um deles não muda o universo no Papirus.',
      '',
    ].join('\n'),
  })

  const groups = [
    ...universe.stories.map((s, i) => ({ dir: `${num(i + 1)}-${slug(s.title, 'historia')}`, scenes: scenesOf(universe, s.id) })),
    { dir: 'cenas-soltas', scenes: scenesOf(universe, null) },
  ]
  for (const g of groups) {
    g.scenes.forEach((scene, i) => {
      files.push({ path: `manuscrito/${g.dir}/${num(i + 1)}-${slug(scene.title, 'cena')}.md`, content: sceneToMarkdown(scene) })
    })
  }

  const used = new Set<string>()
  for (const e of universe.entities) {
    let path = `fichas/${slug(kindPlural(e.kind), 'outros')}/${slug(e.name, 'sem-nome')}.md`
    // Nomes repetidos ganham um sufixo para não sobrescrever outra ficha.
    for (let n = 2; used.has(path); n++) path = path.replace(/(-\d+)?\.md$/, `-${n}.md`)
    used.add(path)
    const lines = [`# ${e.name || 'Sem nome'}`, '']
    lines.push(`- Tipo: ${kindLabel(e.kind)}`, `- Canon: ${CANON_LABEL[e.canon]}`, `- Estado: ${EDITORIAL_LABEL[e.editorial]}`)
    if (e.aliases.length) lines.push(`- Outros nomes: ${e.aliases.join(', ')}`)
    if (e.parentId) lines.push(`- Fica em: ${entityName(universe, e.parentId)}`)
    const span = [formatYear(e.startYear, suffix), formatYear(e.endYear, suffix)].filter(Boolean).join(' – ')
    if (span) lines.push(`- Período: ${span}`)
    if (e.tags.length) lines.push(`- Etiquetas: ${e.tags.join(', ')}`)
    for (const f of e.fields) if (f.key) lines.push(`- ${f.key}: ${f.value}`)
    if (e.summary) lines.push('', e.summary)
    if (e.description) lines.push('', e.description)
    const rels = universe.relations.filter((r) => r.fromId === e.id)
    if (rels.length) lines.push('', '## Relações', '', ...rels.map((r) => `- ${r.type} ${entityName(universe, r.toId)}`))
    files.push({ path, content: lines.join('\n') + '\n' })
  }

  for (const g of universe.groups) {
    files.push({ path: `codex/${slug(g.name, 'mesa')}.md`, content: codexMarkdown(universe, g.id) })
  }
  return files
}
