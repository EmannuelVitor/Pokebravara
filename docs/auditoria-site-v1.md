# Auditoria PokeBravara — 17/11/2026

Escopo: todos os HTML, JS e CSS da raiz (`.agents/` ignorado: são skills, não fazem parte do site).
Método: leitura integral dos HTML/JS, `menu.css`, `theme.css`, `game.css` e do começo dos CSS de página; métricas por script.
**Não testei no navegador** (o login Google bloqueia as telas internas). Itens marcados *(confirmar)* dependem de ver a tela.
Referência visual: `D:\Yoru\docs\repaginada-1.3.0.md`, `D:\Yoru\docs\brief-visual.md` e `D:\Claude\RPGcord-site-html\styles.css`.
Não achei um documento único de "métricas visuais"; se existir, me indique e refaço a comparação.

---

## 1. Erros de código

### Críticos / alta prioridade
| # | Onde | Problema | Correção |
|---|------|----------|----------|
| C1 | `pokedex.js:254` | Após Avistar/Capturar grava `userPokedexProgress.set(id, newStatus)` (uma **string**), mas `displayPokedex` lê `progress.status`. Resultado: card com classe `undefined`, e um Pokémon só "avistado" aparece como capturado até recarregar. | `set(id, { ...atual, status: newStatus })` |
| C2 | `pokedex.js:234,275` | Compara `status === 'unknown'` sobre o objeto de progresso; a silhueta só funciona quando não há registro. | Ler `progress?.status ?? 'unknown'` |
| C3 | `pc.js:225` | Limite do time com `> 6` em vez de `>= 6`: professor consegue colocar o 7º Pokémon no time. (`mypc.js` usa `>= 6`, correto.) | `>= 6` |
| C4 | `pc.js:272`, `mypc.js:166`, `pc.js:143` | PC só renderiza 50 slots, mas nada limita o array. O 51º Pokémon **some da interface** (continua salvo). | Limitar na hora de adicionar/mover ou renderizar `max(50, pc.length)` / múltiplas caixas |
| C5 | Repositório | **Não há `firestore.rules` nem `storage.rules`**. Toda checagem de `level` ('Professor'/'Treinador') é só no navegador. O treinador escreve o próprio doc (`team`, `pc`, `bag` em `mypc.js`/`time.js`). Sem regras que travem campos, qualquer treinador pode se promover, liberar o PC ou criar itens. | Versionar as regras; bloquear escrita de `level`, `pcUnlocked`, `campaign`; validar `bag`/`team` por professor ou Cloud Function |
| C6 | `time.js:83` | Quem não tem doc ganha `createInitialData()` sem `level`, com nome "Novo Treinador" e IDs 146/149/152 rotulados "Bulbasaur/Charmander/Squirtle" (que não são esses Pokémon na sua base). Pula o cadastro de `menu.js`. | Redirecionar para `menu.html` quando `!doc.exists` |
| C7 | `trainers.js:104`, `pc.js:276`, `trainers.js:176` | Gravações sem `try/catch`. Em erro, o spinner (overlay `z-index:2000`, tela toda) **fica preso** e bloqueia a página. `pc.js` ainda mostra "foi adicionado!" **antes** de gravar. | try/catch/finally + feedback só depois do sucesso |
| C8 | `trainers.js:104` | Usa só `masterPokemonList`; `pc.js` usa lista + iniciais. Pokémon iniciais **somem** do painel do professor (e "Curar todos" cura sem mostrar). | Extrair `allAddablePokemon` e usar nas 4 páginas |

### Médios
- **Código triplicado**: `prepareAddablePokemonList` em `mypc.js`, `pc.js`, `time.js` (cada um com variação); `masterItemList` em `time.js` e nomes de item em `trainer-bag.js`. Mover para `database.js`/`utils.js`.
- `trainers.js:151` usa `escapeText` dentro de `textContent` → nomes com `&` aparecem como `&amp;`.
- `trainers.js:139`: `updateTrainerData` engole o erro (só `console.error`); o switch "PC liberado" muda na tela mesmo se falhar.
- `time.js` usa status `'ok'` no doc inicial; `edit-status` só tem `none,…` → select fica vazio.
- `trainers.js:119`: `isShiny ? masterInfo.imageShiny` sem fallback (os outros arquivos têm).
- `menu.js:146`: upload sem limite de tamanho e com `image.name` do usuário no caminho; arquivo órfão se o `set` falhar.
- `pc.js:211`: `currentTrainerData.team.length` sem `|| []`.
- 12 `alert()` (`pc.js` 6, `mypc.js` 3, `pokedex.js` 2, `trainers.js` 1): bloqueantes e sem estilo.
- 9 `!important` e 4 `style="…"` inline em JS.

### HTML
- `pokedex.html:40` tem `</div>` sobrando; scripts do Firebase no meio do `<body>` entre modais.
- `lang` inconsistente: `pt-br` / `pt-pt`; textos misturam PT-PT ("A carregar…", "Alcunha", "de ter") com PT-BR.
- `<title>` em dois formatos ("Entrar · PokeBravara" vs "PokeBravara - Pokédex").
- Páginas de jogo carregam Firebase e `database.js` (77 KB) **sem `defer`** → bloqueiam a renderização.
- Cards são `div role="button"` com `<a>` dentro (Pokédex): controle interativo aninhado.
- Abas da Pokédex sem `role="tab"`/`aria-selected`; botões sem `type`.
- `mybag.html` é só redirecionamento órfão (o menu já aponta para `time.html#mochila`).

### Infra
- `firebase.json`: `"public": "."` publica tudo que não começa com ponto (qualquer `.md`, backup ou script solto vai ao ar). Mover o site para `public/`. Sem 404, sem headers de segurança/CSP, sem cache de assets.
- Firebase SDK **8.10.1** (legado, sem tree-shaking). Font Awesome `6.0.0-beta3` (beta) por CDN, sem SRI, só para 3 ícones.
- Sprites hotlinkados de `raw.githubusercontent.com` (não é CDN, tem rate limit; se cair, a Pokédex inteira quebra). Cards de 120px baixam `official-artwork` grande. Hospedar/otimizar localmente ou usar jsDelivr.
- Imagens do hero (91–145 KB cada, PNG) são inseridas por JS (`portal.js`) com `width=475` fixo: LCP atrasado e risco de layout shift. Colocar no HTML, em WebP/AVIF.
- `.firebase/hosting..cache` e `.agents/` na raiz: manter fora do deploy (já são ignorados por serem ponto, ok) e do repositório.

### O que já está bom
Foco preso e Escape nos modais (`game-ui.js`), `prefers-reduced-motion`, alvos de 44px, `escapeText` na maioria dos dados do usuário, tratamento de falha de carregamento do SDK, fontes self-hosted com licença OFL.

---

## 2. Erros visuais

1. **Dois sistemas de design convivendo.** Páginas "portal" (`menu.css`, tokens, raio 10–24) e páginas de jogo (CSS antigo + `game.css` remendando por cima com seletores pesados e `!important`).
   Evidências: `#f0f0f0` ×16 (token é `#f7f5ff`), `#6949bf` ×11 (roxo fora da paleta), spinner azul `#3498db`/`#f3f3f3` em `pc`/`mypc`, `#2196f3`, `#4CAF50` (botão verde-Material), `#ff0000`/`#cc0000`.
2. **14 valores de `border-radius`** diferentes (5, 6, 8, 10, 11, 14, 15, 16, 18, 20, 24, 25, 50px, 50%). Botão em pílula (20–25px) numa página e 10px em outra.
3. `pc.css:6` `body{overflow:hidden}` permanece mesmo com `game.css` pondo `height:auto`: a tela do PC do professor provavelmente **não rola no celular** *(confirmar)*.
4. `pokedex.css`, `mypc.css`, `pc.css`, `trainers.css` têm **0 `@media`**; a responsividade depende só do remendo em `game.css`.
5. Tooltips de nome nos slots (`mypc`, `pc`) só aparecem em `:hover`: invisíveis no toque e no teclado.
6. Silhueta "desconhecida" (`brightness(0)`) sobre `#23263a`: contraste ~1,3:1, quase some.
7. Avatar sem foto/erro: `[data-image-failed]{opacity:0}` deixa um quadrado vazio.
8. HP só por cor (verde/amarelo/vermelho): ilegível para daltônicos; status por emoji (☠️⚡🔥💤❄️😵) muda de cara por sistema operacional.
9. Cartões da Pokédex com borda de 3px, sombras e hovers diferentes dos cartões do menu.
10. Spinner de tela cheia (`rgba(0,0,0,.8)`) para ações pequenas.
11. Hero do menu (min-height 420px) empurra o menu real para baixo da dobra no celular.

---

## 3. Navegabilidade

**Problemas**
- **Não existe navegação global.** Toda página interna só tem "Voltar ao menu". Time → PC → Mochila exige voltar ao menu a cada vez.
- "Sair" e o perfil só existem em `menu.html`.
- A marca "PokeBravara" leva a `index.html` (passa pelo login e redireciona): deveria ir ao `menu.html` quando logado.
- Professor: o menu só tem Pokédex e Treinadores; **PC e Mochila só aparecem escondidos dentro do modal** do treinador. Três páginas (`trainers`, `pc`, `bag`) mostram o mesmo treinador separadamente.
- Botão "Voltar" muda de rótulo e posição (`absolute` à esquerda em `time/trainers`, estático em outras; `bag.html` volta para treinadores, `pc.html?trainer=` volta para o menu).
- "Mochila" é âncora dentro de Time: no celular cai no meio da página.
- Aba "Iniciais" não está na URL (sem link direto, "voltar" do navegador sai da Pokédex).
- Usar item na Time exige 3 modais (selecionar Pokémon → aviso → item → confirmar).
- Professor não tem busca na Pokédex (a busca só aparece para Treinador, e só por número).
- Sem 404, sem *skip link*, login só por popup (falha em celular/navegadores embutidos; falta `signInWithRedirect` de reserva).
- PC bloqueado: tela sem orientação ("peça ao Professor") nem estado de ação.

**Melhorias propostas (por impacto)**
1. **Barra de navegação única** em todas as páginas internas: Início · Pokédex · Time · PC · Mochila (variante professor: Treinadores · Pokédex), com `aria-current`, perfil e Sair. Vira menu de baixo no celular (como o Yoru).
2. **Hub do treinador** para o professor: uma página `?trainer=` com abas Ficha · Time · PC · Mochila, substituindo o modal + `pc.html` + `bag.html`.
3. Mochila como seção própria (`/mochila`) ou aba dentro de Time, não âncora.
4. Pokédex: busca por nome, filtro por tipo e status, contador "37/145 capturados", aba na URL (`#iniciais`), busca também para professor.
5. Trocar `alert()` e modais informativos por **toasts**; trocar spinner de tela cheia por *skeletons* e botões em estado de carregamento.
6. Usar item: tocar no item → escolher o alvo no próprio grid (ou arrastar).
7. `firebase.json`: `cleanUrls`, `404.html`, marca → `menu.html`.
8. Tooltips também em `:focus-visible` e no toque (toque abre o detalhe).

---

## 4. Mapa de "cara de IA" e melhorias visuais

### Comparação com seus outros projetos
| Critério | PokeBravara | Yoru (repaginada/brief) | RPGcord |
|---|---|---|---|
| Fonte de títulos | Barlow Condensed 800 **caixa-alta** | Bricolage Grotesque | Georgia |
| Fonte de texto | DM Sans | Inter (texto), JetBrains Mono (códigos) | Inter/Arial |
| Cor | `oklch`: 0 · hex: 134 · `var()`: 159 | `oklch`: 104 · hex: 56 · `var()`: 283 | hex + `var()` |
| Tema | Lilás `#c8b5ff` sobre `#0e101a` | Noite: lilás + **âmbar `#F2B65A`** de destaque | Lilás `#8b73d8` + dourado |
| Status | Cor + emoji | **Forma** (bolinha, lua, traço, anel) | — |
| Avatar sem foto | Quadrado vazio | Cor estável por pessoa + símbolo | — |
| Animação | transição de cor 0,18s | Uma animação por transição, com versão parada | `riseIn` |
| Raios de borda | 14 valores | escala fixa | 10px |

Leitura: o PokeBravara usa **a mesma identidade lilás-escuro** do Yoru e do RPGcord. Isso é o que mais o deixa genérico: nada na interface diz "Pokémon", "mesa de RPG" ou "Bravara".

### Sinais de "AI slop" encontrados
1. **Hero-template**: etiqueta em caixa-alta espaçada com pontinho brilhante ("RPG POKÉMON", "CENTRAL DA AVENTURA") + título gigante em duas linhas com a 2ª em cor de destaque + subtexto + botão único + anéis concêntricos + colagem de 3 personagens. Aparece no login **e** no menu logado.
2. **Gradiente roxo radial** no fundo de todas as páginas (`body.portal` e `body.game-page`) e no hero (`#5736a6`→`#1c1636`).
3. **Cartão de menu padrão**: ícone de traço fino em quadradinho tingido (14%) + seta no canto + título + descrição cinza. Os ícones (`ball`, `id`, `team`…) são genéricos; "ball" é usado para marca **e** Pokédex.
4. **Logo = quadradinho arredondado lilás com ícone**: não é uma marca.
5. **Texto de marketing** onde deveria haver utilidade: "Sua jornada começa aqui.", "Explore Bravara.", "prepare-se para a próxima jornada", rodapé "PokeBravara RPG".
6. **Brilhos e anéis** (`box-shadow` concêntrico, glow do pontinho) sem função.
7. **Tudo arredondado e igual**: mesma superfície, mesma borda, mesmo raio em quase tudo; hierarquia só por tamanho de fonte.
8. **Emojis como interface** (❤️ ✨ ☠️ ⚡ 🔥 ❄️ 💤 😵).
9. **Ícones de Font Awesome beta** misturados com SVG de traço fino.
10. **Fonte "padrão de IA"**: DM Sans no corpo e condensada em caixa-alta nos títulos.

### Melhorias (em ordem de ganho)
1. **Dar identidade ao conteúdo, não à moldura.** Cada área ganha sua cor (o `menu.js` já define: Pokédex `#ffa3ac`, Time `#9be4bb`, PC `#a3dcff`, Mochila `#ffcf90`): aplicar no cabeçalho, na aba ativa e nos realces daquela página. As cores de tipo (`--type-*`, hoje só em `pokedex.css`) entram no sistema.
2. **Tema por campanha.** Já existe o campo `campaign` (Brasa/Fogo): usar como tema de cor/arte do treinador e do painel do professor. Isso é específico do projeto e nenhum template tem.
3. **Menu logado vira painel de estado**, sem hero: tira de 6 sprites do time com barra de HP, itens da mochila, "PC: 12 Pokémon", aviso de PC bloqueado. Cartões mostram dados reais em vez de descrição genérica; tamanhos diferentes por importância (bento), sem seta.
4. **Login mais curto**: marca real (wordmark próprio), uma frase de mesa de RPG, botão. Remover anéis e a colagem; se quiser arte, usar uma só por campanha, em WebP.
5. **Tipografia**: título com personalidade (Bricolage Grotesque, para ficar na família do Yoru, ou outra distinta), sem caixa-alta forçada; corpo livre de DM Sans; **mono tabular para números** (HP, nível, stats), como o Yoru faz com códigos.
6. **Cor em OKLCH com tokens semânticos** (como no Yoru): neutros levemente tingidos, **uma cor de ação quente** (âmbar do Yoru "Noite" ou amarelo-Pikachu) em vez de mais lilás; lilás só como neutro de superfície. Eliminar os 134 hex soltos.
7. **Escala única**: raios 4/8/16/pill, 3 elevações, 1 espessura de borda; remover `#f0f0f0/#6949bf/#3498db/#4CAF50`.
8. **Status e HP com forma** (regra do Yoru): ícone SVG próprio por status (veneno, paralisia…), barra de HP com marcações/ícone de crítico, nunca só cor. Substituir emojis.
9. **Avatar e imagens com fallback** gerado (cor estável por treinador + inicial ou Pokébola) em vez de quadrado vazio; silhueta da Pokédex com contorno claro.
10. **Movimento com função**: HP que anima ao curar, Pokébola ao capturar, transição de aba/modal única e coerente, sempre com versão parada (`reduced-motion` já existe).
11. **Copy em tom de mesa de RPG**, direta ("Entrar na mesa", "Seu time", "Sem itens — peça ao Professor"), em PT-BR único.
12. **Ícones**: um só conjunto (SVG inline próprio ou Lucide/Tabler como no Yoru), tirar Font Awesome; Pokébola desenhada à mão para a marca.

---

## 5. Roteiro sugerido
- **Fase 0 (1 dia) — bugs e segurança:** C1–C3, C6, C7, `overflow:hidden` do PC; escrever e subir `firestore.rules`/`storage.rules`; `defer` nos scripts.
- **Fase 1 (2–3 dias) — base:** um único `theme.css` com tokens OKLCH, escala de raio/elevação; apagar o CSS legado das páginas de jogo; extrair lista de Pokémon/itens para um módulo; mover o site para `public/`.
- **Fase 2 (3–4 dias) — navegação:** barra global, hub do treinador, mochila própria, filtros da Pokédex, toasts/skeletons.
- **Fase 3 (3–5 dias) — identidade:** cores por área e por campanha, menu-painel, nova marca/tipografia, status com forma, avatares com fallback, movimento.
- **Depois:** migrar Firebase 8 → SDK modular; sprites locais/CDN.
