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

/** Mapa desenhado de Ostria (o exemplo de fantasia): a cidade no penhasco, o porto, a Torre e o vale ao norte. */
export const OSTRIA_MAP_W = 1000
export const OSTRIA_MAP_H = 700

const ostria = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700">
<defs>
<pattern id="w" width="40" height="14" patternUnits="userSpaceOnUse"><path d="M0 7 q10 -6 20 0 t20 0" fill="none" stroke="#8fb3b5" stroke-width="1.4"/></pattern>
<radialGradient id="p" cx="55%" cy="40%" r="80%"><stop offset="0" stop-color="#f3e9d0"/><stop offset="1" stop-color="#d8c296"/></radialGradient>
<radialGradient id="m" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1000" height="700" fill="url(#p)"/>
<path d="M0 0 H320 C290 80 330 170 280 260 C240 340 300 420 360 470 C420 520 470 600 560 700 H0 Z" fill="#c9dcd8"/>
<path d="M0 0 H320 C290 80 330 170 280 260 C240 340 300 420 360 470 C420 520 470 600 560 700 H0 Z" fill="url(#w)" opacity=".7"/>
<path d="M320 0 C290 80 330 170 280 260 C240 340 300 420 360 470 C420 520 470 600 560 700" fill="none" stroke="#6e5a37" stroke-width="3"/>
<g stroke="#6e5a37" stroke-width="1.6">
<path d="M318 40 l14 4 M308 110 l14 2 M300 180 l15 0 M276 250 l15 -2 M262 320 l15 -4 M280 390 l14 -6 M318 440 l12 -8 M372 488 l10 -10 M430 540 l10 -10 M480 600 l10 -10 M520 650 l10 -9"/>
</g>
<g fill="#9b8156" stroke="#6e5a37" stroke-width="1.2">
<rect x="300" y="478" width="70" height="9" transform="rotate(-28 335 482)"/>
<rect x="335" y="520" width="80" height="9" transform="rotate(-32 375 524)"/>
</g>
<g fill="#5b4a33">
<path d="M262 520 q22 12 44 0 l-6 10 h-32 z"/><path d="M284 496 v24" stroke="#5b4a33" stroke-width="2"/>
<path d="M300 566 q20 10 40 0 l-5 9 h-30 z" fill="#2b2620"/><path d="M320 544 v22" stroke="#2b2620" stroke-width="2"/>
</g>
<g fill="none" stroke="#9b8156" stroke-width="6" stroke-linecap="round">
<path d="M395 470 L470 430 L560 400 L610 330 L700 250 L725 215"/>
<path d="M610 330 L720 300 L800 260 L850 160 L840 100" stroke-dasharray="14 10"/>
<path d="M560 400 L640 470 L760 520 L1000 560"/>
</g>
<path d="M470 470 C450 400 500 320 580 300 C660 280 700 360 690 430 C680 500 560 520 470 470 Z" fill="none" stroke="#7a6a4a" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>
<g fill="#b49a6a" stroke="#6e5a37" stroke-width="1.2">
<rect x="500" y="380" width="18" height="13"/><rect x="530" y="360" width="16" height="13"/><rect x="560" y="420" width="17" height="13"/>
<rect x="590" y="380" width="15" height="12"/><rect x="525" y="430" width="16" height="13"/><rect x="620" y="400" width="16" height="13"/>
<rect x="640" y="360" width="17" height="13"/><rect x="495" y="420" width="15" height="12"/><rect x="600" y="445" width="15" height="12"/>
<rect x="555" y="335" width="14" height="11"/><rect x="655" y="420" width="15" height="12"/>
<rect x="380" y="458" width="22" height="15" fill="#c2a878"/>
<rect x="588" y="306" width="44" height="22" fill="#c2a878"/><path d="M588 306 l22 -14 l22 14 z" fill="#c2a878"/>
</g>
<g stroke="#6e5a37" stroke-width="1.4">
<ellipse cx="722" cy="230" rx="70" ry="30" fill="none" stroke="#b49a6a"/><ellipse cx="722" cy="230" rx="44" ry="18" fill="none" stroke="#b49a6a"/>
<rect x="713" y="160" width="18" height="58" fill="#f7f1e2"/><path d="M709 160 l13 -22 l13 22 z" fill="#f7f1e2"/>
</g>
<g fill="#8a8f86" stroke="#5f6359" stroke-width="1.4">
<path d="M720 120 l40 -70 l40 70 z"/><path d="M780 125 l50 -90 l50 90 z"/><path d="M860 120 l40 -68 l40 68 z"/><path d="M900 135 l35 -55 l35 55 z"/>
</g>
<g>
<ellipse cx="840" cy="110" rx="140" ry="34" fill="url(#m)"/><ellipse cx="800" cy="135" rx="90" ry="22" fill="url(#m)"/><ellipse cx="900" cy="95" rx="80" ry="20" fill="url(#m)"/>
</g>
<g fill="#7f9c70" opacity=".85">
<circle cx="820" cy="380" r="13"/><circle cx="845" cy="400" r="11"/><circle cx="805" cy="410" r="10"/><circle cx="870" cy="420" r="14"/>
<circle cx="760" cy="600" r="13"/><circle cx="790" cy="625" r="11"/><circle cx="900" cy="300" r="12"/><circle cx="930" cy="320" r="10"/>
<circle cx="680" cy="620" r="12"/><circle cx="950" cy="470" r="12"/>
</g>
<g font-family="Georgia, serif" fill="#4a3c24">
<text x="975" y="660" text-anchor="end" font-size="30" font-style="italic">Reino de Ostria</text>
<text x="975" y="684" text-anchor="end" font-size="14">a capital e o norte, ano 359</text>
<text x="120" y="300" font-size="20" font-style="italic" fill="#3d6266">Mar de Sal</text>
<text x="990" y="545" text-anchor="end" font-size="13" font-style="italic">para o interior →</text>
</g>
<g transform="translate(90 610)" fill="#4a3c24" font-family="Georgia, serif" font-size="13">
<circle r="26" fill="none" stroke="#4a3c24"/><path d="M0 -24 L6 0 L0 24 L-6 0 Z" fill="#4a3c24"/><text y="-30" text-anchor="middle">N</text>
</g>
</svg>`

export const OSTRIA_MAP = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ostria).replace(/[()']/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`
