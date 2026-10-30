# Configurar o Supabase do Chaotic GO

Implementação experimental na branch `feature/contas-e-salvamento-supabase`. **Não foi publicada em main.**

1. Crie/indique um projeto Supabase dedicado ao Chaotic GO. Não reutilize acidentalmente o projeto de outro jogo.
2. Execute `supabase/schema-chaotic-go.sql` no SQL Editor desse projeto.
3. Em **Project Settings → API Keys**, copie a chave **publishable**; em **Connect** copie a URL do projeto. Preencha somente `supabase-config.js`. **Nunca use service_role ou sb_secret_ no navegador.**
4. Em **Authentication → Providers**, habilite Email. Configure **URL Configuration** com a URL do site e inclua `login.html` e `redefinir-senha.html` na lista de redirects permitidos.
5. Faça testes com duas contas reais: registre, confirme o e-mail, entre, capture uma carta, recarregue, entre de outro navegador e verifique persistência. Confira que uma conta não consegue ler/escrever os dados da outra.
6. Somente depois mescle a branch na `main` e faça o deploy.

**Dados antigos**: não são apagados do localStorage. O botão de importar aparece apenas quando eles existem, pede confirmação e **substitui o estado atual da conta**. O sistema não importa automaticamente dados de outro navegador.

**Limitações**: a camada de estado é sincronizada com o servidor, porém as regras de captura e progressão ainda rodam no cliente. Para trocas competitivas e multiplayer, é indispensável validar transações e recompensas no backend. O modo offline do jogo continua pendente da correção do Service Worker. Em caso de indisponibilidade do servidor o scanner bloqueia o carregamento para evitar confusão de dados.
