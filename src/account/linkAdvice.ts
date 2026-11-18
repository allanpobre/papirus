import { isInstalled } from '../pwa'

/*
 * O link do e-mail (entrar sem senha, confirmar a conta, trocar a senha) abre onde o celular quiser:
 * no navegador ou, às vezes, no app instalado. Estes recados dizem o que fazer em cada caso.
 * O que o app faz de verdade está em docs/06-entrar-por-email-no-app-instalado.md.
 */

const onPhone = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

/** Dentro do app instalado, depois de pedir o link: ele pode abrir no navegador, e está tudo bem. */
export function installedAdvice(): string {
  return isInstalled() ? ' Se o link abrir no navegador em vez deste app, tudo bem: volte pelo ícone do Papirus e, se a conta não aparecer aqui, entre de novo.' : ''
}

/** No navegador do celular, depois de entrar pelo link: quem usa o app instalado precisa saber onde continuar. */
export function browserAdvice(passwordChanged: boolean): string | null {
  if (isInstalled() || !onPhone()) return null
  return passwordChanged
    ? 'Usa o Papirus pelo ícone na tela inicial? Abra por lá e entre com a senha nova.'
    : 'Usa o Papirus pelo ícone na tela inicial? Abra por lá: se a conta não aparecer, entre de novo.'
}

/** Quando o link “já foi usado” e a pessoa não abriu: alguns programas de e-mail abrem o link antes. */
export const SPENT_LINK_HELP = 'Se você ainda não tinha aberto, pode ser que o seu programa de e-mail abriu o link antes (para checar se é seguro). Peça outro e abra logo, no aparelho em que quer entrar.'
