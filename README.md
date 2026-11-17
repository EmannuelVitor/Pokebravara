# PokeBravara

Site de apoio a uma mesa de RPG Pokémon: ficha do treinador, time, PC, mochila, Pokédex, mapa, encontros, batalhas por turnos, loja, NPCs e facções. O site é o motor de regras (rola dados e calcula dano, captura e XP) e o Mestre tem a palavra final.

Em produção: https://pokemonbravara.web.app (Firebase Hosting).

## Estrutura

| Pasta | O que é |
| --- | --- |
| `app/` | Site atual: Vite + React 19 + TypeScript + Firebase 13 (SDK modular) |
| `app/src/rules/` | Motor de regras (puro, testado): stats, XP, tipos, status, dano, captura, batalha, mochila, classes |
| `app/src/data/` | Espécies, golpes e habilidades gerados da PokeAPI (`npm run data`) |
| `app/src/pages/` | Telas do jogador e do Mestre (`pages/master/`) |
| `firestore.rules`, `storage.rules` | Regras de segurança (testadas no emulador) |
| `public/` | Site antigo (vanilla JS). Só como referência/reversão; não é mais publicado |
| `docs/` | Passagem de projeto e auditoria do site antigo |

## Como rodar

```bash
cd app
npm install
npm run dev          # contra o Firebase real
npm test             # testes do motor de regras
npm run build        # gera app/dist
```

Desenvolvimento com os emuladores do Firebase (sem tocar em produção), na raiz do repositório:

```bash
firebase emulators:start --only auth,firestore,storage --project pokemonbravara --config firebase.test.json
cd app && node scripts/seed-emulator.mjs && VITE_EMULATORS=1 npm run dev
```

A tela de login mostra botões "Teste: mestre / ash / misty / novo" quando `VITE_EMULATORS=1`.

Testar as regras do Firestore:

```bash
firebase emulators:exec --only firestore --project demo-test --config firebase.test.json "node app/scripts/rules-test.mjs"
```

## Publicar

```bash
cd app && npm run build && cd ..
firebase deploy --only hosting                       # só o site
firebase deploy --only firestore:rules,storage       # só as regras
```

Leia `docs/PASSAGEM.md` antes de mexer: ele explica as decisões, os limites conhecidos e o que falta.
