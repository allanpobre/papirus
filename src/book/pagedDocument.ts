import polyfill from '../../node_modules/pagedjs/dist/paged.polyfill.min.js?raw'

/**
 * O documento que o Paged.js pagina: na prévia da diagramação, no arquivo para imprimir e no
 * Folhear. É sempre o mesmo livro: muda só o estilo de tela (`screenCss`) e o que roda depois
 * de paginar (`afterJs`, com as páginas prontas).
 */
/**
 * CSS dentro de <style>: um "</style" (num título ou autor que entra no CSS) fecharia a tag e o
 * resto viraria HTML. "<\/" é o mesmo texto para o CSS e não fecha nada para o HTML.
 */
export const safeStyle = (css: string) => css.replace(/<\//g, '<\\/')

export function pagedDocument(
  title: string,
  html: string,
  css: string,
  fonts: string,
  screenCss: string,
  spreads: boolean,
  { afterJs = '', headJs = '' }: { afterJs?: string; headJs?: string } = {},
): string {
  const script = polyfill.replace(/<\/script/gi, '<\\/script')
  const extra = headJs ? `<script>${headJs.replace(/<\/script/gi, '<\\/script')}</script>` : ''
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>
<style data-pagedjs-ignore>${safeStyle(fonts)}</style>
<style>${safeStyle(css)}</style>
<style data-pagedjs-ignore>${safeStyle(screenCss)}</style>
${extra}
<script>window.PagedConfig={auto:true,after:function(flow){try{${afterJs}}catch(e){}try{parent.postMessage({papirusPaged:flow.total},'*')}catch(e){}}}</script>
<script>${script}</script>
</head><body class="${spreads ? 'spreads' : ''}">${html}</body></html>`
}
