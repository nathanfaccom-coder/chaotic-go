// Convites privados do DROME — sem iniciar batalhas nem transferir cartas.
(function () {
  "use strict";
  const api = window.ChaoticAuth?.getClient();
  const userId = window.ChaoticAuthUser?.id;
  if (!api || !userId) return;
  let room = null, poll = null, busy = false;
  const $ = id => document.getElementById(id);
  function halt() { if (poll !== null) { clearInterval(poll); poll = null; } }
  function note(message, error = false) {
    const label = $("lobby-notice");
    if (label) {
      label.textContent = message;
      label.style.color = error ? "#ff8888" : "#c2ecc5";
    }
  }
  async function rpc(method, args) {
    const { data, error } = await api.rpc(method, args);
    if (error) throw new Error(error.message);
    return data;
  }
  async function action(fn) {
    if (busy) return;
    busy = true;
    const buttons = [...document.querySelectorAll("#tela-entrada-drome button")];
    buttons.forEach(btn => { btn.disabled = true; });
    try { await fn(); }
    catch (error) { note(error.message || "Falha ao conectar com a sala.", true); }
    finally { busy = false; buttons.forEach(btn => { if (btn.isConnected) btn.disabled = false; }); }
  }
  function updateRoomUI() {
    if (!$("lobby-create")) return;
    const panel = $("lobby-current"), creation = $("lobby-create"), join = $("lobby-join");
    panel.hidden = !room; creation.hidden = !!room; join.hidden = !!room;
    if (!room) return;
    $("lobby-room-code").textContent = room.code;
    $("lobby-mode").textContent = room.mode;
    $("lobby-status").textContent = room.status === "ready"
      ? "✅ Dois jogadores conectados. Batalha ainda em desenvolvimento."
      : room.status === "cancelled" ? "Sala encerrada."
      : new Date(room.expires_at).getTime() <= Date.now() ? "Sala expirada. Crie outra."
      : "Aguardando outro jogador entrar com o código...";
    $("lobby-close").textContent = room.host_id === userId ? "Encerrar sala" : "Sair da sala";
    if (room.status === "cancelled" || new Date(room.expires_at).getTime() <= Date.now()) halt();
  }
  async function refreshRoom() {
    if (!room || !$("lobby-current")) { halt(); return; }
    const { data, error } = await api.from("chaotic_lobbies")
      .select("id,code,host_id,guest_id,mode,status,expires_at")
      .eq("id", room.id).maybeSingle();
    if (error) { note("Falha ao atualizar sala: " + error.message, true); return; }
    if (!data) { room = null; halt(); updateRoomUI(); note("Sala não encontrada."); return; }
    room = data; updateRoomUI();
  }
  function watch() {
    halt();
    poll = setInterval(() => {
      if (!$("lobby-current") || $("tela-entrada-drome")?.style.display !== "flex") { halt(); return; }
      refreshRoom().catch(error => note(error.message, true));
    }, 6000);
  }
  function show() {
    halt(); room = null;
    const screen = $("tela-entrada-drome");
    if (!screen) return;
    $("tela-menu").style.display = "none";
    screen.style.display = "flex";
    window.modoMenu = false;
    screen.innerHTML = [
      '<div class="lobby-test">',
      '<h3>🔐 SALA PRIVADA</h3>',
      '<p>Convite por código — teste de conexão. Nenhuma batalha ou troca acontece aqui.</p>',
      '<div id="lobby-create">',
      '<label for="lobby-select-mode">Modo da sala</label>',
      '<select id="lobby-select-mode"><option value="1x1">1x1 Duelo</option>',
      '<option value="3x3">3x3 Rápido</option><option value="6x6">6x6 Principal</option></select>',
      '<button id="lobby-create-btn" type="button">Criar sala</button></div>',
      '<div id="lobby-join"><label for="lobby-input-code">Código recebido de outro jogador</label>',
      '<input id="lobby-input-code" type="text" maxlength="12" autocomplete="off"',
      ' autocapitalize="characters" placeholder="12 caracteres" aria-label="Código de convite">',
      '<button id="lobby-join-btn" type="button">Entrar pelo código</button></div>',
      '<div id="lobby-current" hidden><p>Modo: <strong id="lobby-mode"></strong></p>',
      '<p>Código: <strong id="lobby-room-code"></strong></p>',
      '<p id="lobby-status" role="status"></p>',
      '<button id="lobby-copy" type="button">Copiar convite</button>',
      '<button id="lobby-refresh" type="button">Atualizar status</button>',
      '<button id="lobby-close" class="lobby-danger" type="button">Encerrar sala</button></div>',
      '<p id="lobby-notice" role="status" aria-live="polite"></p>',
      '<button id="lobby-back" class="lobby-outline" type="button">Voltar ao DROME</button>',
      '</div>'
    ].join("");
    $("lobby-create-btn").onclick = () => action(async () => {
      note("Criando sala...");
      const mode = $("lobby-select-mode").value;
      if (!["1x1","3x3","6x6"].includes(mode)) throw new Error("Modo inválido");
      room = await rpc("chaotic_create_lobby", { p_mode: mode });
      updateRoomUI(); watch(); note("Sala criada. Compartilhe o código com outro jogador.");
    });
    $("lobby-join-btn").onclick = () => action(async () => {
      const code = $("lobby-input-code").value.trim().toUpperCase();
      if (!/^[A-F0-9]{12}$/.test(code)) throw new Error("Digite um código de 12 caracteres válido.");
      note("Entrando na sala...");
      room = await rpc("chaotic_join_lobby", { p_code: code });
      updateRoomUI(); watch(); note("Você entrou na sala. O anfitrião será avisado.");
    });
    $("lobby-copy").onclick = () => action(async () => {
      if (!room) return;
      const invite = "Convite Chaotic GO (" + room.mode + "): " + room.code
        + " — Entre em DROME > Sala privada e informe este código.";
      if (!navigator.clipboard?.writeText) throw new Error("Cópia indisponível neste navegador.");
      await navigator.clipboard.writeText(invite);
      note("Convite copiado!");
    });
    $("lobby-refresh").onclick = () => action(refreshRoom);
    $("lobby-close").onclick = () => action(async () => {
      if (!room) return;
      const method = room.host_id === userId ? "chaotic_close_lobby" : "chaotic_leave_lobby";
      const success = await rpc(method, { p_id: room.id });
      if (!success) throw new Error("A sala já pode ter sido encerrada. Atualize.");
      halt(); room = null; updateRoomUI(); note("Você saiu da sala.");
    });
    $("lobby-back").onclick = () => {
      halt();
      if (room && room.status !== "cancelled") {
        note("Use Encerrar/Sair da sala antes de voltar.", true);
        return;
      }
      if (typeof window.abrirEntradaDrome === "function") window.abrirEntradaDrome();
    };
    note("Salas privadas expiram após duas horas.");
  }
  window.abrirSalaPrivadaDrome = show;
})();