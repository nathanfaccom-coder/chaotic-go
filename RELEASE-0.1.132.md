# Chaotic GO v0.1.132 — revanche entre dois jogadores

**11 de novembro de 2026**

## Novo fluxo
- A revanche fica disponível somente após o encerramento do protocolo de turnos ou um resultado de TREINO 3×3 autenticado.
- **Os dois participantes precisam aceitar**. A primeira confirmação fica no servidor; a segunda cria atomicamente uma nova sala pronta, com os mesmos jogadores e o mesmo modo.
- O adversário que estava esperando entra automaticamente na sala nova quando o servidor encerra a anterior. A solicitação pendente guarda somente ID e prazo localmente, permitindo recuperar o convite depois de alternar o Android para segundo plano.
- A sala antiga é cancelada e todo o estado experimental do DROME é reiniciado ao trocar para o novo ID. Cartas, Decks e álbum não são apagados nem alterados.
- Revanches continuam sendo treinos sem XP/moedas oficiais.

## Segurança
- RPC `chaotic_request_rematch` com autorização por `auth.uid()`, bloqueios de linha no banco e uma chave primária por sala: solicitações repetidas/simultâneas não criam partidas duplicadas.
- Não inicia revanche durante partida ativa nem quando há carta temporária retida/emprestada.
- Tabela de pedidos é SELECT-only via RLS exclusiva dos participantes, sem permissão de INSERT/UPDATE/DELETE para o navegador.
- Teste transacional real (BEGIN/ROLLBACK) do Supabase passou para terceiro bloqueado, partida ainda ativa bloqueada, ambas confirmações, sala única e sem recompensas.

## Convites
- Corrigido `maxlength=12` no campo de entrada: agora permite colar uma mensagem inteira de convite até 512 caracteres. O parser continua exigindo um código válido no conteúdo.
- Mantidos login, scanner, artes, cartas e mecânicas legadas.

## Limites atuais
- Multiplayer em treino não constitui batalha oficial; o motor original ainda exige integração, auditoria e testes completos antes de liberar XP/moedas.
- A estimativa de 97% anterior não significa que todos os modos e sistemas finais estejam completos. 100% não pode ser declarado nesta versão.
