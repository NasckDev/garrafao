# Garrafão

Preview de jogadores da NBA em que cada jogador repinta a página com as cores do time, com dados públicos da ESPN
consumidos, validados e normalizados por um proxy próprio. Publicado em
[nasck.vercel.app/projetos/garrafao/](https://nasck.vercel.app/projetos/garrafao/).

Projeto de estudo, sem vínculo com a NBA ou a ESPN.

## O que tem

| Aba | O que mostra | Dados |
|---|---|---|
| Jogadores | Palco com cor, número e foto; ficha; médias da temporada; raio-x (radar, arremesso, frente a frente, ranking dos destaques); busca na liga inteira e por time; filtro por posição; atalhos ← → | `players`, `search`, `teams`, `roster` |
| Favoritos | Jogadores e times marcados com estrela (guardados no navegador), comparação rápida, jogo de hoje dos times | `players`, `standings`, `scoreboard` |
| Ao vivo | Placar do dia com navegação por data, status (agendado em horário de Brasília, ao vivo com período e relógio, final), parciais por quarto, painel do jogo com líderes; atualiza sozinho só com jogo ao vivo e aba visível | `scoreboard`, `summary` |
| Classificação | Leste e Oeste: V, D, %, jogos atrás, sequência, últimos 10, casa, fora, saldo | `standings` |
| Eventos | Fases da temporada, NBA Cup, All-Star e Draft, só com o que a fonte publica | `events`, `draft` |
| Notícias | Manchetes da ESPN com link para a matéria | `news` |

Estados completos em todas as abas: carregando (esqueleto), vazio, erro com "Tentar de novo", parcial e offline com instantâneo.
Claro/escuro (automático ou escolhido), responsivo de 390 px a 1440 px+, abertura animada só na primeira visita da sessão (pulável),
`prefers-reduced-motion` respeitado.

## Arquitetura

```
navegador (React 19 + TanStack Query)
   │  GET /api/nba?op=...           (mesma origem; nunca fala com a ESPN)
   ▼
proxy (server/handler.ts)          Vercel Function em produção; middleware do Vite no desenvolvimento
   ├─ lista fechada de operações (server/ops.ts) e validação de cada parâmetro (server/validate.ts)
   ├─ URL de origem montada no servidor (server/origin.ts) só para 3 hosts da ESPN
   ├─ fetch com timeout e limite de tamanho (server/fetch-json.ts)
   ├─ normalização para tipos próprios (server/normalize/*, server/types.ts)
   └─ Cache-Control por tipo de dado  → CDN da Vercel
   ▼
site.api.espn.com · site.web.api.espn.com · sports.core.api.espn.com
```

- `src/` é o app; `server/` é o proxy (sem dependências, roda igual no Node da Vercel, no Vite e nos testes).
- Roteamento por hash (`#/ao-vivo/20261124?jogo=…`): funciona servido em subpasta estática e recarrega rota interna sem 404.
- Persistência local com versão de esquema (`src/lib/storage.ts`): dado corrompido ou de versão desconhecida volta ao padrão.
- Só a aba Jogadores entra no JS inicial; as outras abas e o instantâneo offline são carregados sob demanda.

## Decisões sobre as APIs

- **Proxy mesmo com CORS liberado.** Cache na CDN (um acesso à ESPN atende muitos visitantes), contrato estável para o app
  (a ESPN muda nomes e formatos sem aviso) e um único lugar para validar e limitar o que sai para a origem.
- **Lista fechada de operações, sem SSRF.** O cliente escolhe `op` e parâmetros validados; a URL é montada no servidor e
  `fetchJson` recusa qualquer host fora dos três da ESPN. Parâmetro extra é recusado (também evita variações inúteis na chave de cache).
- **Erros sem vazamento.** 400 com mensagem do parâmetro inválido; id inexistente na origem vira 404; qualquer falha de origem
  (status, rede, timeout de 6 s, JSON inesperado) vira 502 `{ error }` genérico, com o motivo só no log da função.
- **Normalização defensiva.** Tudo que a fonte pode omitir vira `null`, nunca um valor inventado. Links só `https`.
  Estatísticas lidas pelos nomes estáveis das colunas (`avgPoints`), com os rótulos curtos como reserva.
- **Dia da rodada.** O parâmetro `dates` da ESPN segue o dia de Nova York; a navegação usa esse dia e todos os horários aparecem em Brasília.
- **Horário a definir.** Jogos com `timeValid: false` (mata-mata da NBA Cup ainda sem times) mostram só a data, no fuso da liga.
- **Médias sem mistura de temporadas.** Médias completas vêm de `athletes/{id}/overview` (temporada regular corrente); se faltarem,
  o resumo do próprio perfil (mesma temporada) é usado e a nota abaixo dos números diz isso.
- **Lote de jogadores.** `op=players&ids=…` (até 30) busca perfil e médias em paralelo no servidor, com concorrência limitada;
  falha de um jogador não derruba o lote (`missing` lista quem faltou e o cache fica curto).
- **Polling.** O placar só se atualiza sozinho com jogo ao vivo e a aba visível (`liveRefetchInterval`), a cada 15 s, alinhado ao cache da CDN.
- **Instantâneo offline.** `src/data/snapshot.json` foi gravado de verdade pelos mesmos normalizadores (`npm run snapshot`) e só é usado
  quando a API falha (rede, origem fora ou site servido sem a Function), sempre com a data de captura na tela.

### Operações e cache

| `op` | Parâmetros | Origem | `s-maxage` / `stale-while-revalidate` |
|---|---|---|---|
| `scoreboard` | `date=AAAAMMDD` | `site/…/scoreboard?dates=` | ao vivo 15 s / 30 s; hoje 60 s / 120 s; dia passado encerrado 1 h / 1 dia; futuro 5 min / 10 min |
| `summary` | `event` | `site/…/summary?event=` | ao vivo 15 s / 30 s; encerrado 1 h / 1 dia; antes do jogo 5 min / 10 min |
| `standings` | — | `site/apis/v2/…/standings` | 5 min / 15 min |
| `news` | — | `site/…/news?limit=20` | 10 min / 30 min |
| `teams` | — | `site/…/teams` | 1 dia / 7 dias |
| `roster` | `team` | `site/…/teams/{id}/roster` | 1 h / 1 dia |
| `athlete` | `id` | `common/v3/…/athletes/{id}` | 1 h / 1 dia |
| `overview` | `id` | `common/v3/…/athletes/{id}/overview` | 15 min / 1 h |
| `players` | `ids` (até 30) | `athlete` + `overview` de cada id | 15 min / 1 h (parcial: 5 min / 10 min) |
| `search` | `q` (2 a 40 caracteres) | `common/v3/search` | 1 h / 1 dia |
| `season` | `year` | core `seasons/{ano}` | 1 dia / 7 dias |
| `draft` | `year` | core `seasons/{ano}/draft` + `site/…/draft?season=` | encerrado 1 dia / 7 dias; senão 1 h / 1 dia |
| `events` | `season` | core `seasons/{ano}`, core `tournaments/1` e `tournaments/1/seasons/{ano}`, placar mês a mês | 6 h / 1 dia (parcial: 5 min / 10 min) |

Erros: 400 e 502 com `no-store`; 404 com `s-maxage=60`.

### Fonte de cada dado da aba Eventos

- **Fases da temporada** (pré-temporada, regular, play-in, playoffs, entressafra): API core, `seasons/{ano}` (tipos da temporada com datas).
- **NBA Cup**: nome e número de rodadas do mata-mata pela API core (`tournaments/1`, `tournaments/1/seasons/{ano}`); jogos encontrados
  no calendário mês a mês (`scoreboard?dates=AAAAMM`) pela nota oficial do jogo ("NBA Cup - Group Play", "Quarterfinals",
  "Semifinals", "NBA Cup Championship"). Mês que falha vira aviso de dados parciais.
- **All-Star**: jogos do tipo `ALLSTAR` no mesmo calendário. Se a fonte ainda não publicou, a aba diz que a data não está disponível;
  nenhuma data é estimada.
- **Draft**: data, rodadas e situação pela API core (`seasons/{ano}/draft`); escolhas (atleta, posição, origem, time) pelo endpoint
  `site/…/draft?season=`, que já traz os nomes resolvidos (a core só traz referências).

## Rodando

Node 22 ou superior.

```bash
npm install
npm run dev               # http://localhost:5291, com /api/nba real (ESPN)
                          # (a 5192 do plano original estava ocupada por outro app nesta máquina)
GARRAFAO_FIXTURES=1 npm run dev   # mesma coisa sem rede, com as respostas gravadas
npm run typecheck && npm run lint
npm test                  # unitários e componentes (Vitest + Testing Library + MSW)
npm run test:e2e          # Playwright + axe em 390 e 1440, claro e escuro
npm run publish:portfolio # build com base /projetos/garrafao/ e cópia para o portfólio
```

Outros scripts: `npm run fixtures:record` regrava as respostas reais em `tests/fixtures/espn` (reduzidas aos campos lidos)
e `npm run snapshot` regrava o instantâneo offline.

## Testes

- **Normalizadores** contra respostas reais gravadas em 25/11/2026 (placar com jogos agendados, finalizados e dia sem jogos,
  resumo, classificação, perfil, médias, busca, elenco, times, temporada, draft encerrado e agendado, calendário mês a mês).
- **Handler**: lista fechada, validação de cada parâmetro, parâmetro extra, método, timeout, erro de origem → 502 sem vazamento,
  404, host fora da lista, resposta grande demais e o `Cache-Control` de cada operação.
- **Tema e contraste**: os 30 times, claro e escuro, atingem 4,5:1 nos textos e 3:1 nos elementos gráficos.
- **Polling, rotas, persistência e formatação** (fuso de Brasília, dia da liga, horário a definir).
- **Componentes com MSW**, rodando o handler real sobre as fixtures: Ao vivo, painel do jogo, Classificação (inclusive offline),
  Eventos, Notícias, Jogadores e Favoritos.
- **E2E** (Playwright, build de produção, API interceptada com o handler sobre as fixtures, relógio fixo): jogadores → favoritar →
  favoritos → ao vivo (troca de data, painel do jogo) → classificação → eventos → notícias, nos 4 projetos (390/1440 × claro/escuro),
  com axe sem violações sérias; mais abertura pulável e queda para o instantâneo sem API.

## Créditos

Dados: ESPN (endpoints públicos). Fontes: Big Shoulders Display e Schibsted Grotesk (Fontsource, auto-hospedadas).
Nomes, fotos e cores dos times pertencem aos seus donos.
