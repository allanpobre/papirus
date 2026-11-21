# Auditoria 14 — Ajustes, dados e segurança dos dados

Playwright a 390×844 em universo novo. Foi uma passada **curta**: o foco foi o que podia derrubar o app (preferências velhas) e abrir cada categoria. O ciclo backup → apagar → trazer de volta não foi feito à mão (ver "Não testado"). 20/11/2026.

## Funciona bem

- **Preferências velhas e estranhas não derrubam o app.** Pus em `localStorage` (`papirus:prefs`) sete casos antes de abrir: setor que não existe (`"mundos"`), `hiddenViews` com lixo (`"inexistente"`, número, nulo), tema e cor que não existem (`"neon"`, `"roxo-do-futuro"`, tamanho `"enorme"`), atalhos inválidos, `menus`/`continuity`/`firstSteps` com tipos errados, o valor inteiro como texto solto e como `null`. **Os sete abrem normalmente**, sem erro de página.
- **Ajustes em três grupos** ("Este universo", "Este aparelho", "Sua conta"), com 10 painéis: Universo, Dados e backup, Lixeira e histórico, Importar e wiki, Aparência, Escrita, Menu e ajuda, Todas as ferramentas, Conta (e o "Servidor próprio" dentro da Conta). **Cada um abre o que o nome diz**, sem rolagem lateral. No celular é uma lista; um toque abre o painel e "Ajustes" volta.
- **Dados e backup**: Seus dados (baixar o livro em Word/EPUB, importar backup, "Pedir para manter"), Pasta no computador ("Escolher pasta"), Imagens ("Limpar imagens sem uso") e Snapshots (Criar, Restaurar, "Abrir como cópia").
- **Lixeira e histórico**, **Importar e wiki** (Importar um livro, Wiki do mundo com "Personalizar e ver como fica", "Trazer de outro app") e **Menu e ajuda** ("Mostrar tudo", "Refazer o tour") estão onde o nome promete; "Todas as ferramentas" lista cada área com uma frase.
- **Universo**: setor (Escrita ou Campanha), clima (Caderno, Fantasia, Ficção científica, Terror), Simples/Completo, capa, meses do calendário, campos e listas sugeridos, modelos de ficha, "E se…?" (Criar ramo) e, no fim, "Apagar este universo…".
- Specs existentes dos Ajustes (`universos-ajustes.spec.ts`, 3 testes) passam. Há specs para snapshot, lixeira, versões da cena, lembrete e backup automático (não rodei de novo).

## Defeitos

Nenhum encontrado.

## Confuso ou difícil

- **"Ajustes" aparece duas vezes**: o botão que volta à lista e o título "Ajustes", e depois o título do painel ("Universo", "Universo"): o `h2` do painel se repete (uma vez no grupo, outra no painel).
- **"Servidor próprio" não está no mesmo nível dos outros** (é aberto por dentro da Conta). Quem procura o servidor na lista não acha na mesma linha.
- **"Apagar este universo…"** fica no fim do painel Universo, depois de seis outros blocos; é bom que seja escondido, mas quem só quer renomear precisa descer tudo.
- **Quatro lugares para "backup"**: Ajustes › Dados e backup, o menu `···` do cartão do universo ("Baixar backup (.json)"), Snapshots (dentro do universo) e "Backup sozinho toda semana". Sem uma frase que diga qual escolher.
- **"Pedir para manter"** (armazenamento persistente do navegador) é um nome sem contexto; precisa de uma linha: "Evita que o navegador apague seus dados".

## Pode mudar

- Um painel "Seus dados" com os quatro tipos de backup lado a lado e uma frase de quando usar cada um.
- Renomear "Pedir para manter" para "Proteger contra limpeza do navegador".
- Mostrar "Servidor próprio" na lista, em "Sua conta".

## Consertado neste PR

Nada.

## Não testado

- **Ciclo completo de backup**: baixar o backup, apagar o universo e trazer de volta (o universo volta igual?). Tentei à mão e o roteiro falhou por seletor; não tenho resultado.
- Lixeira (apagar e recuperar), histórico de versões (voltar uma versão), "Limpar imagens sem uso" e "Pasta no computador" (depende do navegador): só os botões foram vistos.
- Se a lixeira guarda um **universo inteiro** apagado (o `Apagar` da lista diz "apagar de vez").
- O backup de um universo com imagens grandes.
