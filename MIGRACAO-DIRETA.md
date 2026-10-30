# Chaotic GO — migração direta (30/10/2026)

**Site oficial**: `https://nathanfaccom-coder.github.io/chaotic-go/`.

Este lançamento promove a base completa com Decks, cartas, áudio, scanner, mapa, oficina, minigames e DROME, com autenticação e salvamento privado via Supabase. Os arquivos de código antigos foram preservados em uma branch de backup e no endereço `/legacy/`.

## Preservação
- Backup Git da publicação anterior: `backup/pages-before-direct-migration-2026-10-30`.
- Backup Git da `main` antiga: `backup/main-before-direct-migration-2026-10-30`.
- Tabelas Supabase existentes foram mantidas, sem DROP ou TRUNCATE e sem redefinir contas.
- Carta/álbum/perfil anteriores do **teste Supabase** são importados sem sobrescrever registros da versão completa.
- Os dados de um eventual **Firebase antigo** não foram copiados automaticamente: sua identidade Firebase é diferente da identidade Supabase. Preservamos o código antigo para permitir recuperação posterior, se necessário.

## Estado das mecânicas
- Restaurados os arquivos originais de Decks, batalha, cartas, áudio, mapa, scanner, minigames e interface.
- Decks compatíveis com `decks/<modo>_slot_<número>` e com nomes simplificados anteriores.
- O DROME de batalha multiplayer **não está totalmente migrado**; salas privadas e protótipos de turnos/cartas no Supabase estão em teste. Isso não é uma partida oficial.
- Sistema legado de trocas/amigos ainda possui referências Firebase e exige adaptação segura antes de transferir cartas entre contas.
- Não ativar economia/recompensas por RPCs de teste.

## Cache e PWA
O service worker de lançamento não armazena telas autenticadas nem JavaScript em cache, evitando login antigo/Firebase persistente. Para reinstalações antigas, recarregue a página principal.

## Testes
`node --test tests/*.test.mjs` com GitHub Actions e `node --check` nos módulos; testes em dois dispositivos reais ainda pendentes.
