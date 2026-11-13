import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/literata/opsz-italic.css'
import '@fontsource-variable/instrument-sans/index.css'
import '@fontsource/young-serif/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { followThemeColor } from './ui/themeColor'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/write.css'
import './styles/views.css'
import './styles/reader.css'
import './styles/book.css'
import './styles/oficina.css'
import './styles/treino.css'
import App from './App.tsx'
import PlayerApp from './player/PlayerApp.tsx'
import { readPlayerLink } from './share/server'
import { startPwa, watchForUpdates } from './pwa'
import { UpdateNotice } from './ui/UpdateNotice'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { GlobalErrors } from './ui/GlobalErrors'
import { Confetti } from './ui/Confetti'
import { captureAuthLink } from './account/auth'
import { AuthLinkNotice } from './account/AuthLinkNotice'

// Link de jogador (?mesa=…): só o Codex, sem biblioteca nem dados deste navegador.
const player = readPlayerLink(location.search)
if (!player) {
  startPwa()
  // Versão nova publicada enquanto o app está aberto: avisa com "Atualizar".
  watchForUpdates()
}
// Volta de um link do e-mail (entrar, confirmar a conta, trocar a senha): guarda e limpa o endereço.
if (!player) captureAuthLink()

// As barras do celular na cor da tela, e não no verde fixo.
followThemeColor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="O Papirus encontrou um erro.">{player ? <PlayerApp id={player.id} server={player.server} /> : <App />}</ErrorBoundary>
    <GlobalErrors />
    {!player && <AuthLinkNotice />}
    {!player && <UpdateNotice />}
    <Confetti />
  </StrictMode>,
)
