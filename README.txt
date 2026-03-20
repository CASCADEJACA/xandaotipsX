# Xandão Tips Futebol — iPhone Web App (PWA)

## O que é
Esta entrega é uma **web app para iPhone** com visual futurista, marca Xandão Tips Futebol, lema **"Xandão o Terror das Bets"** e selo **"Uso restrito para amigos de Xandão"**.

## Transparência
- Os jogos são carregados com **dados reais** de partidas via endpoints públicos da ESPN.
- O app **não usa dados simulados** para agenda/placares/notícias.
- Mercados avançados como **cartões, escanteios, laterais, tiros de meta, impedimentos e chutes por tempo** exigem um provedor premium específico. Por isso, nesta versão eles só aparecem quando houver dados suficientes; caso contrário, o app informa que o feed premium é necessário.

## Como usar no iPhone
O iPhone **não instala diretamente** um arquivo `.ipa` solto sem assinatura. O jeito prático aqui é usar como **web app no Safari**.

1. Hospede esta pasta em um serviço estático, como Netlify, Vercel ou GitHub Pages.
2. Abra a URL no **Safari do iPhone**.
3. Toque em **Compartilhar**.
4. Toque em **Adicionar à Tela de Início**.
5. Ative **Abrir como app** quando a opção aparecer.

## Fontes de dados
- ESPN Site API (endpoints públicos, não oficiais)
- Opcional: token do football-data.org para ampliar contexto de tabela/elenco
- Opcional: token de feed premium para mercados avançados

## Arquivos principais
- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `service-worker.js`

## Observação importante
Sem um backend próprio ou chaves de provedores premium, não é honesto prometer em iPhone todos os mercados avançados pré-jogo com a mesma profundidade do desktop.