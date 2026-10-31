# Chaotic GO v0.1.67 — Retomar sala após fechar o aplicativo

**Data:** 31/10/2026. **Escopo:** recuperação de sala do DROME após reiniciar/recarregar o PWA no Android; sem mudança em cartas, assets e regras de batalha.

## Problema identificado
Até a v0.1.66, a reconexão funcionava enquanto o JavaScript do navegador permanecia vivo. Ao fechar a aba/PWA ou após uma interrupção completa do processo Android, a variável `room` voltava para `null`. O combate permanecia persistido no Supabase, mas a interface perdia a referência da sala e exigia inserir o código novamente.

## Correção aplicada em `chaotic-lobby.js`
- Somente **ID e data de expiração da última sala** são guardados no `localStorage`, na chave específica `chaotic-go:last-room:<userId>`. Não armazena cartas, Decks, senhas, tokens, convite nem ações.
- Ao abrir o DROME, o aplicativo consulta `chaotic_lobbies` no Supabase com o ID salvo. A RLS do banco permite leitura somente aos participantes `host_id` ou `guest_id`.
- A interface só retoma salas `waiting` ou `ready` ainda não expiradas, se o usuário autenticado é realmente um dos dois participantes. Dados ausentes, revogados, corrompidos ou expirados são descartados.
- Após validar participação, restaura o painel, reativa a assinatura em tempo real e consulta os estados de turno, dano e o checkpoint privado da v0.1.66. **O processo é de leitura e heartbeat: não refaz ataque, pagamento, resposta do defensor nem dano.**
- Em modo sem armazenamento persistente (navegação privada ou política do dispositivo), o uso por código continua possível.
- Ao sair/encerrar uma sala, remove a referência local. Ao voltar o Android do segundo plano ou restabelecer conexão, tenta recuperar novamente caso ainda não haja sala aberta.
- Respostas assíncronas de uma tela anterior são desconsideradas pelo contador de geração `viewGeneration`, e a restauração é reavaliada ao remontar a tela.

## Testes
- `tests/lobby.test.mjs`: testes simulados com mais de uma instância do navegador: anfitrião fecha/reabre o DROME, restaura sala compartilhada com convidado; tentativa de usar ID de sala de outra conta é bloqueada; entradas corrompidas/expiradas são eliminadas. Não afirma emular um aparelho real.
- `supabase/tests/chaotic-room-restore-rls-live-v0167.test.sql`: **PASS no Supabase real**, com duas identidades sintéticas autorizadas e um terceiro usuário não autorizado. Host e guest conseguem ler sua sala; outsider não consegue. Nenhuma conta ou sala fictícia permanece, graças a `BEGIN/ROLLBACK`.
- `tests/room-restoration-v0167.test.mjs`: regressões estáticas sobre escopo de armazenamento, validação de identidade, descarte de referências inválidas, isolamento RLS e alinhamento do cache.
- O GitHub Actions valida novamente toda a suíte, sintaxe e publicação. Consulte os runs associados à versão para o resultado final.

## Publicação
`index.html` exibe **v0.1.67**, com `sw.js?v=release-67`. Identificação do cache PWA e imports de `full-game-bootstrap.js` / `chaotic-lobby.js` também mudam para `release-67`; imagens, áudios, cartas e arquivos originais permanecem intactos. A publicação pelo GitHub Pages depende da aprovação do CI e validação HTTP.

## Limitações e próximas prioridades
1. **Não foi feito teste com dois celulares físicos.** A próxima homologação deve comparar Android ↔ Android em redes diferentes, incluindo fechar PWA em plena janela de defesa, reabrir, responder, perder conexão no instante do dano, voltar e conferir HP único.
2. O combate 3x3 ainda é **experimental**, não uma partida oficial com todas as habilidades/Mugics e recompensas; não declarar o jogo oficialmente completo.
3. Auditoria pendente: 73 funções `SECURITY DEFINER` acessíveis a contas autenticadas merecem revisão caso a caso; configuração de proteção contra senhas comprometidas ainda requer avaliação no painel Supabase Auth.
4. A restauração de sala é limitada à última sala ativa **por conta e navegador**, não uma sincronização automática entre dispositivos. Isso impede que cache local seja tratado como identidade/autorização.
5. A primeira atualização após reconexão depende da conexão de rede; se falhar, a referência é conservada para nova tentativa quando o usuário voltar online.

**Progresso geral estimado: 96% (margem ±10 p.p.)**, indicador de planejamento manual, não garantia de prontidão. O PvP oficial e a homologação real em dois celulares continuam pendentes.
