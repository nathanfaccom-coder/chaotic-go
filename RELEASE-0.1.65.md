# Chaotic GO v0.1.65 — publicação atualizada e auditoria de segurança

**Data:** 31/10/2026 (America/Sao_Paulo).

## Problema confirmado e corrigido
A verificação externa executada pelo GitHub Actions mostrou que o GitHub Pages estava **online mas entregando a v0.1.7**, enquanto a branch `main` já tinha v0.1.64. A origem efetiva do Pages era `feature/contas-e-salvamento-supabase`, no modo GitHub Pages `legacy`. O endereço validado veio da API de Pages do próprio repositório.

O workflow `.github/workflows/publish-pages-source.yml` automatiza a publicação:
- aguarda o workflow principal **Validar Decks e Supabase (Chaotic GO)** concluir com sucesso na `main`;
- verifica a origem legada do Pages e só avança se a configuração ainda corresponder à branch esperada;
- valida que o SHA testado ainda é o último da `main`, evitando publicar uma versão anterior;
- cria commit com a **árvore completa de arquivos da main**, com dois pais (o head antigo da origem Pages e o SHA testado de main), preservando os históricos, sem `force-push`;
- deixa a publicação legada do GitHub Pages criar o build normalmente.

A primeira execução de publicação concluiu **com sucesso** no GitHub Actions:
- workflow principal aprovado: `41163546648`;
- workflow de sincronização aprovado: `41163568332`;
- workflow de build/deploy do GitHub Pages aprovado: `41163578841`;
- o branch usado pelo Pages passou a conter `index.html` com **VERSÃO 0.1.65**.

A verificação externa `.github/workflows/verify-publication.yml` foi reexecutada com sucesso (run `41163382759`, tentativa 2). Testou **HTTP 200** de página inicial, scanner, login, JS do DROME, SW, CSS e logo, além de conferir a versão **0.1.65** e o marcador da RPC de sincronização. Depois disso, o fluxo foi ajustado para verificar a publicação **após** o workflow de sincronização, aguardando a propagação da versão pública, reduzindo falsos alertas.

**URL pública verificada:** https://nathanfaccom-coder.github.io/chaotic-go/

## Integridade da versão
- Identificação do `index.html` alterada para **v0.1.65**.
- Identificador de cache do `sw.js` alterado para `chaotic-go-release-20261031-65`.
- Referência de carregamento do `full-game-bootstrap.js` e import de `chaotic-lobby.js` atualizados para `release-65` no scanner, combatendo reutilização de scripts antigos no navegador.
- **Cartas, imagens, áudio, Decks, cartas originais e motor 1x1/6x6 não foram alterados nesta versão.** O conteúdo publicado é o mesmo da `main` validada.

## Auditoria Supabase
O teste `supabase/tests/chaotic-privileged-authorization-audit-live-v0165.test.sql` passou no projeto Supabase real:
- **0** RPCs `chaotic_*` com `SECURITY DEFINER` executáveis por `anon`;
- **72** RPCs privilegiadas intencionalmente executáveis por `authenticated`; todas contêm referência a `auth.uid()` no código-fonte, o que **não prova sozinho ausência de vulnerabilidades**;
- **7** tabelas internas sem política pública, com RLS ligado e sem privilégio de `SELECT` dos papéis `anon` ou `authenticated`;
- diagnóstico de presença/turno acessível apenas a `authenticated`.
O teste usa `BEGIN/ROLLBACK`, sem alteração de contas, cartas ou banco de produção.

**Alertas que permanecem:** 72 `SECURITY DEFINER` de cliente precisam de revisão individual de autorização; proteção contra senhas vazadas está desabilitada nas configurações do Auth, alteração que requer revisão de política do projeto. Não foram removidas permissões ou habilitadas políticas indiscriminadamente.

## Testes
- **153/153 testes Node aprovados** e sintaxe validada no GitHub Actions, run `41163546648`.
- Auditoria SQL acima: **PASS**.
- Build, publicação e checagem HTTP externa da v0.1.65: **PASS**.

## Ainda falta para entrega oficial
- Testar dois celulares físicos com duas contas diferentes, incluindo reconexão no meio de dano, permissões e telas.
- Concluir regras do combate oficial 3x3/6x6, equipamentos, Mugics e cartas restantes.
- Revisão de segurança detalhada dos endpoints privilegiados e reforço da autenticação.
- Homologação manual Android/PWA e checagem de cache após instalação.

**Progresso geral manual estimado: 94% (±10 pontos percentuais).** A porcentagem não equivale à conclusão de regras ou qualidade de produção. A publicação do frontend está comprovada, mas o PvP oficial não está pronto.
