// Supabase adapter para os caminhos privados do Chaotic GO.
// A API se parece com a leitura do Firebase, mas NÃO permite acessar ou editar
// inventários de outras contas. Multiplayer exige backend transacional próprio.
const client = window.ChaoticAuth.getClient();
const user = window.ChaoticAuthUser;
if (!user || !user.id) throw new Error("Sessão autenticada obrigatória.");
const ownerId = user.id;
const watchers = new Map();
const queues = new Map();
const revisions = new Map();
let realtimeChannel = null;
let deckReloadSequence = 0;
let fallbackPollTimer = null;
let fallbackPollInFlight = false;
async function pollWatchedNodes() {
  if (fallbackPollInFlight || !watchers.size) return;
  fallbackPollInFlight = true;
  try {
    for (const node of [...watchers.keys()]) {
      if (!watchers.has(node)) continue;
      const revision = revisions.get(node) || 0;
      try {
        const result = await get(ref(db,"jogadores/"+ownerId+"/"+node));
        // Never replace an update received while the network request was pending.
        if (watchers.has(node) && (revisions.get(node)||0) === revision) {
          const value = result.val();
          const serialized = JSON.stringify(value);
          if (lastPolledValues.get(node) !== serialized) {
            lastPolledValues.set(node, serialized);
            notify(node, value);
          }
        }
      } catch (error) { report(error); }
    }
  } finally { fallbackPollInFlight = false; }
}
const lastPolledValues = new Map();
function setFallbackPolling(enabled) {
  if (!enabled || !watchers.size) {
    if (fallbackPollTimer !== null) clearInterval(fallbackPollTimer);
    fallbackPollTimer = null;
    if (!enabled) lastPolledValues.clear();
    return;
  }
  if (fallbackPollTimer !== null) return;
  pollWatchedNodes();
  fallbackPollTimer = setInterval(pollWatchedNodes, 20000);
}
function reloadDeckCollection() {
  if (!watchers.has("decks")) return;
  const sequence = ++deckReloadSequence;
  get(ref(db,"jogadores/"+ownerId+"/decks"))
    .then(s => {
      if (sequence === deckReloadSequence && watchers.has("decks")) notify("decks",s.val());
    }).catch(error => { if (sequence === deckReloadSequence) report(error); });
}
function handleCloudChange(payload) {
  const row = payload?.new?.node_path ? payload.new : payload?.old;
  if (!row || row.user_id !== ownerId || !row.node_path) return;
  const key = row.node_path;
  // Eventos DELETE carregam apenas a chave primária com REPLICA IDENTITY DEFAULT.
  const value = payload.eventType === "DELETE" ? null : payload.new?.data ?? null;
  if (watchers.has(key)) notify(key,value);
  if (key.startsWith("decks/")) reloadDeckCollection();
}
function ensureRealtime() {
  if (realtimeChannel || typeof client.channel !== "function") return;
  realtimeChannel = client.channel("chaotic-player-nodes-"+ownerId)
    .on("postgres_changes",{
      event:"*",schema:"public",table:"chaotic_game_nodes",
      filter:"user_id=eq."+ownerId
    },handleCloudChange)
    .subscribe(status=>{
      if (status==="CHANNEL_ERROR" || status==="TIMED_OUT" || status==="CLOSED") {
        console.warn("Chaotic GO: Realtime indisponível; ativando sincronização por consultas.");
        setFallbackPolling(true);
      } else if (status==="SUBSCRIBED") {
        setFallbackPolling(false);
      }
    });
}

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
  revisions.set(node,(revisions.get(node)||0)+1);
  lastPolledValues.set(node, JSON.stringify(value));
  for (const cb of watchers.get(node) || []) {
    try { cb(snapshot(value)); } catch (error) { console.error(error); }
  }
}
function report(error) {
  window.dispatchEvent(new CustomEvent("chaotic-cloud-error", { detail: error?.message || String(error) }));
}
export async function get(reference) {
  const node = keyOf(reference);
  // O editor salva "decks/6x6_1", "decks/1x1_2" etc. separadamente.
  // A seleção do DROME consulta "decks" e espera um objeto indexado por slot.
  if (node === "decks") {
    const { data, error } = await client.from("chaotic_game_nodes")
      .select("node_path,data").eq("user_id", ownerId).like("node_path", "decks/%");
    if (error) { report(error); throw error; }
    const decks = Object.create(null);
    for (const row of data || []) {
      const slot = row.node_path.slice("decks/".length);
      if (/^(?:6x6|3x3|1x1)_(?:slot_)?[123]$/.test(slot)) decks[slot] = row.data;
    }
    return snapshot(Object.keys(decks).length ? decks : null);
  }
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
      // UPDATE não inclui user_id/node_path: as colunas de identidade são imutáveis
      // para authenticated. INSERT só é usado quando o nó ainda não existe.
      const serialized = JSON.parse(JSON.stringify(value));
      result = await client.from("chaotic_game_nodes")
        .update({data:serialized,updated_at:new Date().toISOString()})
        .eq("user_id",ownerId).eq("node_path",node).select("node_path");
      if (!result.error && !(result.data || []).length) {
        result = await client.from("chaotic_game_nodes").insert({
          user_id:ownerId,node_path:node,data:serialized,updated_at:new Date().toISOString()
        });
        // Duas sessões podem criar o mesmo nó simultaneamente: nesse caso,
        // a identidade permanece intacta e apenas o conteúdo é atualizado.
        if (result.error?.code === "23505") {
          result = await client.from("chaotic_game_nodes")
            .update({data:serialized,updated_at:new Date().toISOString()})
            .eq("user_id",ownerId).eq("node_path",node);
        }
      }
    }
    if (result.error) { report(result.error); throw result.error; }
    notify(node, value);
    // Atualiza a lista agregada imediatamente após salvar/remover um slot.
    // Realtime pode estar desativado ou atrasado; não depender dele para a UI local.
    if (node.startsWith("decks/")) reloadDeckCollection();
  });
}
export function remove(reference) { return set(reference,null); }
export function update(reference, patch) {
  const node = keyOf(reference);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return Promise.reject(new Error("Atualização inválida."));
  }
  return serialize(node, async () => {
    // Patch atômico no PostgreSQL: evita perder alterações de outra aba/dispositivo.
    // A função é SECURITY INVOKER e usa auth.uid() com RLS do proprietário.
    const {data, error} = await client.rpc("chaotic_patch_own_node", {
      p_node_path: node,
      p_patch: patch
    });
    if(error) { report(error); throw error; }
    notify(node, data);
    if (node.startsWith("decks/")) reloadDeckCollection();
  });
}
function releaseRealtimeIfUnused() {
  if (watchers.size) return;
  setFallbackPolling(false);
  if (!realtimeChannel) return;
  const channel = realtimeChannel;
  realtimeChannel = null;
  if (typeof client.removeChannel === "function") client.removeChannel(channel);
  else if (typeof channel.unsubscribe === "function") channel.unsubscribe();
}
export function onValue(reference, callback) {
  let node;
  try { node=keyOf(reference); } catch (error) { report(error); return () => {}; }
  let listeners = watchers.get(node);
  if (!listeners) { listeners=new Set(); watchers.set(node,listeners); }
  listeners.add(callback);
  ensureRealtime();
  // Evita que uma consulta inicial lenta sobrescreva uma atualização mais recente.
  const atStart=revisions.get(node)||0;
  get(reference).then(s => {
    if(listeners.has(callback) && (revisions.get(node)||0)===atStart) callback(s);
  }).catch(report);
  return () => {
    listeners.delete(callback);
    if(!listeners.size) { watchers.delete(node); lastPolledValues.delete(node); }
    releaseRealtimeIfUnused();
  };
}
export function installDbCompat() {
  window._dbGet = path => get(ref(db,path));
  window._dbSet = (path,value) => set(ref(db,path),value);
  window._dbUpdate = (path,value) => update(ref(db,path),value);
  window._dbRemove = path => remove(ref(db,path));
  window._dbOn = (path,cb) => onValue(ref(db,path),cb);
  window._dbOff = path => {
    try { const key=keyOf(path); watchers.delete(key); releaseRealtimeIfUnused(); }
    catch (_error) { /* caminhos multiplayer legados não têm assinatura ativa */ }
  };
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


// Durable Drome reconnect API. The caller must render/process events before ACK.
// Never infer a victory or award XP/currency from this read-only history.
function assertDromeLobbyId(lobbyId) {
  if (typeof lobbyId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lobbyId)) {
    throw new TypeError("Identificador de partida inválido.");
  }
  return lobbyId;
}
export async function resumeDromeMatch(lobbyId, limit = 100) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("Limite inválido (1 a 100).");
  const { data, error } = await client.rpc("chaotic_resume_match", {
    p_lobby_id: lobbyId, p_limit: limit
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || !Array.isArray(data.events)) {
    throw new Error("Resposta de reconexão inválida.");
  }
  return data;
}
export async function acknowledgeDromeEvents(lobbyId, lastSeq) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isSafeInteger(lastSeq) || lastSeq < 0) throw new RangeError("Sequência inválida.");
  const { data, error } = await client.rpc("chaotic_ack_match_events", {
    p_lobby_id: lobbyId, p_last_seq: lastSeq
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || !Number.isSafeInteger(data.last_seq)) {
    throw new Error("Confirmação de leitura inválida.");
  }
  return data.last_seq;
}
// Invokes onEvents before acknowledging. If rendering fails, the cursor is
// deliberately NOT advanced, so the same events can be retried on reconnect.
// Serialize consumption per lobby so concurrent reconnects cannot render the same
// unread batch twice or acknowledge an event before an earlier render completes.
const dromeConsumptionQueues = new Map();
export function consumeDromeEvents(lobbyId, onEvents, limit = 100) {
  assertDromeLobbyId(lobbyId);
  if (typeof onEvents !== "function") return Promise.reject(new TypeError("Processador de eventos obrigatório."));
  const previous = dromeConsumptionQueues.get(lobbyId) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const state = await resumeDromeMatch(lobbyId, limit);
    const events = state.events;
    // A missing sequence must not be ACKed: doing so could permanently skip
    // an attack, knockout or turn transition on the reconnecting device.
    const savedCursor = state.saved_cursor ?? null;
    let last = null;
    for (const event of events) {
      const seq = event?.seq;
      if (!Number.isSafeInteger(seq) || seq < 1 || (last !== null && seq !== last + 1)) {
        throw new Error("Histórico de eventos com lacuna ou fora de ordem.");
      }
      if (typeof event.event_type !== "string" || !event.event_type.trim()) {
        throw new Error("Evento de combate sem tipo válido.");
      }
      last = seq;
    }
    // Do not assume the cursor is present in older RPC responses.
    if (savedCursor !== null && events.length &&
        (!Number.isSafeInteger(savedCursor) || events[0].seq !== savedCursor + 1)) {
      throw new Error("Histórico de eventos não continua o cursor salvo.");
    }
    if (last !== null && last !== state.next_after_seq) {
      throw new Error("Sequência de eventos inconsistente.");
    }
    // A render failure must leave the cursor untouched for a later retry.
    await onEvents(events, state);
    if (last !== null) await acknowledgeDromeEvents(lobbyId, last);
    return { ...state, consumed: events.length };
  });
  dromeConsumptionQueues.set(lobbyId, task);
  task.finally(() => {
    if (dromeConsumptionQueues.get(lobbyId) === task) dromeConsumptionQueues.delete(lobbyId);
  }).catch(() => {});
  return task;
}


// Drain a bounded backlog after reconnect. Each page is acknowledged only after
// the consumer completes, and subsequent pages are fetched using the saved cursor.
// No local combat result or economy mutation is inferred from the event feed.
// Keep full backlog drains serialized per lobby. Without this lock, two callers
// can interleave pages and acknowledge a cursor before another UI has rendered.
const dromeBacklogQueues = new Map();
export function consumeDromeBacklog(lobbyId, onEvents, options = {}) {
  assertDromeLobbyId(lobbyId);
  if (typeof onEvents !== "function") return Promise.reject(new TypeError("Processador de eventos obrigatório."));
  const { pageSize = 100, maxPages = 20 } = options;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return Promise.reject(new RangeError("Tamanho de página inválido."));
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) return Promise.reject(new RangeError("Número máximo de páginas inválido."));
  const previous = dromeBacklogQueues.get(lobbyId) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    let total = 0;
    let previousCursor = -1;
    for (let page = 0; page < maxPages; page++) {
      const state = await consumeDromeEvents(lobbyId, onEvents, pageSize);
      total += state.consumed;
      const cursor = state.next_after_seq;
      if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error("Cursor de reconexão inválido.");
      if (state.consumed > 0 && cursor <= previousCursor) throw new Error("Reconexão sem progresso; interrompida para evitar repetição.");
      previousCursor = cursor;
      if (!state.has_more || state.consumed === 0) {
        if (state.has_more && state.consumed === 0) throw new Error("Servidor indicou mais eventos sem retornar dados.");
        return { lobby_id: lobbyId, consumed: total, pages: page + 1, has_more: false };
      }
    }
    return { lobby_id: lobbyId, consumed: total, pages: maxPages, has_more: true };
  });
  dromeBacklogQueues.set(lobbyId, task);
  task.finally(() => {
    if (dromeBacklogQueues.get(lobbyId) === task) dromeBacklogQueues.delete(lobbyId);
  }).catch(() => {});
  return task;
}

// Live Drome feed: safely consume server-authored events while a match screen is open.
// Returns an unsubscribe function. Polls are serialized, and errors never ACK events.
export function watchDromeMatch(lobbyId, onEvents, options = {}) {
  assertDromeLobbyId(lobbyId);
  if (typeof onEvents !== "function") throw new TypeError("Processador de eventos obrigatório.");
  const { intervalMs = 3000, pageSize = 100, maxPages = 20, onError = report, onState = null } = options;
  if (!Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60000) throw new RangeError("Intervalo inválido.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new RangeError("Tamanho de página inválido.");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new RangeError("Número máximo de páginas inválido.");
  if (typeof onError !== "function") throw new TypeError("Tratador de erro inválido.");
  if (onState !== null && typeof onState !== "function") throw new TypeError("Tratador de estado inválido.");
  let stopped = false;
  let busy = false;
  let timer = null;
  const poll = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      // Drains are bounded; the next tick resumes any remaining backlog.
      await consumeDromeBacklog(lobbyId, async (events, state) => {
        if (stopped) throw new Error("Observação da partida encerrada.");
        // The screen needs current turn/status even when no new combat events exist.
        // Process the snapshot before acknowledging any events, so a failed UI update
        // is retried on the next poll rather than silently skipped.
        if (onState) await onState(state);
        if (stopped) throw new Error("Observação da partida encerrada.");
        if (events.length) await onEvents(events, state);
        // An asynchronous renderer can finish after the screen has unmounted.
        // Do not acknowledge those events: a reopened screen must be able to
        // reconstruct them instead of inheriting a cursor from a closed view.
        if (stopped) throw new Error("Observação da partida encerrada durante o processamento.");
      }, { pageSize, maxPages });
    } catch (error) {
      if (!stopped) {
        try { onError(error); } catch (handlerError) { console.error(handlerError); }
      }
    } finally { busy = false; }
  };
  // Begin immediately; keep a single in-flight request per watcher.
  void poll();
  timer = setInterval(() => { void poll(); }, intervalMs);
  return () => {
    stopped = true;
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
}


// Official match outcome and rewards are READ ONLY. Never derive a win or grant
// currency from the local combat screen, replayed events, or a client assertion.
// RLS restricts the result to its participants and ledger entries to their owner.
export async function getOfficialDromeResult(matchId) {
  assertDromeLobbyId(matchId);
  const { data, error } = await client.from("chaotic_official_match_results")
    .select("id,host_id,guest_id,mode,winner_id,result_state,verification_source,verified_at")
    .eq("id", matchId).maybeSingle();
  if (error) { report(error); throw error; }
  if (!data) return null;
  if (data.host_id !== ownerId && data.guest_id !== ownerId) {
    throw new Error("Resultado não pertence à sessão.");
  }
  // An unverified result is never presented as an official victory.
  if (data.result_state !== "verified" || data.verification_source !== "official_engine_v1" ||
      !data.verified_at || !data.winner_id ||
      (data.winner_id !== data.host_id && data.winner_id !== data.guest_id)) return {
    match_id: matchId, verified: false, mode: data.mode, result_state: data.result_state
  };
  return {
    match_id: matchId, verified: true, mode: data.mode,
    result_state: data.result_state, winner_id: data.winner_id,
    verification_source: data.verification_source, verified_at: data.verified_at
  };
}

export async function getMyOfficialDromeRewards(matchId) {
  assertDromeLobbyId(matchId);
  // Checking the authenticated result first prevents treating arbitrary local
  // match identifiers as a source of earned XP or currency.
  const result = await getOfficialDromeResult(matchId);
  if (!result || !result.verified) return [];
  const { data, error } = await client.from("chaotic_official_reward_ledger")
    .select("id,source_match_id,award_kind,xp_awarded,coins_awarded,reward_scope,awarded_at")
    .eq("source_match_id", matchId).eq("player_id", ownerId);
  if (error) { report(error); throw error; }
  return (data || []).map(entry => ({
    ...entry, xp_awarded: entry.xp_awarded ?? 0,
    coins_awarded: entry.coins_awarded ?? 0
  }));
}


// Server-validated Drome training actions. This RPC records a declaration only;
// it does NOT resolve official combat, verify victories, or award rewards.
// The server checks auth.uid(), turn ownership and the saved deck card slot.
export async function declareDromeTrainingAction(lobbyId, expectedTurn, kind, deckSlot, cardSlot) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120) {
    throw new RangeError("Turno de treinamento inválido.");
  }
  if (kind !== "creature" && kind !== "attack") {
    throw new TypeError("Tipo de ação de treinamento inválido.");
  }
  if (!Number.isInteger(deckSlot) || deckSlot < 1 || deckSlot > 3 ||
      !Number.isInteger(cardSlot) || cardSlot < 1 || cardSlot > 20) {
    throw new RangeError("Posição de carta ou deck inválida.");
  }
  const { data, error } = await client.rpc("chaotic_declare_combat_action", {
    p_lobby_id: lobbyId, p_expected_turn: expectedTurn, p_kind: kind,
    p_deck_slot: deckSlot, p_card_slot: cardSlot
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || data.actor_id !== ownerId ||
      data.turn_no !== expectedTurn || data.kind !== kind ||
      data.deck_slot !== deckSlot || data.card_slot !== cardSlot) {
    throw new Error("Declaração de treinamento inconsistente com o servidor.");
  }
  return data;
}

// Read the authoritative training timeline, never a locally inferred outcome.
export async function getDromeTrainingTimeline(lobbyId) {
  assertDromeLobbyId(lobbyId);
  const { data, error } = await client.rpc("chaotic_get_combat_timeline", {
    p_lobby_id: lobbyId
  });
  if (error) { report(error); throw error; }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Linha do tempo de treinamento inválida.");
  }
  return data;
}


// Advance a training turn only through the authenticated server transition.
// The RPC checks current player, expected turn, lobby status and unresolved
// 1x1 Burst / 3x3 combat obligations. This does not verify a victory or award XP.
export async function passDromeTrainingTurn(lobbyId, expectedTurn) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120) {
    throw new RangeError("Turno de treinamento inválido.");
  }
  const { data, error } = await client.rpc("chaotic_pass_turn", {
    p_lobby_id: lobbyId, p_expected_turn: expectedTurn
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId ||
      data.last_player !== ownerId ||
      data.turn_no !== expectedTurn + 1 ||
      (data.current_player !== data.host_id && data.current_player !== data.guest_id) ||
      data.current_player === ownerId ||
      (data.status !== "active" && data.status !== "finished")) {
    throw new Error("Transição de turno inconsistente com o servidor.");
  }
  return {
    lobby_id: data.lobby_id,
    turn_no: data.turn_no,
    current_player: data.current_player,
    status: data.status,
    last_player: data.last_player
  };
}


// Prepare a catalog-validated 3x3 training attack on the server.
// This writes a preview projection only: no official HP, victory or reward changes.
// The RPC verifies the attack instance in the authenticated player's saved Deck
// and album, validates catalog base damage/cost and locks the current turn.
export async function prepareDrome3x3TrainingAttack(lobbyId, expectedTurn, attackCardSlot) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120) {
    throw new RangeError("Turno 3x3 inválido.");
  }
  if (!Number.isInteger(attackCardSlot) || attackCardSlot < 1 || attackCardSlot > 20) {
    throw new RangeError("Slot de ataque 3x3 inválido.");
  }
  const { data, error } = await client.rpc("chaotic_prepare_preview_3x3_base_attack", {
    p_lobby_id: lobbyId,
    p_expected_turn: expectedTurn,
    p_attack_card_slot: attackCardSlot
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || data.actor_id !== ownerId ||
      data.turn_no !== expectedTurn || data.attack_card_slot !== attackCardSlot ||
      !Number.isInteger(data.base_damage) || data.base_damage < 0 ||
      !Number.isInteger(data.projected_hp_loss) || data.projected_hp_loss < 0 ||
      data.projected_hp_loss > data.base_damage ||
      data.official_match_modified !== undefined && data.official_match_modified !== false) {
    throw new Error("Projeção 3x3 inconsistente com o servidor.");
  }
  return {
    lobby_id: data.lobby_id,
    turn_no: data.turn_no,
    attacker_id: data.actor_id,
    attack_card_slot: data.attack_card_slot,
    catalog_attack_id: data.catalog_attack_id,
    attack_name: data.attack_name,
    base_damage: data.base_damage,
    attack_cost: data.attack_cost,
    defender_slot: data.defender_slot,
    defender_hp_before: data.defender_hp_before,
    defender_hp_projected: data.defender_hp_projected,
    projected_hp_loss: data.projected_hp_loss,
    hypothetical_knockout: data.hypothetical_knockout === true,
    training_only: true
  };
}


// Apply catalog attacks 111/112 in the authenticated 3x3 TRAINING HP ledger.
// Unlike a projection, this RPC atomically debits training HP and records a
// turn-scoped damage event plus attack-lock effect. It rejects replays, unpaid
// attacks, unresolved defense, mismatched cards and invalid turn ownership.
// It does NOT mutate official match HP, verify wins or award XP/coins.
export async function applyDrome3x3TrainingAttackLock(lobbyId, expectedTurn) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120) {
    throw new RangeError("Turno 3x3 inválido.");
  }
  const { data, error } = await client.rpc("chaotic_apply_preview_3x3_training_attack_lock", {
    p_lobby_id: lobbyId,
    p_expected_turn: expectedTurn
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || data.turn_no !== expectedTurn ||
      data.attacker_id !== ownerId || !["111", "112"].includes(String(data.catalog_attack_id)) ||
      !Number.isInteger(data.hp_before) || data.hp_before < 1 ||
      !Number.isInteger(data.hp_after) || data.hp_after < 0 ||
      !Number.isInteger(data.damage_dealt) || data.damage_dealt < 0 ||
      data.hp_before - data.hp_after !== data.damage_dealt ||
      data.effects_fully_resolved !== true) {
    throw new Error("Aplicação de dano de treino inconsistente com o servidor.");
  }
  return {
    lobby_id: data.lobby_id,
    turn_no: data.turn_no,
    attacker_id: data.attacker_id,
    defender_id: data.defender_id,
    attacker_slot: data.attacker_slot,
    defender_slot: data.defender_slot,
    catalog_attack_id: data.catalog_attack_id,
    hp_before: data.hp_before,
    hp_after: data.hp_after,
    damage_dealt: data.damage_dealt,
    attack_lock_applied: true,
    training_only: true
  };
}


// Authenticated, fog-of-war-safe 3x3 training board. The server redacts
// hidden opponent cards and HP; do not replace this with direct table reads.
export async function getDrome3x3SafeBoard(lobbyId) {
  assertDromeLobbyId(lobbyId);
  const { data, error } = await client.rpc("chaotic_get_preview_3x3_safe_state", {
    p_lobby_id: lobbyId
  });
  if (error) { report(error); throw error; }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      !["allies", "hp_wallets", "board_positions", "move_events", "token_transfers"]
        .every(key => Array.isArray(data[key]))) {
    throw new Error("Estado seguro do tabuleiro 3x3 inválido.");
  }
  return data;
}

// Move a living 3x3 training creature through a server-authorized transition.
// The RPC checks current player/turn, adjacent hexes, ally occupancy, and
// at most one move per turn. No official match or reward is modified.
export async function moveDrome3x3TrainingUnit(lobbyId, expectedTurn, formationSlot, targetHex) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120)
    throw new RangeError("Turno 3x3 inválido.");
  if (!Number.isInteger(formationSlot) || formationSlot < 4 || formationSlot > 6)
    throw new RangeError("Posição da criatura 3x3 inválida.");
  if (!Number.isInteger(targetHex) || targetHex < 1 || targetHex > 6)
    throw new RangeError("Hexágono de destino inválido.");
  const { data, error } = await client.rpc("chaotic_move_preview_3x3_unit", {
    p_lobby_id: lobbyId,
    p_expected_turn: expectedTurn,
    p_formation_slot: formationSlot,
    p_target_hex: targetHex
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || data.actor_id !== ownerId ||
      data.turn_no !== expectedTurn || data.formation_slot !== formationSlot ||
      data.to_hex !== targetHex || !Number.isInteger(data.from_hex) ||
      data.from_hex < 1 || data.from_hex > 6 || data.from_hex === targetHex) {
    throw new Error("Movimento 3x3 inconsistente com o servidor.");
  }
  return data;
}


// Open a bilateral 3x3 training contact using the authenticated server state.
// The RPC locks the current turn, checks both original boards, adjacent contact
// hexes (4/5), living creatures and duplicate confrontations. This creates a
// training intent only; it does not resolve official damage or rewards.
export async function openDrome3x3TrainingContact(lobbyId, expectedTurn, attackerSlot, defenderSlot) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120)
    throw new RangeError("Turno 3x3 inválido.");
  if (![4, 5, 6].includes(attackerSlot) || ![4, 5, 6].includes(defenderSlot))
    throw new RangeError("Posição de contato 3x3 inválida.");
  const { data, error } = await client.rpc("chaotic_open_preview_3x3_contact", {
    p_lobby_id: lobbyId,
    p_expected_turn: expectedTurn,
    p_attacker_slot: attackerSlot,
    p_defender_slot: defenderSlot
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || data.turn_no !== expectedTurn ||
      data.attacker_id !== ownerId || data.defender_id === ownerId ||
      !data.defender_id || data.attacker_slot !== attackerSlot ||
      data.defender_slot !== defenderSlot ||
      ![4, 5].includes(data.attacker_hex) || ![4, 5].includes(data.defender_hex) ||
      !Number.isInteger(data.attacker_hp_at_contact) || data.attacker_hp_at_contact <= 0 ||
      !Number.isInteger(data.defender_hp_at_contact) || data.defender_hp_at_contact <= 0) {
    throw new Error("Contato 3x3 inconsistente com o servidor.");
  }
  return { ...data, training_only: true };
}


// Open a paid 3x3 training attack's defender reaction window on the server.
// Only the attacking player can open it, after contact, projection and payment.
// This does not apply official damage or grant rewards.
export async function openDrome3x3TrainingDefenseWindow(lobbyId, expectedTurn) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120)
    throw new RangeError("Turno de reação 3x3 inválido.");
  const { data, error } = await client.rpc("chaotic_open_preview_3x3_defense_window", {
    p_lobby_id: lobbyId, p_expected_turn: expectedTurn
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || data.turn_no !== expectedTurn ||
      data.attacker_id !== ownerId || !data.defender_id ||
      data.defender_id === ownerId || data.status !== "awaiting_defender" ||
      ![4, 5, 6].includes(data.attacker_slot) ||
      ![4, 5, 6].includes(data.defender_slot)) {
    throw new Error("Janela de defesa 3x3 inconsistente com o servidor.");
  }
  return { ...data, training_only: true };
}

// Defender explicitly declines a 3x3 training reaction. The server enforces
// that only the opposing player may pass once on an awaiting window.
export async function passDrome3x3TrainingDefense(lobbyId, expectedTurn) {
  assertDromeLobbyId(lobbyId);
  if (!Number.isInteger(expectedTurn) || expectedTurn < 1 || expectedTurn > 120)
    throw new RangeError("Turno de reação 3x3 inválido.");
  const { data, error } = await client.rpc("chaotic_pass_preview_3x3_defense", {
    p_lobby_id: lobbyId, p_expected_turn: expectedTurn
  });
  if (error) { report(error); throw error; }
  if (!data || data.lobby_id !== lobbyId || data.turn_no !== expectedTurn ||
      data.defender_id !== ownerId || !data.attacker_id ||
      data.attacker_id === ownerId || data.status !== "defender_passed_preview" ||
      !data.defender_passed_at) {
    throw new Error("Passagem de defesa 3x3 inconsistente com o servidor.");
  }
  return { ...data, training_only: true };
}
