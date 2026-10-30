# Configurar o Supabase do Chaotic GO

Implementação experimental na branch `feature/contas-e-salvamento-supabase`. **Não foi publicada em main.** O banco exclusivo já foi provisionado e a chave publishable configurada.

1. Projeto exclusivo criado: **ChaoticGO** em `https://avmpfnveotjzoqkrygfn.supabase.co`. Sua conexão foi autorizada no ChatGPT. Migração `create_chaotic_player_state_rls` concluída com sucesso e verificada.
2. **Concluído:** a migração `create_chaotic_player_state_rls` já foi aplicada. RLS e três políticas conferidas; não precisa executar o arquivo de novo.
3. **Concluído:** URL e chave publishable foram preenchidas em `supabase-config.js`. **Nunca use service_role ou sb_secret_ no navegador.**
4. **Pendente (painel):** confira **Authentication → Providers → Email** e configure **Authentication → URL Configuration** com a URL real de publicação do site, permitindo redirecionamentos para `/login.html` e `/redefinir-senha.html`. O conector atual não expõe essa configuração.
5. **Pendente:** faça testes com duas contas reais: registre, confirme o e-mail, entre, capture uma carta, recarregue, entre de outro navegador e verifique persistência. Confira que uma conta não consegue ler/escrever os dados da outra.
6. Somente depois mescle a branch na `main` e faça o deploy.

**Dados antigos**: não são apagados do localStorage. O botão de importar aparece apenas quando eles existem, pede confirmação e **substitui o estado atual da conta**. O sistema não importa automaticamente dados de outro navegador.

**Limitações**: a camada de estado é sincronizada com o servidor, porém as regras de captura e progressão ainda rodam no cliente. Para trocas competitivas e multiplayer, é indispensável validar transações e recompensas no backend. O modo offline do jogo continua pendente da correção do Service Worker. Em caso de indisponibilidade do servidor o scanner bloqueia o carregamento para evitar confusão de dados.

## Verificações realizadas em 30/10/2026
- Conexão Supabase ChaoticGO `avmpfnveotjzoqkrygfn`: saudável.
- `public.chaotic_player_state` criada, RLS ligada, 3 políticas de acesso por proprietário.
- Sem permissão SELECT para `anon` e com permissão para `authenticated` sujeita a RLS.
- Security Advisor: sem alertas encontrados.
- Verificação estática de sintaxe JS dos arquivos principais: OK.
- **Ainda não testado:** criação de usuário real, confirmação por e-mail, login efetivo, persistência e restauração entre navegadores e funcionamento no celular.
