# Auditoria 20 — Sem internet, instalado e atualização

`vite build` + `vite preview` (o service worker só existe no build), Playwright com `setOffline(true)`, 390×844. Não foi testado em celular de verdade nem com o app "instalado" (ver o fim). 20/11/2026.

## Funciona bem

- **O service worker liga na primeira visita**: ativo, cache `papirus-v4` com **247 arquivos** guardados de antemão (o app inteiro, não só a primeira tela).
- **Escrever sem internet**: com a rede cortada, digitei mais uma frase na cena; o texto ficou salvo (aparece inteiro depois).
- **Recarregar sem internet**: a página abriu normalmente, na mesma cena, **com o texto escrito antes e o escrito offline** ("Texto escrito com internet. E mais texto SEM internet.").
- **Abrir o exemplo do Ostria sem internet** (nunca aberto antes): abre, porque o exemplo vem dentro do app.
- **Voltar a ter internet** não mostrou erro nem aviso estranho (sem conta, não há o que sincronizar).
- **Aviso de versão nova** ("Versão nova do Papirus" + botão "Atualizar" + X para dispensar) aparece numa faixa embaixo da tela, sem cobrir a barra do teclado; ao tocar em **Atualizar** o app recarrega e **a frase escrita continua lá**.
- O cache usa "rede primeiro" para páginas (pega versão nova) e "cache primeiro" para arquivos com nome com código (`sw.js`).
- Nenhum erro de página nas três situações.

## Defeitos

Nenhum encontrado.

## Confuso ou difícil

- **Sem conta, nada diz que está offline**: a barra de status ficou vazia durante o corte de rede. Está certo (o app é local), mas quem acha que "salva na nuvem" não vê nenhuma pista. Com conta, o spec `jogador-celular` e os de "sem sinal" mostram que existe o aviso.
- **O aviso de versão nova só aparece na tela onde se está**; quem fica em Ajustes ou na Mesa no celular também o vê? (o evento é global, não testei em cada tela).
- **"Atualizar" recarrega a página**: com muito texto digitado há menos de meio segundo, pode perder? Não consegui reproduzir (texto digitado 0,5 s antes foi mantido).

## Pode mudar

- Um pequeno "Offline" ao lado do "Salvo" quando a rede cai e o aparelho está com conta.
- Dizer, nos Ajustes, "Funciona sem internet: [OK]" com o tamanho guardado (247 arquivos) e um botão "Baixar tudo de novo".

## Consertado neste PR

Nada.

## Não testado

- **Instalar o app** (PWA) no Android/iPhone e abrir sem internet: só simulei o navegador.
- Salvar sem internet **com conta** e a nuvem acertando ao voltar (cobertura por specs no 12, não por mim).
- Publicar uma versão de verdade e esperar o aviso aparecer sozinho (usei o evento de teste `papirus:versao-nova`).
- Fotos grandes e imagens de mapa offline (só o texto).
- Primeira visita **sem** internet (o app precisa ser aberto uma vez antes).
