(function () {
  "use strict";
  var client = null;

  function getClient() {
    var cfg = window.CHAOTIC_SUPABASE_CONFIG || {};
    if (!cfg.url || !cfg.publishableKey) {
      throw new Error("O Supabase do Chaotic GO ainda não foi configurado. Consulte CONFIGURAR-SUPABASE.md.");
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url)) {
      throw new Error("URL do Supabase inválida.");
    }
    if (!/^sb_publishable_/.test(cfg.publishableKey) && !/^eyJ/.test(cfg.publishableKey)) {
      throw new Error("Use somente a chave publishable (ou anon antiga) no navegador.");
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Não foi possível carregar a biblioteca do Supabase. Verifique a conexão.");
    }
    if (!client) {
      client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  async function currentUser() {
    var auth = getClient().auth;
    var sessionResult = await auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    if (!sessionResult.data.session) return null;
    var result = await auth.getUser(); // getUser valida a identidade, diferentemente de confiar apenas no cache.
    if (result.error) throw result.error;
    return result.data.user;
  }

  async function requireUser() {
    var user = await currentUser();
    if (!user) {
      window.location.replace("login-completo.html");
      return null;
    }
    return user;
  }

  window.ChaoticAuth = {
    getClient: getClient,
    currentUser: currentUser,
    requireUser: requireUser
  };
})();
