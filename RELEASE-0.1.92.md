# Chaotic GO v0.1.92 — isolamento de salas e estabilidade no celular

**Data:** 31 de outubro de 2026. **Progresso estimado:** 97%. Não é homologação do multiplayer.

## Corrigido
- Ao trocar de sala no DROME, elimina o estado local anterior de dano, nocaute, resultados de treino, efeitos pendentes de cartas, verificação de equipamentos, pesquisa SONAR, marcador de cartas viradas e diagnóstico de presença. A correção não apaga nada do servidor, Decks, álbuns nem imagens.
- A primeira leitura do turno agora verifica se o usuário ainda está na mesma sala/tela antes de atualizar o painel; respostas antigas dessa leitura não sobrescrevem o novo combate.
- O polling de contingência aguarda uma leitura em andamento terminar, evitando consultas redundantes em internet móvel lenta. Mudanças recebidas por Realtime continuam usando a fila de atualização existente.
- Ao abrir o DROME offline, não tenta recuperar imediatamente uma sala remota: conserva a referência local, informa a falta de conexão e aguarda reconexão.
- Login, scanner, bootstrap, abertura e service worker agora compartilham o identificador da release-92.

## Verificações
Foram adicionados testes de isolamento do estado de duas salas, resposta atrasada de turno, recuperação offline e supressão de polling sobreposto. A publicação é condicionada à validação do workflow e verificação HTTP dos arquivos públicos.

## Ainda pendente
Jogar do início ao fim em **dois celulares reais e duas contas distintas**, observar fluxo de preparação, 3x3, dano, três nocautes, resultado e reconexão no meio do ataque. Modos 1x1/6x6 permanecem de teste. Não declarar batalha oficial nem recompensas.
