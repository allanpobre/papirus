# Entrar por e-mail com o app instalado

Três e-mails levam um link de volta ao Papirus: **entrar sem senha**, **confirmar a conta** (criar conta) e **esqueci a senha**. Num celular com o Papirus instalado (ícone na tela inicial), o link pode abrir **no navegador** em vez de no app. Este documento diz o que o app faz em cada caso, o que foi testado e o que só dá para ver num aparelho de verdade.

Código: `src/account/auth.ts` (`readAuthLink`, `captureAuthLink`, `applyLink`), `src/account/AuthLinkNotice.tsx` (os avisos), `src/account/linkAdvice.ts` (os recados) e `src/account/AccountDialog.tsx` (onde se pede o link). Testes: `e2e/entrar-por-email.spec.ts`.

## Como o link volta

O servidor (Supabase) manda o link para `…/app/` com as chaves no `#` do endereço (`#access_token=…&refresh_token=…&type=magiclink|signup|recovery`) ou, quando dá erro, com `#error=…&error_code=…`. O app:

1. lê o `#` ao abrir (`captureAuthLink`) e **tira as chaves do endereço** na hora (não ficam no histórico);
2. se há chaves, entra com elas (`applyLink`); se for `recovery`, pede a **senha nova**; senão, mostra "Você entrou como …";
3. se há erro, mostra "O link não funcionou" com o motivo.

Com o app **já aberto**, um link que só muda o `#` (acontece no Android quando o app instalado captura o link) é tratado do mesmo jeito, sem recarregar (`hashchange`).

## Os casos

| Onde o link abre | O que acontece | O que o app diz |
| --- | --- | --- |
| No **app instalado** (Android captura o link, ou a pessoa colou o endereço nele) | Entra na hora, com o app aberto ou abrindo do zero. | "Você entrou como …" (ou pede a senha nova). |
| No **navegador** do celular, com o app instalado (o mais comum, quando o e-mail abre o link num navegador) | Entra no navegador. **Android:** o app instalado usa o mesmo armazenamento do navegador, então a conta já está lá quando se abre o app. **iPhone:** o app da tela inicial tem armazenamento próprio, então a conta **não** passa para ele. | No navegador: "Usa o Papirus pelo ícone na tela inicial? Abra por lá: se a conta não aparecer, entre de novo." (na troca de senha: "…entre com a senha nova."). No app, ao pedir o link: "Se o link abrir no navegador em vez deste app, tudo bem: volte pelo ícone do Papirus e, se a conta não aparecer aqui, entre de novo." |
| Num **navegador no computador**, sem app | Entra ali, normalmente. | "Você entrou como …". |
| Link **vencido ou já usado** | Não entra. Cada link vale uma vez só e por pouco tempo. | "Este link venceu ou já foi usado… peça outro", mais: alguns programas de e-mail abrem o link antes (para checar se é seguro) e gastam o link; peça outro e abra logo. |
| Link de erro para o **endereço principal** (`/`, a apresentação) | O app lê o `#` na apresentação também e mostra o erro. | "O link não funcionou", com o motivo. |

"Entre de novo" quer dizer: **Entrar** com a senha, ou "Entrar sem senha" para receber outro link, desta vez abrindo-o por onde se quer entrar.

## O que foi testado (e2e, no servidor de mentira)

- Entrar sem senha, esqueci a senha (a senha antiga deixa de valer, a nova entra em outro aparelho) e link vencido (já existiam).
- Com o app aberto, o link só troca o `#`: entra sem recarregar e o endereço volta limpo.
- No app instalado (simulado com `display-mode: standalone`), ao pedir o link aparece o recado "pode abrir no navegador" nos três e-mails (entrar sem senha, esqueci a senha e confirmar a conta); fora do app instalado, não.
- No navegador do celular (Android simulado pelo `userAgent`), depois de entrar pelo link aparece o recado "Usa o Papirus pelo ícone…" (e a versão da senha nova); no computador, não.
- Dois contextos com o mesmo armazenamento (o caso do Android): o link entra na aba do navegador e o app que já estava aberto passa a mostrar a conta, sem recarregar.
- Dois contextos com armazenamento separado (o caso do iPhone): o app continua sem conta, e o recado diz o que fazer.
- Link já usado: a explicação a mais sobre programas de e-mail que abrem o link antes.

## O que só dá para ver num aparelho de verdade

- Se o **Android** realmente entrega o link do Gmail (ou de outro programa de e-mail) ao app instalado, ou abre no navegador: depende do aparelho, do programa de e-mail e da opção "abrir links compatíveis" do Chrome.
- Se o app instalado do Android realmente compartilha o armazenamento com o navegador (é o comportamento do Chrome, mas aqui só foi simulado com dois contextos no mesmo perfil).
- O armazenamento separado do **iPhone** (app da tela inicial × Safari).
- O e-mail de verdade (o servidor de mentira escreve o link num registro; o texto do e-mail e o remetente são do Supabase do projeto).

## Ideia que ficou na fila

Deixar **colar o link do e-mail** na janela de entrar, para quem usa o app instalado no iPhone: hoje o link só funciona abrindo o endereço. Foi deixada de lado porque o link do e-mail passa antes pelo servidor (`…/auth/v1/verify`) antes de voltar com as chaves, e colá-lo no app exigiria validar o código direto, o que não deu para conferir sem um servidor de verdade.
