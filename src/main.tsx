import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/literata/opsz-italic.css'
import '@fontsource-variable/instrument-sans/index.css'
import '@fontsource/young-serif/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/write.css'
import './styles/views.css'
import './styles/reader.css'
import './styles/book.css'
import App from './App.tsx'
import PlayerApp from './player/PlayerApp.tsx'
import { readPlayerLink } from './share/server'

// Link de jogador (?mesa=…): só o Codex, sem biblioteca nem dados deste navegador.
const player = readPlayerLink(location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{player ? <PlayerApp id={player.id} server={player.server} /> : <App />}</StrictMode>,
)
