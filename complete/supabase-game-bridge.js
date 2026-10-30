// Supabase adapter para os caminhos privados do Chaotic GO.
// A API se parece com a leitura do Firebase, mas NÃO permite acessar ou editar
// inventários de outras contas. Multiplayer exige backend transacional próprio.
const client = window.ChaoticAuth.getClient();
const user = window.ChaoticAuthUser;
if (!user || !user.id) throw new Error("Sessão autenticada obrigatória.");
const ownerId = user.id;
const watchers = new Map();
const queues = new Map();

function keyOf(input) {
  const path = typeof input === "string" ? input : input?.path;
  if (!path || typeof path !== "string") throw new Error("Caminho inválido.");
  const clean = path.replace(/^\/+|\/+$/g, "");
  const parts = clean.split("/");
  if (parts[0] !== "jogadores" || parts[1] !== ownerId || parts.length < 2) {
    throw new Error("Este recurso online ainda não foi migrado com segurança para o Supabase.");
  }
  const node = parts.length === 2 ? "profile" : parts.slice(2).join("/");
  if (node.length > 150 || !/^[\w./-]+$/.test(node)) throw new Error("Caminho de dados inválido.");
  return node;
}
export const db = {};
export function ref(_database, path) { return { path }; }
const snapshot = value => ({ exists: () => value !== null && value !== undefined, val: () => value ?? null });
function notify(node, value) {
  for (const cb of watchers.get(node) || []) {
    try { cb(snapshot(value)); } catch (error) { console.error(error); }
  }
}
function report(error) {
  window.dispatchEvent(new CustomEvent("chaotic-cloud-error", { detail: error?.message || String(error) }));
}
export async function get(reference) {
  const node = keyOf(reference);
  const {data,error} = await client.from("chaotic_game_nodes").select("data")
    .eq("user_id", ownerId).eq("node_path", node).maybeSingle();
  if (error) { report(error); throw error; }
  return snapshot(data?.data ?? null);
}
function serialize(node, operation) {
  const pending = queues.get(node) || Promise.resolve();
  const next = pending.catch(() => {}).then(operation);
  queues.set(node, next);
  next.finally(() => { if (queues.get(node) === next) queues.delete(node); }).catch(() => {});
  return next;
}
export function set(reference, value) {
  const node = keyOf(reference);
  return serialize(node, async () => {
    let result;
    if (value === null || value === undefined) {
      result = await client.from("chaotic_game_nodes").delete().eq("user_id",ownerId).eq("node_path",node);
    } else {
      result = await client.from("chaotic_game_nodes").upsert({
        user_id:ownerId,node_path:node,data:JSON.parse(JSON.stringify(value)),updated_at:new Date().toISOString()
      }, {onConflict:"user_id,node_path"});
    }
    if (result.error) { report(result.error); throw result.error; }
    notify(node, value);
  });
}
export function remove(reference) { return set(reference,null); }
export function update(reference, patch) {
  const node = keyOf(reference);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return Promise.reject(new Error("Atualização inválida."));
  }
  return serialize(node, async () => {
    const current = await get(reference);
    const merged = {...(current.val() || {}),...patch};
    const {error} = await client.from("chaotic_game_nodes").upsert({
      user_id:ownerId,node_path:node,data:merged,updated_at:new Date().toISOString()
    },{onConflict:"user_id,node_path"});
    if(error) { report(error);throw error; }
    notify(node, merged);
  });
}
export function onValue(reference, callback) {
  let node;
  try { node=keyOf(reference); } catch (error) { report(error); return () => {}; }
  let listeners = watchers.get(node);
  if (!listeners) { listeners=new Set(); watchers.set(node,listeners); }
  listeners.add(callback);
  get(reference).then(s => { if(listeners.has(callback)) callback(s); }).catch(report);
  return () => { listeners.delete(callback);if(!listeners.size)watchers.delete(node); };
}
export function installDbCompat() {
  window._dbGet = path => get(ref(db,path));
  window._dbSet = (path,value) => set(ref(db,path),value);
  window._dbUpdate = (path,value) => update(ref(db,path),value);
  window._dbRemove = path => remove(ref(db,path));
  window._dbOn = (path,cb) => onValue(ref(db,path),cb);
}
// Recupera progresso do teste anterior, sem sobrescrever dados já existentes.
export async function migratePreviousTest() {
  const old = await client.from("chaotic_player_state")
    .select("album,profile,friends").eq("user_id",ownerId).maybeSingle();
  if (old.error) throw old.error;
  const fields = {
    profile:old.data?.profile && Object.keys(old.data.profile).length ? old.data.profile : {
      nome:user.user_metadata?.username || user.email?.split("@")[0] || "Novato(a)",
      avatar:"👤",vitorias:0,derrotas:0
    },
    album:old.data?.album || [],
    amigos:old.data?.friends || []
  };
  for (const [node,value] of Object.entries(fields)) {
    // Álbum vazio não deve anular o brinde inicial de uma conta recém-criada.
    // O módulo original concede a carta inicial quando o nó 'album' não existe.
    if ((node === "album" || node === "amigos") && Array.isArray(value) && value.length === 0) continue;
    const existing = await get(ref(db,"jogadores/"+ownerId+"/"+node));
    if (!existing.exists()) await set(ref(db,"jogadores/"+ownerId+"/"+node),value);
  }
}
