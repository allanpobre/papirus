import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/literata/opsz-italic.css'
import '@fontsource-variable/instrument-sans/index.css'
import '@fontsource/young-serif/400.css'
import '@fontsource/cinzel/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { followThemeColor } from '../ui/themeColor'
import '../styles/tokens.css'
import '../styles/base.css'
import './landing.css'
import { Landing } from './Landing'

// As barras do celular na cor da tela, e não no verde fixo.
followThemeColor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
