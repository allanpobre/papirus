/** Mapa desenhado da Terra de Oz para o exemplo (SVG leve, sem imagem externa). As cores são as do livro; os nomes dos países vêm do mapa político. */
export const OZ_MAP_W = 1000
export const OZ_MAP_H = 700

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700">
<defs>
<pattern id="d" width="26" height="18" patternUnits="userSpaceOnUse"><path d="M2 12 q5 -5 10 0 q5 5 10 0" fill="none" stroke="#c9ad74" stroke-width="1.2"/></pattern>
</defs>
<rect width="1000" height="700" fill="#ecdcb2"/>
<rect width="1000" height="700" fill="url(#d)" opacity=".8"/>
<g stroke="#7a6440" stroke-width="2.5" stroke-linejoin="round">
<path d="M150 90 L850 90 L500 350 Z" fill="#cdb8e0"/>
<path d="M850 90 L850 610 L500 350 Z" fill="#aac6e8"/>
<path d="M850 610 L150 610 L500 350 Z" fill="#eaa99f"/>
<path d="M150 610 L150 90 L500 350 Z" fill="#f1df8e"/>
</g>
<path d="M150 90 L850 90 L850 610 L150 610 Z" fill="none" stroke="#5b4a2c" stroke-width="4"/>
<path d="M800 330 C740 300 700 360 650 340 C610 325 590 360 556 352" fill="none" stroke="#d9a520" stroke-width="9" stroke-linecap="round"/>
<path d="M800 330 C740 300 700 360 650 340 C610 325 590 360 556 352" fill="none" stroke="#f6d35a" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 5"/>
<g fill="#4f8a3c" stroke="#2f5a24" stroke-width="1">
<circle cx="660" cy="300" r="9"/><circle cx="676" cy="312" r="8"/><circle cx="645" cy="318" r="8"/><circle cx="690" cy="296" r="7"/>
<circle cx="300" cy="230" r="8"/><circle cx="318" cy="240" r="7"/><circle cx="560" cy="520" r="8"/><circle cx="578" cy="530" r="7"/><circle cx="545" cy="535" r="7"/>
</g>
<g fill="#d8402f"><circle cx="605" cy="390" r="4"/><circle cx="617" cy="398" r="4"/><circle cx="596" cy="402" r="4"/><circle cx="625" cy="386" r="4"/><circle cx="610" cy="410" r="4"/></g>
<circle cx="500" cy="350" r="52" fill="#6fbe8e" stroke="#2f6d48" stroke-width="3"/>
<g fill="#3f8f5f" stroke="#245a39" stroke-width="1.2"><rect x="488" y="318" width="10" height="34"/><rect x="503" y="308" width="12" height="44"/><rect x="519" y="324" width="9" height="28"/><rect x="472" y="330" width="9" height="22"/></g>
<g fill="#7a6440"><path d="M235 300 l14 -26 l14 26 Z"/><path d="M500 560 l12 -22 l12 22 Z"/><path d="M520 470 l9 -16 l9 16 Z"/><path d="M536 474 l9 -16 l9 16 Z"/></g>
<g fill="#f7f2e6" stroke="#8a8a8a" stroke-width="1"><rect x="440" y="455" width="40" height="22" rx="3"/></g>
<g font-family="Georgia, serif" fill="#3a2e1a" text-anchor="middle">
<text x="500" y="52" font-size="17" font-style="italic" fill="#6e5733">Grande Deserto</text>
<text x="500" y="670" font-size="17" font-style="italic" fill="#6e5733">Grande Deserto</text>
<text x="930" y="60" font-size="14" font-style="italic" fill="#6e5733">Kansas →</text>
</g>
<g transform="translate(70 600)" fill="#4a3c24" font-family="Georgia, serif" font-size="13">
<circle r="24" fill="none" stroke="#4a3c24"/><path d="M0 -22 L6 0 L0 22 L-6 0 Z" fill="#4a3c24"/><text y="-28" text-anchor="middle">N</text>
</g>
</svg>`

export const OZ_MAP = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/[()']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`

/** As regiões do mapa político (pontos de 0 a 1), na mesma ordem do desenho. */
const pt = (x: number, y: number): [number, number] => [x / OZ_MAP_W, y / OZ_MAP_H]
export const OZ_REGIONS = {
  norte: [pt(150, 90), pt(850, 90), pt(500, 350)],
  leste: [pt(850, 90), pt(850, 610), pt(500, 350)],
  sul: [pt(850, 610), pt(150, 610), pt(500, 350)],
  oeste: [pt(150, 610), pt(150, 90), pt(500, 350)],
}
