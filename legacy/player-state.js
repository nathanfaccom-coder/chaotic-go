(function () {
  "use strict";
  var storage = { chaoticAlbum: "[]", chaoticPerfil: "{}", chaoticAmigos: "[]" };
  var userId = null;
  var chain = Promise.resolve();
  var busy = false;
  var errors = [];

  function getItem(key) { return Object.prototype.hasOwnProperty.call(storage,key) ? storage[key] : null; }
  function setItem(key, value) {
    if (!Object.prototype.hasOwnProperty.call(storage,key)) return;
    storage[key] = String(value);
    save();
  }
  function snapshot() {
    return {
      user_id:userId,
      album: JSON.parse(storage.chaoticAlbum),
      profile: JSON.parse(storage.chaoticPerfil),
      friends: JSON.parse(storage.chaoticAmigos),
      updated_at: new Date().toISOString()
    };
  }
  function save() {
    if (!userId) return Promise.resolve();
    var payload;
    try { payload = snapshot(); } catch (e) { console.error("Dados inválidos:",e); return Promise.reject(e); }
    chain = chain.catch(function () {}).then(async function () {
      var response = await window.ChaoticAuth.getClient().from("chaotic_player_state").upsert(payload,{onConflict:"user_id"});
      if(response.error) {
        console.error("Falha ao salvar progresso:", response.error);
        window.dispatchEvent(new CustomEvent("chaotic-save-error",{detail:response.error.message}));
        throw response.error;
      }
    });
    return chain;
  }

  function backupLegacy() {
    var keys = ["chaoticAlbum","chaoticPerfil","chaoticAmigos"];
    var data = {};
    keys.forEach(function(k){data[k]=localStorage.getItem(k);});
    return data;
  }
  async function init() {
    var user = await window.ChaoticAuth.requireUser();
    if(!user) return false;
    userId = user.id;
    var res = await window.ChaoticAuth.getClient().from("chaotic_player_state")
      .select("album,profile,friends").eq("user_id",user.id).maybeSingle();
    if(res.error) throw res.error;
    if(res.data) {
      storage.chaoticAlbum=JSON.stringify(res.data.album || []);
      storage.chaoticPerfil=JSON.stringify(res.data.profile || {});
      storage.chaoticAmigos=JSON.stringify(res.data.friends || []);
    } else {
      storage.chaoticPerfil=JSON.stringify({
        nome: user.user_metadata?.username || user.email?.split("@")[0] || "Jogador",
        avatar:"👤",vitorias:0,derrotas:0
      });
      await save();
    }
    return true;
  }

  async function importLegacy() {
    var backup=backupLegacy();
    if (!backup.chaoticAlbum && !backup.chaoticPerfil && !backup.chaoticAmigos) return false;
    var count = backup.chaoticAlbum ? JSON.parse(backup.chaoticAlbum).length : 0;
    if (!window.confirm("Importar os dados antigos deste navegador para esta conta? Isso substituirá o progresso atual desta conta. Cartas locais: "+count)) return false;
    ["chaoticAlbum","chaoticPerfil","chaoticAmigos"].forEach(function(key) {
      if(backup[key]) storage[key]=backup[key];
    });
    await save();
    return true;
  }
  window.ChaoticState={getItem:getItem,setItem:setItem,init:init,save:save,importLegacy:importLegacy};
})();
