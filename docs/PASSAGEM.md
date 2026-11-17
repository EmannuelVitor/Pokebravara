# Passagem de projeto — PokeBravara

Atualizado em 17/11/2026. Para quem vai continuar o trabalho: leia isto antes de abrir o código.

## 1. O que é e para quem

Site de uma mesa de RPG Pokémon (campanhas **Brasa** e **Fogo**). Existem dois papéis:

- **Treinador (jogador):** ficha, time, PC, mochila, loja, Pokédex, mapa e batalhas.
- **Professor (Mestre):** cria mapa, encontros, NPCs e facções; entrega Pokémon, itens, dinheiro e insígnias; conduz as batalhas e aplica o resultado nas fichas.

Decisão central: **o site é o motor e o Mestre tem a palavra final.** O site rola os dados e calcula iniciativa, dano, captura e XP; o Mestre pode ajustar qualquer valor pela tela de edição do treinador.

## 2. Estado atual

Em produção desde 17/11/2026: https://pokemonbravara.web.app (projeto Firebase `pokemonbravara`). O site antigo (vanilla JS) ficou em `public/` só como reversão.

Implementado (documento de sistema): classes, atributos e perícias; mochila com categorias e limite; PC com caixas; XP e evoluções; 6 stats e 25 naturezas; golpes com PP; batalha por turnos com tabela de tipos e status; mapa, encontros por clima, captura com rolagem, habilidades de campo, acampamento; loja; NPCs e facções.

**Testado:** motor de regras (27 testes unitários), regras do Firestore (47 casos no emulador) e os fluxos principais no navegador contra os emuladores (ficha, time, PC, item, encontro, batalha, captura, NPC, recompensa e insígnia).

**Não testado em produção:** login Google real, upload de foto no cadastro, compra na loja, evolução e acampamento pela tela, fuga e item dentro da batalha, batalhas com várias rodadas pela interface.

## 3. Arquitetura

- **Front:** Vite + React 19 + TypeScript (strict) + React Router 8. Sem biblioteca de UI: CSS próprio em `app/src/styles.css` com tokens OKLCH (tema fogo e brasa; `data-campaign="fogo"` muda a cor).
- **Dados em tempo real:** Firestore com `onSnapshot` (batalha: o jogador envia a ação, o Mestre resolve).
- **Motor de regras:** `app/src/rules/*` são funções puras (sem Firebase, sem DOM), com dado injetável (`Rng`). A tela só chama o motor e grava o resultado.
- **Dados de espécies:** `app/src/data/*.json` gerados por `npm run data` a partir da PokeAPI, mantendo os **ids próprios** do projeto (1–145 Pokédex regional, 146+ iniciais), porque o Firestore e o site antigo já usam esses ids.
- **Fontes:** Bricolage Grotesque (títulos) e Instrument Sans (texto), auto-hospedadas em `app/public/assets` (licença OFL incluída).

### Mapa dos arquivos importantes

| Arquivo | Papel |
| --- | --- |
| `rules/config.ts` | **Todos os números ajustáveis** (XP, captura, preços de pontos, limites). Comece por aqui para mudar uma regra |
| `rules/battle.ts` | Estado da batalha e `resolveRound` (iniciativa, golpes, status, XP, captura, fuga) |
| `rules/pokemon.ts` | Criar/normalizar Pokémon, XP e nível, evolução, uso de itens, cura |
| `rules/items.ts` | Catálogo de itens, categorias e preços |
| `rules/trainer.ts` | Classes, atributos, perícias e testes |
| `lib/db.ts` | Todas as leituras/escritas do Firestore e `applyBattle` |
| `lib/normalize.ts` | Completa fichas antigas (v1) em memória |
| `model.ts` | Formato dos documentos |
| `pages/BattlePage.tsx` | Tela de batalha (jogador e Mestre) |
| `pages/MapPage.tsx` | Mapa, encontros, descanso e editor de áreas |
| `pages/master/*` | Painel do Mestre, treinadores e NPCs/facções |

## 4. Modelo de dados (Firestore)

- `users/{uid}`: perfil. Treinador: `level:'Treinador'`, `trainerName`, `campaign`, `trainerClass`, `attributes`, `skills`, `money`, `badges`, `team[]`, `pc[]`, `bag[]`, `pcUnlocked`. Professor: `level:'Professor'`, `professorName`.
- `users/{uid}/pokedex/{id}`: `{status:'sighted'|'captured'}`.
- `roles/professors`: `{emails:[...]}`. **É assim que alguém vira Mestre**: o e-mail precisa estar nesta lista (editada pelo console do Firebase) antes do primeiro acesso.
- `campaigns/{brasa|fogo}`: mapa (`regions`), `location`, `weather`, `npcs`, `factions`, `log`.
- `battles/{id}`: estado completo da batalha (`trainers`, `enemy`, `actions`, `log`, `captures`, `xp`, `applied`).

Pokémon (`PokemonInstance`) guarda `uid`, `pokemonId`, `level`, `xp`, `nature`, `ability`, `moves[{slug,pp}]`, `friendship`, `statusCondition`. Fichas do site antigo não têm esses campos: `normalizePokemon` os completa ao ler, e o valor novo é gravado na próxima alteração.

## 5. Segurança

Regras em `firestore.rules` e `storage.rules` (publicadas). Resumo:

- Treinador lê só o próprio perfil; Mestre lê e lista todos.
- Treinador não muda `level`, `pcUnlocked`, `campaign`, `badges`; dinheiro só diminui; classe e atributos só podem ser definidos uma vez.
- Mestre edita apenas `team, pc, bag, pcUnlocked, campaign, money, badges, trainerClass, attributes, skills`.
- Batalha: só o Mestre cria e resolve; cada participante escreve apenas a própria entrada em `actions`.

**Limite conhecido:** o treinador ainda grava o próprio `team`, `pc` e `bag` direto do navegador (é assim que usa item, cura no Centro e troca Pokémon). Um jogador mal-intencionado poderia se dar itens e Pokémon. Corrigir exige Cloud Functions (ou mover essas ações para o Mestre).

## 6. Decisões e limites das regras

- Fórmulas: dano, curvas de XP, taxa de captura e naturezas seguem os jogos; captura na mesa é 1d100 contra a chance calculada.
- **Habilidades (Intimidate, Levitate…) aparecem com descrição, mas não têm efeito na batalha.** Também não existem efeito de clima no combate, recuo (flinch) nem itens segurados.
- Golpes e habilidades estão em inglês (a PokeAPI não traz português).
- Evolução por troca e por condições especiais é confirmada pelo Mestre. Espécies fora da Pokédex do projeto aparecem na aba Evolução como "fora da Pokédex", sem botão.
- O Ranger rerrola encontros sem limite por dia.
- Descanso curto e acampamento estão no mapa do Mestre; o PC do jogador só funciona em cidade com Centro Pokémon (ou com o switch "PC liberado" do Mestre).

## 7. Como trabalhar

Comandos no `README.md`. Pontos que costumam enganar:

- **Emuladores:** `VITE_EMULATORS=1` conecta o app aos emuladores e mostra os botões de login de teste. O `seed-emulator.mjs` cria as contas e os dados (mestre, ash no formato antigo, misty já com classe).
- **Regras:** qualquer mudança em `firestore.rules` precisa passar por `app/scripts/rules-test.mjs` (adicione casos novos ali).
- **Dados de espécies:** mexer em `app/src/data/*.json` à mão se perde ao rodar `npm run data`. Ajustes permanentes entram no script `app/scripts/build-data.mjs`.
- **Windows:** no PowerShell, o `firebase` precisa estar no PATH (instalação via npm). Heredocs com aspas dentro do Bash podem falhar; prefira arquivos.
- O Hosting publica `app/dist` (rode o build antes) e reescreve tudo para `index.html` (SPA). Redirecionamentos das URLs antigas (`menu.html`, `time.html`…) estão em `firebase.json`.

## 8. Próximos passos sugeridos

1. Validar em produção com contas reais (login Google e foto no cadastro) e corrigir o que aparecer.
2. Efeito das habilidades e do clima na batalha (hoje só texto).
3. Cloud Functions para as ações que alteram time, PC e mochila, fechando o limite de segurança.
4. Limite diário do Ranger, itens segurados e efeitos de recuo.
5. Traduzir golpes e habilidades.
6. Testes de interface (Playwright) para os fluxos de batalha e loja.
7. Remover `public/` (site antigo) quando o novo estiver estável.

## 9. Contas e acesso

- Projeto Firebase: `pokemonbravara` (site `pokemonbravara`). A configuração web em `app/src/firebase.ts` é pública por natureza; o acesso é controlado pelas regras.
- Não há chaves secretas no repositório.
