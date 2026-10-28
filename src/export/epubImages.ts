/** Uma imagem em data URL, em bytes (para ir como arquivo dentro do e-book). */
export function dataUrlBytes(dataUrl: string | null): { data: Uint8Array; type: string; ext: string } | null {
  const m = dataUrl?.match(/^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/)
  if (!m) return null
  const bin = atob(m[3])
  const data = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i)
  return { data, type: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2] }
}

/**
 * Tira as imagens embutidas (data URL) do HTML dos capítulos e as põe como arquivos
 * do e-book (imagens/cena-N), que é como os leitores de e-book esperam.
 */
export function epubImageFiles() {
  const files: Record<string, Uint8Array> = {}
  const items: string[] = []
  const seen = new Map<string, string>()
  const take = (html: string) =>
    html.replace(/src="(data:image\/[^"]+)"/g, (_all, url: string) => {
      let href = seen.get(url)
      if (!href) {
        const img = dataUrlBytes(url)
        if (!img) return 'src=""'
        const n = seen.size + 1
        href = `imagens/cena-${n}.${img.ext}`
        files[`OEBPS/${href}`] = img.data
        items.push(`<item id="img${n}" href="${href}" media-type="${img.type}"/>`)
        seen.set(url, href)
      }
      return `src="${href}"`
    })
  return { take, files, items }
}
