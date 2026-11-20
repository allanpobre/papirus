# Auditoria 12 — Contas, nuvem e compartilhar

**Limite desta auditoria:** o Supabase falso (`e2e/fakeSupabase.ts`) só é ligado dentro das specs do projeto. Em vez de refazer à mão, rodei as 5 specs que já cobrem esta área (**23 testes, todos passaram**, 3,6 min, 20/11/2026) e li o que cada uma afirma. Isto é uma **auditoria de cobertura**, não uma passada de uso: não vi as telas com os meus olhos nesta rodada.

## Funciona bem (coberto e passando)

- **Entrar** (e-mail e senha, "Esqueci a senha", "Entrar sem senha" por link): inclui link vencido, link já usado ("o programa de e-mail pode ter aberto antes"), e o caso do **app instalado** (Android entra e continua; iPhone tem armazenamento próprio, então segue sem conta e o recado diz o que fazer).
- **Levar os universos para a nuvem e sair sem perder nada.**
- **Duplas local × nuvem**: a cópia antiga vira versão guardada; "arrumar os repetidos" deixa um só; mudou nos dois lados → junta sozinho quando não se cruzam e **pergunta** quando é a mesma cena; "sem sinal avisa e nada se perde".
- **Compartilhar**: convidar para editar, as mudanças chegam, o link só lê, o acesso pode ser tirado; partes recolhíveis (Pessoas aberta).
- **Leitores beta**: quem lê pelo link comenta um trecho e a cena; a autora vê na margem e resolve.
- **Universo alternativo (AU)**: o autor autoriza, a outra pessoa cria o AU com a lore, o autor canoniza o que nasceu lá; pedido por perfil, aceito ou recusado (a pessoa vê "não foi aceito").
- **Comunidade**: seguir, Continuar lendo, capítulo novo, até onde leram, denunciar e bloquear; estados vazios dizem o que fazer; sem o script `comunidade.sql` no servidor, as partes novas só não aparecem.

## Defeitos

Nenhum novo. Nada falhou nas 23 specs.

## Confuso ou difícil (do que as specs deixam ver)

- **iPhone com o app da tela inicial não compartilha a conta com o Safari.** O app tem recado, mas é um limite do sistema: quem instalou antes de entrar fica sem os universos da nuvem até entrar de novo dentro do app. Vale testar com um iPhone de verdade.
- **Muitas regras de junção** (cópia antiga, repetidos, mesma cena) dependem de entender "dupla local/nuvem". As perguntas existem, mas o vocabulário (dupla, versão guardada) é técnico.
- **A Comunidade e o AU dependem de um script do servidor** (`comunidade.sql`); sem ele, partes somem em silêncio (de propósito). Quem hospeda o próprio servidor pode não saber o que falta.

## Pode mudar

- Um "Teste de conexão" em Ajustes › Servidor próprio que diga quais scripts estão instalados (contas, compartilhar, social, comunidade).
- Trocar "dupla" por "cópia na nuvem e cópia neste aparelho" nos textos.

## Consertado neste PR

Nada.

## Não testado (grande)

- Presença ao vivo e ficha aberta com duas pessoas de verdade, e o canal da Mesa ao vivo (spec `mesa-ao-vivo` e `codex-ao-vivo` **não** foram rodadas aqui).
- Conflito local × nuvem editando em dois contextos **à mão**.
- "O que acontece sem internet no meio de uma ação": só as specs de "sem sinal" e "sem internet" do jogador (ver 11).
- Contas e nuvem reais (Supabase de verdade), e-mail de verdade.
- Telas e textos: nada foi visto em foto nesta auditoria.
