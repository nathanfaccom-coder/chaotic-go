# Chaotic GO v0.1.97 — guia de duas telas e proteção de entrada na sala

**Data:** 31/10/2026. **Progresso estimado:** 97% (treino 3×3 ainda não homologado em aparelhos reais).

## Melhorias
- O DROME exibe uma orientação dinâmica sobre a próxima etapa, baseada no checkpoint de turno, na presença dos jogadores e na preparação do próprio Deck. O texto diferencia ataque, defesa, pagamento, aplicação do dano, SONAR, Vento Forte e encerramento por três nocautes.
- A orientação é informativa; nunca envia ações ou altera a lógica do servidor. Caso o checkpoint esteja indisponível ou antigo, recomenda atualização e proíbe inferir um ataque.
- Criar sala e entrar por código descartam respostas RPC que chegarem depois que o usuário trocar de tela/sala. O código de sala antigo não substitui uma sessão nova.
- A versão dos arquivos de login, scanner, bootstrap e cache foi sincronizada para release-97.

## Testes e limites
Testes de regressão simulam atacante e defensor em diversas fases, conexão obsoleta, preparação, resposta tardia de criação/entrada e fluxo normal. O workflow de testes é pré-requisito para publicação no GitHub Pages. Não houve alterações em cartas, imagens, Decks, SQL, XP ou moedas.

**Pendente:** homologação real em dois celulares distintos. O diagnóstico de presença, os testes locais e os testes SQL não substituem a execução manual completa.
