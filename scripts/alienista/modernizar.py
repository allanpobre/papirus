import re, json, sys, unicodedata, itertools
D = sys.argv[1]
freq = {}
for line in open(f'{D}/freq.txt', encoding='utf-8'):
    w, n = line.split()
    freq[w] = int(n)
words = set(l.strip().lower() for l in open(f'{D}/palavras.txt', encoding='utf-8'))
def f(w):
    n = freq.get(w, 0)
    if n == 0 and w in words: n = 1
    return n

MANUAL = json.load(open(f'{D}/correcoes-palavras.json', encoding='utf-8')) if __import__('os').path.exists(f'{D}/correcoes-palavras.json') else {}

VOW = 'aeiou'
ACC = {'a': 'áâãà', 'e': 'éê', 'i': 'í', 'o': 'óôõ', 'u': 'úü'}
def strip(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn' or c == '̧').replace('ç', 'ç')
def nfc(s): return unicodedata.normalize('NFC', s)

def rules(w):
    out = {w}
    def add(fn):
        for x in list(out):
            y = fn(x)
            if y != x: out.add(y)
    add(lambda x: x.replace('ph', 'f'))
    add(lambda x: re.sub(r'th', 't', x))
    add(lambda x: re.sub(r'ch(?=[rl])', 'c', x))
    add(lambda x: re.sub(r'^ch(?=[aeiouy])', 'c', x) if x.startswith('chim') or x.startswith('chor') or x.startswith('chao') else x)
    add(lambda x: x.replace('y', 'i'))
    add(lambda x: re.sub(r'([bcdfglmnpt])\1', r'\1', x))
    add(lambda x: re.sub(r'^sc(?=[eiéí])', 'c', x))
    add(lambda x: re.sub(r'(?<=[aeiouáéíóú])h(?=[aeiouáéíóú])', '', x))
    add(lambda x: re.sub(r'^h(?=[aeiou])', '', x) if False else x)
    add(lambda x: re.sub(r'c(?=[çt])', '', x))
    add(lambda x: re.sub(r'p(?=[t])', '', x))
    add(lambda x: re.sub(r'mpt', 'nt', x))
    add(lambda x: re.sub(r'm(?=[^pbaeiouáéíóúâêôãõ])', 'n', x))
    add(lambda x: re.sub(r'z$', 's', x))
    add(lambda x: re.sub(r'(?<=[aeiou])z(?=[aeiou])', 's', x))
    add(lambda x: re.sub(r'(?<=[aeiou])s(?=[aeiou])', 'z', x))
    add(lambda x: re.sub(r'x(?=[ct])', 's', x))
    add(lambda x: re.sub(r'ae', 'ai', x))
    add(lambda x: re.sub(r'ão$', 'am', x) if False else x)
    return out

def accents(w):
    base = strip(w)
    cands = {w, base}
    # base with any accents kept from original for ã/õ
    for i, c in enumerate(base):
        if c in ACC:
            for a in ACC[c]:
                cands.add(base[:i] + a + base[i+1:])
                # also with ã/õ from original kept
    # keep tilde of original and add one acute
    keep = ''.join(c if c in 'ãõç' else strip(c) for c in w)
    for i, c in enumerate(keep):
        if c in ACC:
            for a in ACC[c]:
                cands.add(keep[:i] + a + keep[i+1:])
    cands.add(keep)
    return cands

def best(lw):
    if lw in MANUAL: return MANUAL[lw]
    # Mais-que-perfeito (achára, acontecera): nunca vira futuro (achará).
    if re.search(r'(ára|éra|íra|ra)$', lw) and not lw.endswith('rá'):
        b = _best(lw)
        if b.endswith('rá'):
            b = b[:-2] + 'ra'
            # caíra, diminuíra: acento no i (hiato) fica
        return b
    return _best(lw)

def _best(lw):
    orig = f(lw)
    cands = set()
    for r in rules(lw):
        cands |= accents(r)
    scored = sorted(((f(c), c) for c in cands if c != lw), reverse=True)
    if scored and scored[0][0] > 0:
        n, c = scored[0]
        if orig == 0 or n > 8 * orig:
            return c
    return lw

def case_like(src, w):
    if src.isupper() and len(src) > 1: return w.upper()
    if src[0].isupper(): return w[0].upper() + w[1:]
    return w

CL = {'o': 'lo', 'a': 'la', 'os': 'los', 'as': 'las'}
ACV = {'a': 'á', 'e': 'ê', 'i': 'i', 'o': 'ô', 'u': 'u'}
changes = {}
unknown = {}
def modern_word(tok):
    lw = tok.lower()
    # clíticos antigos: lastimal-o → lastimá-lo
    m = re.fullmatch(r"(.+?)([aeiou])l-(o|a|os|as)", lw)
    if m:
        verb = best(m.group(1) + m.group(2) + 'r')
        stem = strip(verb)[:-2] if verb.endswith('r') else m.group(1)
        res = stem + ACV[m.group(2)] + '-' + CL[m.group(3)]
        if lw in MANUAL: res = MANUAL[lw]
        changes[lw] = res
        return case_like(tok, res)
    parts = lw.split('-')
    out = []
    for p in parts:
        if not p or not re.match(r"^[\wçãõáéíóúâêôàü']+$", p):
            out.append(p); continue
        p2 = p.replace("lh'o", 'lho').replace("lh'a", 'lha')
        b = best(p2)
        if b != p: changes[p] = b
        if f(b) == 0 and not b.isdigit(): unknown[b] = unknown.get(b, 0) + 1
        out.append(b)
    return case_like(tok, '-'.join(out))

def modern_text(t):
    parts = re.split(r'(_[^_]+_|La bocca solevò dal fero pasto)', t)
    keep = lambda p: p.startswith('La bocca') or (p.startswith('_') and p.endswith('_') and FOREIGN.search(p))
    return ''.join(p if keep(p) else _modern(p) for p in parts)

FOREIGN = re.compile(r'vis|medicatrix|[Pp]lus|ultra|victa|Catoni|Te|Deum|amen|seccator|[Ss]ed\b', re.I)

def _modern(t):
    return re.sub(r"[\wçÇãõáéíóúâêôàüÁÉÍÓÚÂÊÔÃÕ'-]+", lambda m: modern_word(m.group(0)) if re.search(r'[^\W\d_]', m.group(0)) else m.group(0), t)

raw = open(f'{D}/raw.txt', encoding='utf-8').read()
FIX = {'ou era Lisboa': 'ou em Lisboa', 'em temos energicos': 'em termos energicos', 'um pouco a effeito': 'um pouco o effeito', 'com sigo': 'comsigo', 'vestido do seda': 'vestido de seda', 'Assim, Está': 'Assim, está', 'Rio de Janeito': 'Rio de Janeiro', 'mais trinte e sete': 'mais trinta e sete', 'acabar do crer': 'acabar de crer', 'pediu era casamento': 'pediu em casamento', 'out pelo menos': 'ou pelo menos', 'sub-classes': 'subclasses', 'de certo no meu': 'decerto no meu'}
for a, b in FIX.items(): raw = raw.replace(a, b)
raw = raw.replace('ou era Lisboa', 'ou em Lisboa').replace('ltaguahy', 'Itaguahy').replace('**', '').replace('preoecupação', 'preoccupação')
blocks = [b.strip() for b in re.split(r'\n\s*\n', raw) if b.strip()]
chapters = []
i = 0
while i < len(blocks):
    b = blocks[i]
    if re.fullmatch(r'[IVX]+', b):
        chapters.append({'n': b, 'title': blocks[i+1], 'paras': []}); i += 2; continue
    if chapters: chapters[-1]['paras'].append(' '.join(b.split()))
    i += 1
for c in chapters:
    c['title'] = modern_text(c['title'].title() if c['title'].isupper() else c['title'])
    ps = []
    for p in c['paras']:
        p = re.sub(r'^--\s*', '— ', p)
        p = re.sub(r'\s*--\s*', ' — ', p)
        ps.append(modern_text(p))
    c['paras'] = ps
import os
POST = json.load(open(f'{D}/correcoes-trechos.json', encoding='utf-8')) if os.path.exists(f'{D}/correcoes-trechos.json') else {}
for c in chapters:
    for i, p in enumerate(c['paras']):
        for a, b in POST.items(): p = p.replace(a, b)
        c['paras'][i] = p
TITLES = ['De como Itaguaí ganhou uma casa de orates', 'Torrente de loucos', 'Deus sabe o que faz!', 'Uma teoria nova', 'O terror', 'A rebelião', 'O inesperado', 'As angústias do boticário', 'Dois lindos casos', 'A restauração', 'O assombro de Itaguaí', 'O final do § 4º', 'Plus ultra!']
for c, t in zip(chapters, TITLES): c['title'] = t
json.dump(chapters, open(f'{D}/chapters.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(dict(sorted(changes.items())), open(f'{D}/changes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(dict(sorted(unknown.items(), key=lambda x: -x[1])), open(f'{D}/unknown.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(chapters), [len(c['paras']) for c in chapters], len(changes), len(unknown))
