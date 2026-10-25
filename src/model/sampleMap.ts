/** Mapa desenhado da vila de Itaguaí para o exemplo (SVG leve, sem imagem externa). */
export const ITAGUAI_MAP_W = 1000
export const ITAGUAI_MAP_H = 700

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700">
<defs>
<pattern id="w" width="40" height="14" patternUnits="userSpaceOnUse"><path d="M0 7 q10 -6 20 0 t20 0" fill="none" stroke="#8fb3b5" stroke-width="1.4"/></pattern>
<radialGradient id="p" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#f4ead2"/><stop offset="1" stop-color="#dcc79c"/></radialGradient>
</defs>
<rect width="1000" height="700" fill="url(#p)"/>
<path d="M0 0 H230 C200 90 260 160 210 250 C170 330 250 420 190 520 C150 590 210 650 180 700 H0 Z" fill="#c9dcd8"/>
<path d="M0 0 H230 C200 90 260 160 210 250 C170 330 250 420 190 520 C150 590 210 650 180 700 H0 Z" fill="url(#w)" opacity=".7"/>
<path d="M230 0 C200 90 260 160 210 250 C170 330 250 420 190 520 C150 590 210 650 180 700" fill="none" stroke="#7a6a4a" stroke-width="2.5"/>
<path d="M1000 470 C880 500 820 600 700 610 C600 620 520 580 430 610 C350 640 300 600 215 590" fill="none" stroke="#86aab0" stroke-width="10" stroke-linecap="round"/>
<path d="M1000 470 C880 500 820 600 700 610 C600 620 520 580 430 610 C350 640 300 600 215 590" fill="none" stroke="#c9dcd8" stroke-width="5" stroke-linecap="round"/>
<g fill="none" stroke="#9b8156" stroke-width="6" stroke-linecap="round">
<path d="M260 380 L380 360 L470 330 L560 300 L660 262 L760 210"/>
<path d="M380 245 L470 330 L560 420 L600 600"/>
<path d="M470 330 L360 430 L330 560"/>
<path d="M660 262 L700 120"/>
<path d="M760 210 L1000 290" stroke-dasharray="14 10"/>
</g>
<g fill="#b49a6a" stroke="#6e5a37" stroke-width="1.2">
<rect x="430" y="300" width="18" height="13"/><rect x="495" y="300" width="16" height="13"/><rect x="455" y="350" width="17" height="13"/>
<rect x="510" y="335" width="15" height="12"/><rect x="405" y="335" width="16" height="13"/><rect x="590" y="255" width="16" height="13"/>
<rect x="620" y="285" width="17" height="13"/><rect x="690" y="235" width="16" height="12"/><rect x="700" y="275" width="15" height="12"/>
<rect x="335" y="410" width="18" height="14"/><rect x="380" y="445" width="15" height="12"/><rect x="530" y="430" width="16" height="13"/>
<rect x="585" y="430" width="15" height="12"/><rect x="545" y="470" width="14" height="11"/><rect x="300" y="455" width="14" height="11"/>
</g>
<g stroke="#6e5a37" stroke-width="1.5">
<rect x="745" y="140" width="96" height="40" fill="#9fbf93"/>
<path d="M757 140 v40 M769 140 v40 M781 140 v40 M793 140 v40 M805 140 v40 M817 140 v40 M829 140 v40" stroke="#5f8a57"/>
<path d="M366 230 l14 -22 l14 22 z" fill="#b49a6a"/><rect x="369" y="230" width="22" height="20" fill="#b49a6a"/>
<rect x="540" y="398" width="34" height="20" fill="#c2a878"/>
</g>
<g fill="#7f9c70" opacity=".85">
<circle cx="860" cy="360" r="14"/><circle cx="885" cy="380" r="12"/><circle cx="845" cy="390" r="11"/><circle cx="910" cy="410" r="15"/>
<circle cx="760" cy="560" r="13"/><circle cx="790" cy="585" r="11"/><circle cx="330" cy="180" r="12"/><circle cx="355" cy="160" r="10"/>
<circle cx="900" cy="560" r="12"/><circle cx="380" cy="600" r="12"/><circle cx="410" cy="620" r="10"/>
</g>
<g font-family="Georgia, serif" fill="#4a3c24">
<text x="975" y="660" text-anchor="end" font-size="30" font-style="italic">Vila de Itaguaí</text>
<text x="975" y="684" text-anchor="end" font-size="14">capitania do Rio de Janeiro, c. 1783</text>
<text x="990" y="270" text-anchor="end" font-size="13" font-style="italic">para a corte →</text>
<text x="70" y="360" font-size="18" font-style="italic" fill="#3d6266">baía</text>
</g>
<g transform="translate(110 610)" fill="#4a3c24" font-family="Georgia, serif" font-size="13">
<circle r="26" fill="none" stroke="#4a3c24"/><path d="M0 -24 L6 0 L0 24 L-6 0 Z" fill="#4a3c24"/><text y="-30" text-anchor="middle">N</text>
</g>
</svg>`

export const ITAGUAI_MAP = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/[()']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`
