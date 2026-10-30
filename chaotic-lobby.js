// Convites privados do DROME — sem iniciar batalhas nem transferir cartas.
(function () {
  "use strict";
  const api = window.ChaoticAuth?.getClient();
  const userId = window.ChaoticAuthUser?.id;
  if (!api || !userId) return;
  let room = null, poll = null, liveChannel = null, busy = false, match = null, declarations = [], board = [], clashes = [], baseDamage = [], modifiers = [], dice = [], loadouts = [], attackInstances = [], individualDamage = [], equipmentReveals = [], attackWallets = [], handCards = [], initiatives = [], roomLocations = [], effectCandidates = [], hpWallets = [], hpEvents = [], resolutionAudits = [], burstWindows = [], burstOrderPlans = [], burstEquipmentResponses = [], burstEquipmentEffects = [], burstPriority = [], burstPriorityPasses = [], burstMugicIntents = [], burstMugicCounterplans = [], mugicTrainingWallets = [], mugicTrainingSettlements = [], trainingAbilityEvents = [], harpTrainingEvents = [], allies3x3 = [], transfers3x3 = [], hp3x3 = [], board3x3 = [], moves3x3 = [];
  const $ = id => document.getElementById(id);
  function halt() {
    if (poll !== null) { clearInterval(poll); poll = null; }
    if (liveChannel) {
      const channel=liveChannel;
      liveChannel=null;
      if(typeof api.removeChannel === "function") api.removeChannel(channel);
      else if(typeof channel.unsubscribe === "function")channel.unsubscribe();
    }
  }
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
  function updateMatchUI() {
    const panel = $("lobby-turns");
    if (!panel) return;
    panel.hidden = !room || (room.status !== "ready" && !match);
    if (!room || panel.hidden) return;
    const active = match?.status === "active" && room.status === "ready"
      && new Date(room.expires_at).getTime() > Date.now();
    $("lobby-turn-state").textContent = !match
      ? "Dois jogadores conectados. O anfitrião pode começar o teste."
      : match.status === "finished" ? "Teste de turnos encerrado."
      : !active ? "Sala encerrada ou expirada. Nenhuma jogada permitida."
      : (match.current_player === userId
        ? "Sua vez de agir. Turno " + match.turn_no + "."
        : "Aguardando a vez do outro jogador. Turno " + match.turn_no + ".");
    $("lobby-turn-count").textContent = match ? String(match.turn_no) : "—";
    updateBoardUI();
    updateLoadoutUI();
    updateAttackInstanceUI();
    updateClashUI();
    update3x3UI();
    const combatPanel = $("lobby-combat");
    if (combatPanel) {
      combatPanel.hidden = !match;
      const mine = declarations.some(d=>d.actor_id === userId && d.turn_no === match?.turn_no);
      const canAct = active && match.current_player === userId && !mine;
      $("lobby-combat-submit").hidden = !canAct;
      $("lobby-combat-hint").textContent = !active ? "Teste encerrado ou sala indisponível."
        : mine ? "Ação registrada. Passe o turno para continuar."
        : match.current_player !== userId ? "Aguarde seu adversário."
        : "Escolha uma carta do seu deck salvo para registrar uma declaração de teste.";
    }
    // Prévia do tabuleiro: indica o jogador ativo sem modificar o motor DROME.
    const hostTile = $("lobby-board-host"), guestTile = $("lobby-board-guest");
    if (hostTile && guestTile) {
      hostTile.textContent = room.host_id === userId ? "🟩 Você · Anfitrião" : "⬜ Anfitrião";
      guestTile.textContent = room.guest_id === userId ? "🟩 Você · Convidado" : "⬜ Convidado";
      hostTile.style.borderColor = active && match.current_player === room.host_id ? "#86ff9b" : "#315b43";
      guestTile.style.borderColor = active && match.current_player === room.guest_id ? "#86ff9b" : "#315b43";
    }
    $("lobby-turn-start").hidden = !!match || room.host_id !== userId || room.status !== "ready";
    $("lobby-turn-pass").hidden = !active || match.current_player !== userId ||
      (room.mode==="1x1"&&burstWindows.some(x=>x.turn_no===match.turn_no
        &&x.attacker_id===userId&&
        (x.status==="awaiting_defender"||
          !burstPriority.some(p=>p.turn_no===match.turn_no&&p.priority_status==="closed_preview")
          ||!burstOrderPlans.some(p=>p.turn_no===match.turn_no))));
    $("lobby-turn-stop").hidden = !active;
  }
  // Conexões entre lados extraídas de batalha.js/obterAdjacencias.
  // Mesmo mapa para anfitrião e convidado: os pares são simétricos.
  function contactBetweenSides(mode,source,target) {
    const a=Number(source),b=Number(target);
    if(!Number.isInteger(a)||!Number.isInteger(b))return false;
    if(mode==="1x1")return a===6 && b===6;
    if(mode==="3x3")return [4,5].includes(a)&&[4,5].includes(b);
    if(mode==="6x6")return (a===1&&[2,3].includes(b))
      || (a===2&&[1,2,3].includes(b))
      || (a===3&&[1,2].includes(b));
    return false;
  }
  window.chaoticPreviewContact=contactBetweenSides;
  function updateClashUI(){
    const panel=$("lobby-clash-panel");
    if(!panel)return;
    panel.hidden=!room || !match;
    if(panel.hidden)return;
    const mine=board.find(x=>x.actor_id===userId);
    const other=board.find(x=>x.actor_id!==userId);
    const attack=declarations.find(x=>x.actor_id===userId&&x.turn_no===match.turn_no&&x.kind==="attack");
    const already=clashes.some(x=>x.turn_no===match.turn_no);
    const myTurn=match.status==="active"&&room.status==="ready"&&
      match.current_player===userId&&new Date(room.expires_at).getTime()>Date.now();
    const adjacent=!!mine&&!!other&&contactBetweenSides(room.mode,mine.position,other.position);
    $("lobby-clash-open").hidden=!(myTurn&&attack&&adjacent&&!already);
    const clashToCalculate=clashes.find(x=>x.turn_no===match.turn_no && x.attacker_id===userId);
    $("lobby-location-capture").hidden=!(room.mode==="1x1"
      &&myTurn&&clashToCalculate
      &&loadouts.some(x=>x.actor_id===room.host_id)
      &&loadouts.some(x=>x.actor_id===room.guest_id)
      &&roomLocations.length===0&&initiatives.length===0);
    $("lobby-initiative-preview-calculate").hidden=!(room.mode==="1x1"
      &&myTurn&&clashToCalculate
      &&loadouts.some(x=>x.actor_id===clashToCalculate.attacker_id
        &&x.card_instance_id===clashToCalculate.attacker_card)
      &&loadouts.some(x=>x.actor_id===clashToCalculate.defender_id
        &&x.card_instance_id===clashToCalculate.defender_card)
      &&!initiatives.some(x=>x.turn_no===match.turn_no));
    $("lobby-damage-calculate").hidden=room.mode==="1x1" || !(myTurn&&clashToCalculate &&
      !baseDamage.some(x=>x.turn_no===match.turn_no));
    $("lobby-modifiers-calculate").hidden=room.mode==="1x1" || !(myTurn&&clashToCalculate &&
      baseDamage.some(x=>x.turn_no===match.turn_no) &&
      !modifiers.some(x=>x.turn_no===match.turn_no));
    $("lobby-dice-roll").hidden=room.mode==="1x1" || !(myTurn && clashToCalculate &&
      modifiers.some(x=>x.turn_no===match.turn_no && x.formula_status==="roll_or_special_required"
        && x.attack_card_id==="104") &&
      !dice.some(x=>x.turn_no===match.turn_no));
    const attackResolved=attackInstances.some(x=>x.turn_no===match.turn_no
      && x.actor_id===userId && x.attack_instance_id===clashToCalculate?.attack_card);
    const activeBurst=burstWindows.find(x=>x.turn_no===match.turn_no);
    const queuedEquipment=burstEquipmentResponses.find(x=>
      x.turn_no===match.turn_no&&x.resolution_status==="queued_unexecuted");
    const pendingEquipment=!!queuedEquipment;
    const activePlan=burstOrderPlans.find(x=>x.turn_no===match.turn_no);
    const activePriority=burstPriority.find(x=>x.turn_no===match.turn_no);
    const priorityClosed=activePriority?.priority_status==="closed_preview"
      &&activePriority?.consecutive_passes===2;
    const ownMugic=burstMugicIntents.find(x=>x.turn_no===match.turn_no
      &&x.actor_id===userId);
    const ownPendingMugic=ownMugic?.intent_status==="queued_unexecuted";
    const canDeclareMugic=room.mode==="1x1"&&match.status==="active"
      &&room.status==="ready"&&new Date(room.expires_at).getTime()>Date.now()
      &&activePriority?.priority_status==="awaiting_priority"
      &&activePriority.next_actor_id===userId&&!ownMugic;
    $("lobby-burst-mugic-create").hidden=!canDeclareMugic;
    $("lobby-burst-mugic-reject").hidden=!canDeclareMugic;
    $("lobby-burst-mugic-cancel").hidden=!ownPendingMugic;
    const myTrainingWallet=mugicTrainingWallets.find(x=>x.actor_id===userId);
    const settled=mugicTrainingSettlements.some(x=>x.turn_no===match.turn_no);
    const ownUnit=loadouts.find(x=>x.actor_id===userId);
    const ownHarpRevealed=equipmentReveals.some(x=>x.actor_id===userId
      &&x.equipment_name==="Arpa Mágica"
      &&x.equipment_instance_id===ownUnit?.equipment_instance_id);
    const harpAlreadyUsed=harpTrainingEvents.some(x=>x.actor_id===userId);
    $("lobby-harp-token-activate").hidden=!(room.mode==="1x1"&&myTurn
      &&match.status==="active"&&room.status==="ready"
      &&new Date(room.expires_at).getTime()>Date.now()
      &&ownUnit?.equipment_name==="Arpa Mágica"&&ownHarpRevealed
      &&myTrainingWallet&&myTrainingWallet.remaining_tokens<20
      &&!harpAlreadyUsed&&!clashes.some(x=>x.turn_no===match.turn_no)
      &&!burstWindows.some(x=>x.turn_no===match.turn_no)
      &&!individualDamage.some(x=>x.turn_no===match.turn_no));
    const abilitySupported=["Lion","Vidal","Xamã"].includes(ownUnit?.creature_name);
    const targetHasHp=hpWallets.some(x=>x.actor_id===userId&&x.hp_remaining>0);
    const abilityUsed=trainingAbilityEvents.some(x=>x.turn_no===match.turn_no&&x.actor_id===userId);
    $("lobby-ability-heal-activate").hidden=!(
      room.mode==="1x1"&&myTurn&&match.status==="active"
      &&room.status==="ready"&&new Date(room.expires_at).getTime()>Date.now()
      &&abilitySupported&&targetHasHp&&(myTrainingWallet?.remaining_tokens||0)>=1
      &&!abilityUsed&&!clashes.some(x=>x.turn_no===match.turn_no)
      &&!burstWindows.some(x=>x.turn_no===match.turn_no)
      &&!individualDamage.some(x=>x.turn_no===match.turn_no));
    $("lobby-ability-target").disabled=ownUnit?.creature_name==="Lion";
    $("lobby-mugic-token-wallet-prepare").hidden=!(room.mode==="1x1"
      &&match.status==="active"&&loadouts.some(x=>x.actor_id===userId)
      &&!myTrainingWallet);
    $("lobby-mugic-token-settle").hidden=!(room.mode==="1x1"
      &&myTurn&&priorityClosed&&ownPendingMugic
      &&ownMugic.catalog_mugic_id==="301"
      &&burstMugicCounterplans.some(x=>x.turn_no===match.turn_no)
      &&!settled);
    $("lobby-burst-mugic-counterplan").hidden=!(
      myTurn&&priorityClosed&&ownPendingMugic
      &&ownMugic.catalog_mugic_id==="301"
      &&!burstMugicCounterplans.some(x=>x.turn_no===match.turn_no)
      &&!activePlan);
    $("lobby-burst-priority-open").hidden=!(room.mode==="1x1"&&myTurn
      &&activeBurst&&["defender_passed","defender_immunity_noted"].includes(activeBurst.status)
      &&!activePriority&&!activePlan
      &&!individualDamage.some(x=>x.turn_no===match.turn_no));
    $("lobby-burst-priority-pass").hidden=!(room.mode==="1x1"
      &&match.status==="active"&&room.status==="ready"
      &&new Date(room.expires_at).getTime()>Date.now()
      &&activePriority?.priority_status==="awaiting_priority"
      &&activePriority.next_actor_id===userId);
    const resolvedEquipment=burstEquipmentEffects.some(x=>x.turn_no===match.turn_no);
    const defenderHp=hpWallets.find(x=>x.actor_id===queuedEquipment?.defender_id);
    const supportedGear=["anel precioso","bastão da sabedoria","bastao da sabedoria","bomba de fogo"]
      .includes((queuedEquipment?.equipment_name||"").toLocaleLowerCase("pt-BR"));
    $("lobby-burst-equipment-effect-apply").hidden=!(room.mode==="1x1"&&myTurn
      &&activeBurst?.status==="defender_passed"&&queuedEquipment
      &&activePlan?.inspection_steps?.[0]?.stage==="inspect_queued_equipment_reveal"
      &&defenderHp&&supportedGear&&!resolvedEquipment);
    $("lobby-burst-order-prepare").hidden=!(room.mode==="1x1"&&myTurn
      &&activeBurst&&["defender_passed","defender_immunity_noted"].includes(activeBurst.status)
      &&priorityClosed&&!ownPendingMugic
      &&!burstOrderPlans.some(x=>x.turn_no===match.turn_no));
    $("lobby-burst-open").hidden=!(room.mode==="1x1"&&myTurn
      &&clashToCalculate&&attackResolved&&!activeBurst
      &&!individualDamage.some(x=>x.turn_no===match.turn_no));
    $("lobby-burst-pass").hidden=!(room.mode==="1x1"
      &&match.status==="active"&&room.status==="ready"
      &&new Date(room.expires_at).getTime()>Date.now()
      &&activeBurst?.status==="awaiting_defender"
      &&activeBurst.defender_id===userId
      &&activeBurst.attacker_id===match.current_player);
    const defendingUnit=loadouts.find(x=>x.actor_id===userId);
    $("lobby-burst-queue-equipment").hidden=$("lobby-burst-pass").hidden
      ||!defendingUnit?.equipment_instance_id
      ||equipmentReveals.some(x=>x.actor_id===userId)
      ||pendingEquipment;
    const amuletRevealed=!!defendingUnit&&
      defendingUnit.equipment_name==="Amuleto do Vácuo"&&
      equipmentReveals.some(x=>x.actor_id===userId
        &&x.equipment_instance_id===defendingUnit.equipment_instance_id);
    $("lobby-burst-air-immunity").hidden=$("lobby-burst-pass").hidden
      ||pendingEquipment
      ||!(defendingUnit?.creature_name==="Rex"||amuletRevealed);
    const bothLoadouts=loadouts.some(x=>x.actor_id===room.host_id)
      && loadouts.some(x=>x.actor_id===room.guest_id);
    const confirmedSpend=handCards.some(x=>x.card_state==="spent"
      &&x.spent_reason==="attack" &&x.spent_turn===match.turn_no
      &&x.attack_instance_id===clashToCalculate?.attack_card);
    $("lobby-individual-damage-calculate").hidden=!(room.mode==="1x1"
      &&myTurn&&clashToCalculate&&attackResolved&&bothLoadouts&&confirmedSpend
      &&activeBurst?.status!=="awaiting_defender"
      &&(!activeBurst||(priorityClosed&&activePlan))
      &&(!pendingEquipment||resolvedEquipment)
      &&!individualDamage.some(x=>x.turn_no===match.turn_no));
    const dmg=individualDamage.find(x=>x.turn_no===match.turn_no
      &&x.attacker_id===userId);
    $("lobby-resolution-audit-capture").hidden=!(room.mode==="1x1"
      &&myTurn&&dmg&&dmg.cost_status==="test_spent"
      &&!resolutionAudits.some(x=>x.turn_no===match.turn_no));
    const hpReady=hpWallets.some(x=>x.actor_id===room.host_id)&&
      hpWallets.some(x=>x.actor_id===room.guest_id);
    $("lobby-hp-prepare").hidden=!(room.mode==="1x1"&&myTurn&&bothLoadouts
      &&roomLocations.length>0&&!hpWallets.length&&!individualDamage.length);
    const hpAttack=hpWallets.find(x=>x.actor_id===userId);
    const hpDefender=hpWallets.find(x=>x.actor_id===dmg?.defender_id);
    $("lobby-hp-apply").hidden=!(room.mode==="1x1"&&myTurn&&hpReady
      &&dmg&&dmg.calculation_status==="partial_estimate"
      &&dmg.cost_status==="test_spent"&&dmg.preview_subtotal!==null
      &&hpAttack?.hp_remaining>0&&hpDefender?.hp_remaining>0
      &&dmg.location_id===roomLocations[0]?.catalog_location_id
      &&!hpEvents.some(x=>x.turn_no===match.turn_no));
    $("lobby-effect-candidate-capture").hidden=!(room.mode==="1x1"&&myTurn
      &&dmg&&["107","111","112"].includes(dmg.catalog_attack_id)
      &&dmg.calculation_status==="partial_estimate"&&dmg.preview_subtotal>0
      &&dmg.cost_status==="test_spent"
      &&!effectCandidates.some(x=>x.turn_no===match.turn_no));
    $("lobby-reference-preview").hidden=room.mode==="1x1";
    $("lobby-individual-preview").hidden=room.mode!=="1x1";
    const label=$("lobby-clash-status");
    label.textContent=already?"Confronto deste turno registrado. Dano ainda não é aplicado."
      :!myTurn?"Aguarde a sua vez para declarar um confronto."
      :!mine||!other?"Os dois jogadores precisam posicionar uma criatura."
      :!adjacent?"Sem contato entre os lados. Aproxime sua criatura até a linha de combate."
      :!attack?"Declare uma carta de ataque do seu deck neste turno."
      :"Confronto permitido: use o botão para registrar a intenção no servidor.";
  }
  function showOfficialCard(side,unit){
    const img=$("lobby-official-"+side+"-img"),label=$("lobby-official-"+side+"-text");
    if(!img||!label)return;
    const actor=side==="host"?room?.host_id:room?.guest_id;
    const snapshot=loadouts.find(x=>x.actor_id===actor);
    const canonicalName=snapshot?.creature_name?.replace(/ [(]Max[)]$/,'');
    const record=(window.ChaoticOriginalCards?.creatures||[])
      .find(c=>c.nome===canonicalName);
    img.hidden=!record?.cartaBlank;
    if(record?.cartaBlank)img.src=record.cartaBlank;
    label.textContent=snapshot
      ?snapshot.creature_name+" · Energia individual "+snapshot.stats?.e+
       " · c"+snapshot.position
      :unit?"Carta individual #"+unit.card_id+" · c"+unit.position+
        " (prepare a ficha para mostrar atributos e imagem)":"Sem criatura posicionada";
  }
  async function refreshDice(){
    const log=$("lobby-dice-history");
    if(!log)return;
    if(!room||!match){dice=[];log.textContent="Nenhum dado rolado.";return;}
    const {data,error}=await api.from("chaotic_preview_dice")
      .select("turn_no,actor_id,attack_id,die_faces,rolled_value,original_base,multiplied_base")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    dice=data||[];
    log.textContent=dice.length?dice.slice().reverse().map(x=>{
      const who=x.actor_id===room.host_id?"Anfitrião":"Convidado";
      return "Turno "+x.turn_no+" · "+who+" 🎲 "+x.rolled_value+
        " de "+x.die_faces+" · dano base "+x.original_base+
        " × "+x.rolled_value+" = "+x.multiplied_base+
        " (antes dos demais efeitos; HP inalterado).";
    }).join("\n"):"Nenhum dado rolado.";
    updateClashUI();
  }
  async function refreshModifiers(){
    const log=$("lobby-modifiers-history");
    if(!log)return;
    if(!room||!match){modifiers=[];log.textContent="Nenhuma conferência de bônus.";return;}
    const {data,error}=await api.from("chaotic_preview_modifiers")
      .select("turn_no,attacker_id,attack_card_id,base_damage,elemental_bonus,attribute_bonus,reference_subtotal,formula_status")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    modifiers=data||[];
    log.textContent=modifiers.length?modifiers.slice().reverse().map(x=>{
      const who=x.attacker_id===room.host_id?"Anfitrião":"Convidado";
      if(x.formula_status==="roll_or_special_required")
        return "Turno "+x.turn_no+" · "+who+": ataque "+x.attack_card_id+
          " exige dado/efeito especial. Dano total NÃO calculado.";
      if(x.formula_status!=="reference_only")
        return "Turno "+x.turn_no+" · "+who+": carta não identificada ("+x.formula_status+").";
      return "Turno "+x.turn_no+" · "+who+": base "+x.base_damage+
        " + elemental "+x.elemental_bonus+" + atributo "+x.attribute_bonus+
        " = "+x.reference_subtotal+" (referência do catálogo; NÃO é dano final).";
    }).join("\n"):"Nenhuma conferência de bônus.";
    updateClashUI();
  }
  async function refreshBaseDamage(){
    const log=$("lobby-damage-history");
    if(!log)return;
    if(!room||!match){baseDamage=[];log.textContent="Sem cálculos.";return;}
    const {data,error}=await api.from("chaotic_preview_damage")
      .select("turn_no,attacker_id,attack_card_id,attack_name,base_damage,defender_name,defender_energy_base,energy_after_base,calculation_status")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    baseDamage=data||[];
    log.textContent=baseDamage.length?baseDamage.slice().reverse().map(x=>{
      const who=x.attacker_id===room.host_id?"Anfitrião":"Convidado";
      if(x.calculation_status==="ambiguous_attack_id")
        return "Turno "+x.turn_no+" · "+who+": ID "+x.attack_card_id+
          " duplicado no catálogo original. Cálculo bloqueado para preservar as duas cartas.";
      if(x.calculation_status!=="base_only")
        return "Turno "+x.turn_no+" · "+who+": referência não identificada ("+x.calculation_status+").";
      if(x.attack_card_id==="104")
        return "Turno "+x.turn_no+" · "+who+" · Fogo Primordial 2.0: 5 de dano BASE, mas o efeito exige rolagem de dado. Energia NÃO calculada.";
      return "Turno "+x.turn_no+" · "+who+" · "+x.attack_name+
        ": dano BASE "+x.base_damage+" · "+x.defender_name+
        " (energia base "+x.defender_energy_base+
        " → "+x.energy_after_base+" APENAS se não houver modificadores).";
    }).join("\n"):"Nenhum dano base calculado.";
    updateClashUI();
  }
  async function refreshIndividualDamage(){
    const log=$("lobby-individual-damage-history");
    if(!log)return;
    if(!room||!match){individualDamage=[];log.textContent="Nenhuma simulação individual.";return;}
    const {data,error}=await api.from("chaotic_preview_individual_damage")
      .select("turn_no,attacker_id,catalog_attack_id,attack_name,attacker_name,defender_name,defender_energy_initial,base_damage,elemental_bonus,attribute_bonus,equipment_bonus,attack_cost,cost_status,immunity_reason,attacker_equipment_revealed,defender_equipment_revealed,location_id,location_elemental_bonus,location_damage_delta,location_energy_bonus,preview_subtotal,preview_energy_remaining,calculation_status")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    individualDamage=data||[];
    log.textContent=individualDamage.length?individualDamage.slice().reverse().map(x=>{
      const who=x.attacker_id===room.host_id?"Anfitrião":"Convidado";
      const cost=" · custo "+(x.attack_cost??"?")+
        (x.cost_status==="test_spent"
          ?" ponto(s) debitado(s) SOMENTE na mão e no saldo de teste."
          :" ponto(s) — saldo e mão ainda NÃO verificados.");
      const detail=x.immunity_reason?" · Imunidade: "+x.immunity_reason+".":"";
      const locationText=x.location_id
        ?" · Local: "+({501:"Cidade de Kiru",502:"O Túnel da Tempestade",
          503:"A Barragem de Magma"}[x.location_id]||"desconhecido")+
          " (elemento +"+(x.location_elemental_bonus??0)+
          "; dano "+((x.location_damage_delta??0)>=0?"+":"")+
          (x.location_damage_delta??0)+
          "; energia +"+(x.location_energy_bonus??0)+")."
        :" · Sem Local ativo na prévia.";
      if(x.calculation_status!=="partial_estimate")
        return "T"+x.turn_no+" · "+who+": "+x.attack_name+
          " exige resolução adicional de efeito/equipamento."+
          " Base "+x.base_damage+"; dano total e energia restante NÃO simulados."+
          locationText+detail+cost;
      return "T"+x.turn_no+" · "+who+" · "+x.attacker_name+" usou "+x.attack_name+
        " contra "+x.defender_name+": "+x.base_damage+" base + "+
        x.elemental_bonus+" elemento + "+x.attribute_bonus+" atributo + "+
        (x.equipment_bonus??0)+" equipamento + "+(x.location_elemental_bonus??0)+
        " aura de Fogo + "+(x.location_damage_delta??0)+
        " terreno = "+x.preview_subtotal+
        " dano parcial. Energia de referência da prévia "+
        x.defender_energy_initial+" → "+x.preview_energy_remaining+
        " (SIMULAÇÃO: HP real inalterado)."+locationText+detail+cost;
    }).join("\n"):"Nenhuma simulação individual.";
    updateClashUI();
  }
  async function refreshBurstEquipmentEffects(){
    const panel=$("lobby-burst-equipment-effects-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){burstEquipmentEffects=[];return;}
    const {data,error}=await api.from("chaotic_preview_burst_equipment_effects")
      .select("turn_no,defender_id,equipment_name,effect_code,hp_before,hp_after,hp_max_before,hp_max_after,wisdom_before,wisdom_after,applied_to_training_ledger,official_hp_changed")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(error)throw new Error(error.message);
    burstEquipmentEffects=data||[];
    $("lobby-burst-equipment-effects-history").textContent=burstEquipmentEffects.length
      ?burstEquipmentEffects.slice().reverse().map(x=>
        "T"+x.turn_no+" · "+(x.defender_id===room.host_id?"Anfitrião":"Convidado")+
        " · "+x.equipment_name+" · HP teste "+x.hp_before+"/"+x.hp_max_before+
        " → "+x.hp_after+"/"+x.hp_max_after+
        " · Sabedoria teste "+x.wisdom_before+" → "+x.wisdom_after+
        ". EFEITO APLICADO SOMENTE AO TREINAMENTO; equipamento e HP oficiais inalterados."
      ).join("\n")
      :"Nenhum equipamento resolvido no saldo de treinamento.";
    updateClashUI();
  }
  async function refreshBurstEquipmentResponses(){
    const panel=$("lobby-burst-equipment-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){burstEquipmentResponses=[];return;}
    const {data,error}=await api.from("chaotic_preview_burst_equipment_responses")
      .select("turn_no,defender_id,equipment_instance_id,equipment_name,resolution_status,equipment_actually_revealed")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(error)throw new Error(error.message);
    burstEquipmentResponses=data||[];
    $("lobby-burst-equipment-history").textContent=burstEquipmentResponses.length
      ?burstEquipmentResponses.slice().reverse().map(x=>
        "T"+x.turn_no+": "+
        (x.defender_id===room.host_id?"Anfitrião":"Convidado")+
        " declarou revelar "+x.equipment_name+
        (burstEquipmentEffects.some(e=>e.turn_no===x.turn_no)
          ?". Efeito simulado no saldo de treinamento; equipamento original ainda NÃO revelado."
          :". Ação na corrente ainda NÃO executada no combate oficial.")
      ).join("\n")
      :"Nenhuma resposta de equipamento declarada.";
    updateClashUI();
  }
  async function refreshBurstOrderPlans(){
    const panel=$("lobby-burst-order-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){burstOrderPlans=[];return;}
    const {data,error}=await api.from("chaotic_preview_burst_order_plans")
      .select("turn_no,defender_response,defensive_immunity_source,inspection_steps,inspection_step_count,preparation_status,burst_stack_executed,final_damage_verified")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(error)throw new Error(error.message);
    burstOrderPlans=data||[];
    $("lobby-burst-order-history").textContent=burstOrderPlans.length
      ?burstOrderPlans.slice().reverse().map(x=>
        "T"+x.turn_no+" · "+(x.defender_response==="pass"
          ?"Defensor PASSOU (nenhuma carta de resposta adicionada à pilha)."
          :"Defensor reconheceu imunidade passiva a Ar.")+
        " Ordem de INSPEÇÃO: "+(x.inspection_steps||[]).map(step=>
          step.order+"º "+(step.stage==="inspect_passive_air_immunity"
            ?"conferir "+(step.source==="rex_air"?"Rex":"Amuleto do Vácuo")
              +" (passivo, não é contra-ataque)"
            :step.stage==="inspect_queued_equipment_reveal"
              ?"conferir resposta: revelação pendente de "+step.equipment_name
              +" (efeito não executado)"
            :"conferir a carta atacante")
        ).join(" → ")+
        ". Nada executado; dano final NÃO confirmado."
      ).join("\n")
      :"Nenhuma sequência de inspeção preparada.";
    updateMatchUI();
    updateClashUI();
  }
  async function refreshHarpTrainingEvents(){
    const panel=$("lobby-harp-token-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){harpTrainingEvents=[];return;}
    const {data,error}=await api.from("chaotic_preview_harp_token_events")
      .select("actor_id,turn_no,creature_instance_id,equipment_instance_id,equipment_name,tokens_before,tokens_after,equipment_discarded_training,original_equipment_discarded,official_tokens_changed")
      .eq("lobby_id",room.id).limit(10);
    if(error)throw new Error(error.message);
    harpTrainingEvents=data||[];
    $("lobby-harp-token-history").textContent=harpTrainingEvents.length
      ?harpTrainingEvents.map(x=>
        "T"+x.turn_no+" · Arpa Mágica marcada como descartada só no treino: "+
        x.tokens_before+"→"+x.tokens_after+" fichas para "+
        (x.actor_id===userId?"sua criatura":"a criatura adversária")+
        ". Equipamento ORIGINAL permanece na coleção/Deck.").join("\n")
      :"Nenhum efeito de Arpa Mágica aplicado no treinamento.";
    updateClashUI();
  }
  async function refreshTrainingAbilities(){
    const panel=$("lobby-ability-heal-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){trainingAbilityEvents=[];return;}
    const {data,error}=await api.from("chaotic_preview_ability_heal_events")
      .select("turn_no,actor_id,target_actor_id,source_creature_name,ability_code,tokens_before,tokens_after,hp_before,hp_after,hp_max_before,hp_max_after,official_match_modified")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(30);
    if(error)throw new Error(error.message);
    trainingAbilityEvents=data||[];
    $("lobby-ability-heal-history").textContent=trainingAbilityEvents.length
      ?trainingAbilityEvents.slice().reverse().map(x=>
        "T"+x.turn_no+" · "+x.source_creature_name+" usou "+
        (x.ability_code==="lion_energy_10"?"Energia +10":
          x.ability_code==="vidal_heal_15"?"Cura 15":"Cura 10")+
        " em "+(x.target_actor_id===x.actor_id?"si":"outra criatura")+
        ": fichas "+x.tokens_before+"→"+x.tokens_after+
        ", HP de teste "+x.hp_before+"→"+x.hp_after+
        ", máximo "+x.hp_max_before+"→"+x.hp_max_after+
        ". Nenhum HP/ficha oficial modificado.").join("\n")
      :"Nenhuma habilidade de energia aplicada no treinamento.";
    updateClashUI();
  }
  async function refreshMugicTrainingTokens(){
    const panel=$("lobby-mugic-tokens-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){mugicTrainingWallets=[];mugicTrainingSettlements=[];return;}
    const wallet=await api.from("chaotic_preview_mugic_token_wallets")
      .select("actor_id,creature_name,starting_tokens,remaining_tokens")
      .eq("lobby_id",room.id).limit(10);
    if(wallet.error)throw new Error(wallet.error.message);
    mugicTrainingWallets=wallet.data||[];
    const settlements=await api.from("chaotic_preview_mugic_token_settlements")
      .select("turn_no,attacker_id,defender_id,attacker_tokens_before,attacker_tokens_after,defender_tokens_before,defender_tokens_after,outcome,tokens_verified,training_tokens_debited,official_match_modified")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(settlements.error)throw new Error(settlements.error.message);
    mugicTrainingSettlements=settlements.data||[];
    const me=mugicTrainingWallets.find(x=>x.actor_id===userId);
    $("lobby-mugic-token-wallet-history").textContent=me
      ?me.creature_name+": "+me.remaining_tokens+"/"+me.starting_tokens+
        " fichas restantes no TREINAMENTO (não altera fichas oficiais)."
      :"Você ainda não preparou a carteira de fichas de treino; exige criatura 1x1 declarada.";
    $("lobby-mugic-token-settlement-history").textContent=mugicTrainingSettlements.length
      ?mugicTrainingSettlements.slice().reverse().map(x=>
        "T"+x.turn_no+" · Criação: "+x.attacker_tokens_before+" → "+
        x.attacker_tokens_after+" (−1); Rejeição: "+x.defender_tokens_before+
        " → "+x.defender_tokens_after+" (−2). Negação simulada; fichas da "+
        "partida real e cartas não alteradas.").join("\n")
      :"Nenhum custo experimental de Mugic registrado.";
    updateClashUI();
  }
  async function refreshBurstMugicCounterplans(){
    const panel=$("lobby-burst-mugic-counter-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){burstMugicCounterplans=[];return;}
    const {data,error}=await api.from("chaotic_preview_burst_mugic_counterplans")
      .select("turn_no,attacker_id,defender_id,required_creation_tokens,required_rejection_tokens,inspection_status,inspection_steps,hypothetical_creation_negated,token_balance_verified,effect_executed")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(error)throw new Error(error.message);
    burstMugicCounterplans=data||[];
    $("lobby-burst-mugic-counter-history").textContent=burstMugicCounterplans.length
      ?burstMugicCounterplans.slice().reverse().map(x=>
        "T"+x.turn_no+" · INSPEÇÃO LIFO: "+
        (x.inspection_steps||[]).map(y=>y.reverse_order+"º "+y.name).join(" → ")+
        ". Rejeição poderia anular Criação SOMENTE SE fichas e regras forem confirmadas."+
        " Custos previstos: Criação "+x.required_creation_tokens+
        ", Rejeição "+x.required_rejection_tokens+
        " fichas. Fichas NÃO verificadas nem debitadas; nenhum efeito executado."+
        " Cancele as intenções de ambos os jogadores para retomar o fluxo de treinamento."
      ).join("\n")
      :"Nenhuma contraposição entre Mugics preparada.";
    updateClashUI();
  }
  async function refreshBurstMugicIntents(){
    const panel=$("lobby-burst-mugic-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){burstMugicIntents=[];return;}
    const {data,error}=await api.from("chaotic_preview_burst_mugic_intents")
      .select("turn_no,actor_id,catalog_mugic_id,mugic_name,intent_status,consumes_card,consumes_tokens,effect_executed")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(error)throw new Error(error.message);
    // RLS returns ONLY the current player's own Mugic declarations.
    burstMugicIntents=data||[];
    $("lobby-burst-mugic-history").textContent=burstMugicIntents.length
      ?burstMugicIntents.slice().reverse().map(x=>
        "T"+x.turn_no+" · "+x.mugic_name+" · "+
        (x.intent_status==="cancelled"
          ?"intenção cancelada: nenhuma carta consumida."
          :x.intent_status==="resolved_training"
            ?"fichas de TREINAMENTO debitadas; sem efeito de Mugic real."
            :"INTENÇÃO PENDENTE: cancele ou valide o custo experimental; efeito não executado.")+
        " Nenhuma ficha, carta ou HP oficial alterado.").join("\n")
      :"Nenhuma intenção Mugic registrada para sua conta.";
    updateClashUI();
  }
  async function refreshBurstPriority(){
    const panel=$("lobby-burst-priority-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){burstPriority=[];burstPriorityPasses=[];return;}
    const state=await api.from("chaotic_preview_burst_priority")
      .select("turn_no,attacker_id,defender_id,next_actor_id,consecutive_passes,priority_status")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(state.error)throw new Error(state.error.message);
    burstPriority=state.data||[];
    const events=await api.from("chaotic_preview_burst_priority_passes")
      .select("turn_no,pass_seq,actor_id,action_type")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(40);
    if(events.error)throw new Error(events.error.message);
    burstPriorityPasses=events.data||[];
    $("lobby-burst-priority-history").textContent=burstPriority.length
      ?burstPriority.slice().reverse().map(x=>{
        const entries=burstPriorityPasses.filter(p=>p.turn_no===x.turn_no)
          .sort((a,b)=>a.pass_seq-b.pass_seq);
        const detail=entries.map(p=>(p.actor_id===x.attacker_id?"Atacante":"Defensor")
          +" PASSOU (#"+p.pass_seq+")").join(" → ");
        const status=x.priority_status==="closed_preview"
          ?"Dois passes confirmados; ordem de INSPEÇÃO liberada. Burst ainda NÃO resolvido."
          :"Próxima prioridade: "+(x.next_actor_id===x.attacker_id?"atacante":"defensor")+".";
        return "T"+x.turn_no+" · "+(detail||"Nenhum passe ainda.")+" · "+status;
      }).join("\n")
      :"Nenhuma rodada de prioridade aberta.";
    updateMatchUI();
    updateClashUI();
  }
  async function refreshBurstWindows(){
    const panel=$("lobby-burst-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){burstWindows=[];return;}
    const {data,error}=await api.from("chaotic_preview_burst_windows")
      .select("turn_no,attacker_id,defender_id,status,defender_response,defensive_immunity_source,burst_fully_resolved,final_damage_verified")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(error)throw new Error(error.message);
    burstWindows=data||[];
    $("lobby-burst-history").textContent=burstWindows.length
      ?burstWindows.slice().reverse().map(x=>
        "T"+x.turn_no+": "+(x.attacker_id===room.host_id?"Anfitrião":"Convidado")+
        " abriu Burst. "+(x.status==="defender_passed"
          ?"Defensor escolheu PASSAR."
          :x.status==="defender_immunity_noted"
            ?"Defensor reconheceu imunidade a Ar ("+
              (x.defensive_immunity_source==="rex_air"?"Rex":"Amuleto do Vácuo revelado")+
              ") no servidor."
            :"Aguardando resposta do defensor.")+
        " Esta é uma PRÉVIA defensiva; dano final NÃO resolvido."
      ).join("\n")
      :"Nenhuma janela Burst de teste aberta.";
    updateMatchUI();
    updateClashUI();
  }
  async function refreshResolutionAudits(){
    const panel=$("lobby-resolution-audit");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){resolutionAudits=[];return;}
    const {data,error}=await api.from("chaotic_preview_resolution_audits")
      .select("turn_no,actor_id,catalog_attack_id,blocker_codes,blocker_count,review_status,final_damage_verified,applied_to_official_match")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(20);
    if(error)throw new Error(error.message);
    resolutionAudits=data||[];
    const labels={
      burst_unresolved:"Burst ainda não resolvido",
      burst_window_not_opened:"janela Burst não aberta",
      burst_defender_response_pending:"defensor ainda não respondeu",
      burst_defender_passed_preview_only:"defensor passou; demais respostas ainda indisponíveis",
      burst_air_immunity_acknowledged_preview_only:"imunidade a Ar confirmada no teste; Burst completo pendente",
      creature_abilities_unresolved:"habilidades de criaturas pendentes",
      official_turn_and_hp_unintegrated:"combate oficial separado",
      card_ownership_not_authoritative:"emissão e posse de cartas não certificadas",
      damage_formula_incomplete:"fórmula de dano incompleta",
      die_roll_or_special_resolution:"dado ou efeito especial pendente",
      graveyard_scaling_unresolved:"bônus do cemitério não resolvido",
      hand_draw_heal_or_other_action_unresolved:"compra, cura ou ação especial pendente",
      opponent_equipment_removal_unresolved:"remoção de equipamento pendente",
      hidden_creature_reveal_unresolved:"revelação de criatura pendente",
      poison_over_future_turns_unresolved:"veneno por turnos pendente",
      vine_turn_skip_requires_final_damage:"Vinha exige dano final",
      electronic_attack_lock_requires_final_damage:"Mão Eletrônica exige dano final",
      hand_attack_lock_requires_final_damage:"Mão Mão exige dano final",
      equipment_full_effects_unresolved:"efeitos de equipamentos pendentes",
      creature_name_not_validated:"criatura não validada",
      location_not_selected:"Local não definido"
    };
    $("lobby-resolution-audit-history").textContent=resolutionAudits.length
      ?resolutionAudits.slice().reverse().map(x=>
        "T"+x.turn_no+" · ataque #"+x.catalog_attack_id+
        " · "+x.blocker_count+" pendência(s): "+
        (x.blocker_codes||[]).map(v=>labels[v]||"regra ainda não integrada").join("; ")+
        ". DANO FINAL NÃO CONFIRMADO. Nenhum HP oficial alterado."
      ).join("\n")
      :"Nenhuma auditoria registrada. Dano final ainda não disponível.";
    updateClashUI();
  }
  async function refreshHpLedger(){
    const panel=$("lobby-hp-ledger");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){hpWallets=[];hpEvents=[];return;}
    const wallet=await api.from("chaotic_preview_hp_wallets")
      .select("actor_id,creature_instance_id,location_id,hp_max,hp_remaining,projected_hits")
      .eq("lobby_id",room.id).limit(2);
    if(wallet.error)throw new Error(wallet.error.message);
    hpWallets=wallet.data||[];
    const history=await api.from("chaotic_preview_hp_events")
      .select("turn_no,attacker_id,victim_id,hp_before,hp_after,indicative_damage,hypothetical_applied_damage,official_hp_changed,final_damage_verified")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(15);
    if(history.error)throw new Error(history.error.message);
    hpEvents=history.data||[];
    const hpDisplay=id=>{
      const h=hpWallets.find(x=>x.actor_id===id);
      return h?h.hp_remaining+"/"+h.hp_max+" HP de teste":"não iniciado";
    };
    $("lobby-hp-summary").textContent="Anfitrião: "+hpDisplay(room.host_id)+
      " | Convidado: "+hpDisplay(room.guest_id)+
      " · NÃO altera energia oficial nem declara vencedor.";
    $("lobby-hp-events").textContent=hpEvents.length
      ?hpEvents.slice().reverse().map(x=>
        "T"+x.turn_no+": "+(x.victim_id===room.host_id?"Anfitrião":"Convidado")+
        " "+x.hp_before+" → "+x.hp_after+
        " (dano parcial hipotético "+x.indicative_damage+
        "; aplicado ao saldo de teste "+x.hypothetical_applied_damage+
        "; HP real inalterado)."
      ).join("\n")
      :"Nenhum dano acumulado de teste.";
    updateClashUI();
  }
  async function refreshEffectCandidates(){
    const panel=$("lobby-effect-candidates-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){effectCandidates=[];return;}
    const {data,error}=await api.from("chaotic_preview_effect_candidates")
      .select("turn_no,attacker_id,victim_id,catalog_attack_id,effect_code,effect_scope,duration_target_turns,first_target_turn,last_target_turn,indicative_damage,applied_to_match")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    effectCandidates=data||[];
    $("lobby-effect-candidates-history").textContent=effectCandidates.length
      ?effectCandidates.slice().reverse().map(x=>
        "T"+x.turn_no+": "+({107:"Armadilha de Vinha",111:"MÃO ELETRÔNICA",
          112:"MÃO MÃO"}[x.catalog_attack_id]||"Carta")+
        " → "+(x.victim_id===room.host_id?"Anfitrião":"Convidado")+
        " · dano parcial "+x.indicative_damage+
        " · possível efeito no turno "+x.first_target_turn+
        (x.duration_target_turns===2?" e "+x.last_target_turn:"")+
        " · "+(x.effect_scope==="full_turn_no_draw_no_points"
          ?"anular vez/compra/pontos":"bloquear ataques")+
        " · NÃO ATIVADO: depende de dano final."
      ).join("\n")
      :"Nenhum efeito registrado. Nenhum bloqueio ativo.";
    updateClashUI();
  }
  async function refreshRoomLocations(){
    const panel=$("lobby-location-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){roomLocations=[];return;}
    const {data,error}=await api.from("chaotic_preview_room_locations")
      .select("catalog_location_id,location_name,attribute_code,selected_by,selected_turn")
      .eq("lobby_id",room.id).limit(1);
    if(error)throw new Error(error.message);
    roomLocations=data||[];
    const location=roomLocations[0];
    $("lobby-location-history").textContent=location
      ?location.location_name+" · atributo de iniciativa: "+
        ({s:"Sabedoria",p:"Poder",v:"Velocidade",c:"Coragem"}[location.attribute_code]||"Não validado")+
        " · selecionado no servidor (apenas teste)."
      :"Nenhum Local sorteado; sem Local, a prévia usa Velocidade.";
    updateClashUI();
  }
  async function refreshInitiatives(){
    const panel=$("lobby-initiative-preview");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden){initiatives=[];return;}
    const {data,error}=await api.from("chaotic_preview_initiatives")
      .select("turn_no,attacker_id,defender_id,attacker_value,defender_value,winning_player,tie_favors_attacker,attribute_code,attribute_source,location_id")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    initiatives=data||[];
    $("lobby-initiative-history").textContent=initiatives.length
      ?initiatives.slice().reverse().map(x=>
        "T"+x.turn_no+": "+
        ({s:"Sabedoria",p:"Poder",v:"Velocidade",c:"Coragem"}[x.attribute_code]||"Atributo")+
        " atacante "+x.attacker_value+" × defensor "+x.defender_value+" → "+
        (x.winning_player===room.host_id?"Anfitrião":"Convidado")+
        (x.tie_favors_attacker?" (empate favorece atacante)":"")+
        (x.attribute_source==="preview_location_deck"
          ?" · Local do Deck confirmado.":" · SEM LOCAL: fallback de Velocidade.")+
        " Nenhuma mudança de turno ou pontos."
      ).join("\n")
      :"Nenhuma iniciativa de teste calculada.";
    updateClashUI();
  }
  async function refreshClashes(){
    const log=$("lobby-clash-history");
    if(!log)return;
    if(!room||!match){clashes=[];log.textContent="Sem confrontos.";updateClashUI();return;}
    const {data,error}=await api.from("chaotic_preview_clashes")
      .select("turn_no,attacker_id,defender_id,attacker_card,defender_card,attack_card,attacker_position,defender_position,result")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(12);
    if(error)throw new Error(error.message);
    clashes=data||[];
    log.textContent=clashes.length?clashes.slice().reverse().map(e=>{
      const side=e.attacker_id===room.host_id?"Anfitrião":"Convidado";
      const attackMatches=(window.ChaoticOriginalCards?.attacks||[])
        .filter(c=>String(c.id)===String(e.attack_card));
      const attackLabel=attackMatches.length===1?attackMatches[0].nome:
        attackMatches.length>1?"Ataque #"+e.attack_card+" (ID duplicado)":"Ataque #"+e.attack_card;
      return "Turno "+e.turn_no+" · "+side+": "+attackLabel
        +" (c"+e.attacker_position+" contra c"+e.defender_position+") · resolução pendente";
    }).join("\n"):"Nenhum confronto registrado.";
    updateClashUI();
  }
  function updateLoadoutUI(){
    const panel=$("lobby-loadout-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden)return;
    const mine=board.find(x=>x.actor_id===userId);
    const has=loadouts.some(x=>x.actor_id===userId);
    const ownTurn=match.status==="active"&&room.status==="ready"&&
      match.current_player===userId&&new Date(room.expires_at).getTime()>Date.now();
    $("lobby-loadout-capture").hidden=!(ownTurn&&mine&&!has);
    const myLoadout=loadouts.find(x=>x.actor_id===userId);
    const revealed=equipmentReveals.some(x=>x.actor_id===userId);
    $("lobby-equipment-reveal").hidden=!(ownTurn&&myLoadout?.equipment_instance_id&&!revealed);
    const revealLog=$("lobby-equipment-reveal-history");
    revealLog.textContent=equipmentReveals.length
      ?equipmentReveals.map(x=>(x.actor_id===room.host_id?"Anfitrião":"Convidado")+
        " revelou "+x.equipment_name+" no turno "+x.revealed_turn+
        " (somente simulação).").join("\n")
      :"Nenhum equipamento revelado neste teste.";
    const read=(actor,side)=>{
      const record=loadouts.find(x=>x.actor_id===actor);
      const label=$("lobby-loadout-"+side);
      if(!label)return;
      if(!record){label.textContent="Ainda sem ficha individual.";return;}
      const t=record.stats||{};
      label.textContent=record.creature_name+
        " · Energia "+t.e+" | Coragem "+t.c+" | Poder "+t.p+
        " | Sabedoria "+t.s+" | Velocidade "+t.v+
        (record.equipment_name?" · Equipamento: "+record.equipment_name:" · Sem equipamento");
    };
    read(room.host_id,"host");
    read(room.guest_id,"guest");
  }
  async function refreshLoadouts(){
    if(!$("lobby-loadout-panel"))return;
    if(!room||!match){loadouts=[];updateLoadoutUI();return;}
    const {data,error}=await api.from("chaotic_preview_loadouts")
      .select("actor_id,card_instance_id,creature_name,tribe,position,stats,equipment_instance_id,equipment_name")
      .eq("lobby_id",room.id);
    if(error)throw new Error(error.message);
    loadouts=data||[];
    updateLoadoutUI();
    showOfficialCard("host",board.find(x=>x.actor_id===room.host_id));
    showOfficialCard("guest",board.find(x=>x.actor_id===room.guest_id));
    updateAttackInstanceUI();
    updateClashUI();
  }
  async function refreshEquipmentReveals(){
    if(!$("lobby-equipment-reveal-history"))return;
    if(!room||!match){equipmentReveals=[];updateLoadoutUI();return;}
    const {data,error}=await api.from("chaotic_preview_equipment_reveals")
      .select("actor_id,equipment_instance_id,equipment_name,revealed_turn")
      .eq("lobby_id",room.id).order("revealed_turn",{ascending:true}).limit(2);
    if(error)throw new Error(error.message);
    equipmentReveals=data||[];
    updateLoadoutUI();
  }
  function updateAttackResourceUI(){
    const panel=$("lobby-attack-resources-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden)return;
    const myTurn=match.status==="active"&&room.status==="ready"&&
      match.current_player===userId&&new Date(room.expires_at).getTime()>Date.now();
    const wallet=attackWallets[0];
    const ownCreature=loadouts.some(x=>x.actor_id===userId);
    const available=wallet&&myTurn&&match.turn_no>=wallet.prepared_turn
      ?3+Math.floor((match.turn_no-wallet.prepared_turn)/2)-wallet.spent_points
      :null;
    $("lobby-hand-prepare").hidden=!(myTurn&&ownCreature&&!wallet);
    $("lobby-hand-sync").hidden=!(myTurn&&wallet&&wallet.last_draw_turn!==match.turn_no);
    const snapshot=attackInstances.find(x=>x.actor_id===userId&&x.turn_no===match.turn_no);
    const clash=clashes.find(x=>x.attacker_id===userId&&x.turn_no===match.turn_no);
    const inHand=handCards.some(x=>x.card_slot===snapshot?.card_slot
      &&x.attack_instance_id===snapshot?.attack_instance_id&&x.card_state==="hand");
    const spent=handCards.some(x=>x.card_slot===snapshot?.card_slot
      &&x.attack_instance_id===snapshot?.attack_instance_id
      &&x.spent_reason==="attack"&&x.spent_turn===match.turn_no);
    $("lobby-hand-spend").hidden=!(myTurn&&wallet?.last_draw_turn===match.turn_no
      &&snapshot&&clash&&inHand&&!spent);
    const remaining=handCards.filter(x=>x.card_state==="hand")
      .slice().sort((a,b)=>a.draw_position-b.draw_position);
    const discardSelect=$("lobby-hand-discard-slot");
    const oldChoice=discardSelect.value;
    discardSelect.innerHTML=remaining.map(x=>
      '<option value="'+x.card_slot+'">Slot '+x.card_slot+'</option>').join("");
    if(remaining.some(x=>String(x.card_slot)===String(oldChoice)))
      discardSelect.value=oldChoice;
    $("lobby-hand-discard").hidden=!(myTurn&&wallet?.last_draw_turn===match.turn_no
      &&remaining.length>0);
    $("lobby-attack-resource-summary").textContent=!wallet
      ?"Prepare a mão de teste após preparar sua criatura."
      :"Mão: "+remaining.length+" carta(s) · monte "+
        Math.max(0,(wallet.total_cards??handCards.length)-handCards.length)+
        " · lixo "+handCards.filter(x=>x.card_state==="spent").length+
        " · ciclos de reembaralhamento "+(wallet.recycle_cycles??0)+
        " · pontos "+(available===null?"na sua vez":available)+
        " (3 iniciais e +1 por nova vez em TESTE; baralho oculto).";
    $("lobby-hand-cards").textContent=remaining.length
      ?remaining.map(x=>"slot "+x.card_slot+" · carta #"+x.attack_instance_id).join(" | ")
      :"Nenhuma carta disponível nesta mão de teste.";
  }
  async function refreshAttackResources(){
    if(!$("lobby-attack-resources-panel"))return;
    if(!room||!match){
      attackWallets=[];handCards=[];updateAttackResourceUI();return;
    }
    const wallets=await api.from("chaotic_preview_attack_wallets")
      .select("actor_id,prepared_turn,last_draw_turn,spent_points,total_cards,recycle_cycles")
      .eq("lobby_id",room.id).limit(2);
    if(wallets.error)throw new Error(wallets.error.message);
    attackWallets=(wallets.data||[]).filter(x=>x.actor_id===userId);
    const hand=await api.from("chaotic_preview_attack_hand")
      .select("actor_id,card_slot,draw_position,attack_instance_id,card_state,spent_turn,spent_reason,draw_cycle")
      .eq("lobby_id",room.id).order("draw_position",{ascending:true}).limit(20);
    if(hand.error)throw new Error(hand.error.message);
    handCards=(hand.data||[]).filter(x=>x.actor_id===userId);
    updateAttackResourceUI();
    updateAttackInstanceUI();
    updateClashUI();
  }
  function updateAttackInstanceUI(){
    const panel=$("lobby-attack-instance-panel");
    if(!panel)return;
    panel.hidden=!room||!match||room.mode!=="1x1";
    if(panel.hidden)return;
    const declared=declarations.find(x=>x.actor_id===userId
      && x.turn_no===match.turn_no && x.kind==="attack");
    const already=attackInstances.some(x=>x.actor_id===userId&&x.turn_no===match.turn_no);
    const hasCreature=loadouts.some(x=>x.actor_id===userId);
    const ownTurn=match.status==="active"&&room.status==="ready"&&
      match.current_player===userId&&new Date(room.expires_at).getTime()>Date.now();
    const ownHandCard=handCards.find(x=>x.card_slot===declared?.card_slot
      &&x.attack_instance_id===declared?.card_id);
    $("lobby-attack-instance-capture").hidden=!(ownTurn&&declared&&hasCreature&&!already
      &&attackWallets.length&&ownHandCard?.card_state==="hand"
      &&attackWallets[0]?.last_draw_turn===match.turn_no);
    const log=$("lobby-attack-instance-history");
    log.textContent=attackInstances.length
      ?attackInstances.slice().reverse().map(x=>
        "T"+x.turn_no+" · "+(x.actor_id===room.host_id?"Anfitrião":"Convidado")+
        ": "+x.attack_name+" (catálogo #"+x.catalog_attack_id+
        ", instância #"+x.attack_instance_id+") · custo "+x.attack_cost+
        " · base "+x.base_damage).join("\n")
      :"Nenhum ataque individual preparado.";
  }
  async function refreshAttackInstances(){
    if(!$("lobby-attack-instance-panel"))return;
    if(!room||!match){attackInstances=[];updateAttackInstanceUI();return;}
    const {data,error}=await api.from("chaotic_preview_attack_instances")
      .select("turn_no,actor_id,card_slot,deck_slot,attack_instance_id,catalog_attack_id,attack_name,base_damage,attack_cost")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(24);
    if(error)throw new Error(error.message);
    attackInstances=data||[];
    updateAttackInstanceUI();
    updateAttackResourceUI();
    updateClashUI();
  }
  function updateBoardUI() {
    const box=$("lobby-hex-board");
    if(!box) return;
    box.hidden=!match;
    if(!match || !room) return;
    const mine=board.find(x=>x.actor_id===userId);
    const chosen=declarations.find(x=>x.actor_id===userId && x.kind==="creature");
    const active=match.status==="active" && room.status==="ready"
      && new Date(room.expires_at).getTime()>Date.now();
    const ownTurn=active && match.current_player===userId;
    $("lobby-hex-place").hidden=!(ownTurn && chosen && !mine);
    $("lobby-hex-move").hidden=!(ownTurn && mine && room.mode!=="1x1"
      && mine.moved_turn!==match.turn_no);
    $("lobby-hex-destination").hidden=room.mode==="1x1";
    const hint=$("lobby-hex-message");
    hint.textContent=!chosen
      ?"Primeiro declare uma criatura de um slot do seu deck."
      :!mine
        ?"Posicione a criatura escolhida no slot correspondente (modo 1x1: c6; 3x3: c4–c6; 6x6: c1–c6)."
        :room.mode==="1x1"
          ?"No 1x1, c6 é o único hexágono de cada lado: não existe movimento para casa vazia."
          :ownTurn
            ?"Sua criatura está em c"+mine.position+". Você pode mover uma vez por turno para casa adjacente vazia."
            :"Aguardando sua vez. Posição atual: c"+mine.position+".";
    const positions=room.mode==="1x1"?[6]:room.mode==="3x3"?[4,5,6]:[1,2,3,4,5,6];
    for(const side of ["host","guest"]) {
      const actor=side==="host"?room.host_id:room.guest_id;
      const unit=board.find(x=>x.actor_id===actor);
      for(let n=1;n<=6;n++){
        const hex=$("lobby-hex-"+side+"-"+n);
        if(!hex)continue;
        const enabled=positions.includes(n),occupied=!!unit && unit.position===n;
        hex.hidden=!enabled;
        hex.textContent="c"+n+(occupied?" · #"+unit.card_id:"");
        hex.classList.toggle("ocupado",occupied);
        hex.classList.toggle("sua-vez",occupied && active && actor===match.current_player);
      }
    }
  }
  async function refreshBoard(){
    if(!$("lobby-hex-board"))return;
    if(!room || !match){board=[];updateBoardUI();return;}
    const {data,error}=await api.from("chaotic_preview_board")
      .select("actor_id,card_id,position,moved_turn")
      .eq("lobby_id",room.id);
    if(error)throw new Error(error.message);
    board=data||[];
    showOfficialCard("host",board.find(x=>x.actor_id===room.host_id));
    showOfficialCard("guest",board.find(x=>x.actor_id===room.guest_id));
    updateBoardUI();
    updateLoadoutUI();
    updateClashUI();
  }
  async function refreshDeclarations() {
    const log = $("lobby-combat-history");
    if (!log) return;
    if (!room || !match) {
      declarations=[];
      log.textContent="As escolhas de cartas aparecerão aqui.";
      return;
    }
    const {data,error} = await api.from("chaotic_combat_declarations")
      .select("turn_no,actor_id,kind,deck_slot,card_slot,card_id")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(24);
    if(error) throw new Error(error.message);
    declarations = data || [];
    const rows=declarations.slice().reverse();
    log.textContent=rows.length ? rows.map(x=>{
      const side = x.actor_id===room.host_id ? "Anfitrião" : "Convidado";
      return "T"+x.turn_no+" · "+side+(x.kind==="creature"?" escolheu criatura ":" declarou ataque ")
        +"#"+x.card_id+" (deck "+x.deck_slot+", posição "+x.card_slot+")";
    }).join("\n"):"Nenhuma escolha de carta registrada.";
    $("lobby-combat-host").textContent="Anfitrião: "+(
      declarations.find(x=>x.actor_id===room.host_id && x.kind==="creature")?.card_id || "sem criatura"
    );
    $("lobby-combat-guest").textContent="Convidado: "+(
      declarations.find(x=>x.actor_id===room.guest_id && x.kind==="creature")?.card_id || "sem criatura"
    );
    updateMatchUI();
  }
  async function refreshHistory() {
    const log = $("lobby-events");
    if (!log) return;
    if (!room || !match) { log.textContent = "O histórico aparecerá quando o teste começar."; return; }
    const {data,error} = await api.from("chaotic_match_events")
      .select("seq,event_type,turn_no,actor_id,created_at")
      .eq("lobby_id",room.id).order("seq",{ascending:false}).limit(12);
    if (error) throw new Error(error.message);
    const entries = (data || []).slice().reverse();
    log.textContent = entries.length ? entries.map(entry => {
      const side = entry.actor_id === room.host_id ? "Anfitrião" : "Convidado";
      if (entry.event_type === "start") return "⚔️ "+side+" iniciou o teste";
      if (entry.event_type === "stop") return "⏹️ "+side+" encerrou o teste";
      return "↪ "+side+" passou o turno "+(entry.turn_no - 1);
    }).join("\n") : "Nenhum evento registrado.";
  }
  async function refreshMatch() {
    if (!room) { match = null; updateMatchUI(); return; }
    const {data,error} = await api.from("chaotic_match_turns")
      .select("lobby_id,host_id,guest_id,status,current_player,turn_no,last_player,updated_at")
      .eq("lobby_id",room.id).maybeSingle();
    if (error) throw new Error(error.message);
    match = data; updateMatchUI();
    await refreshHistory();
    await refreshDeclarations();
    await refreshBoard();
    await refreshLoadouts();
    await refreshEquipmentReveals();
    await refreshAttackResources();
    await refreshAttackInstances();
    await refreshClashes();
    await refreshRoomLocations();
    await refreshInitiatives();
    await refreshBaseDamage();
    await refreshModifiers();
    await refreshDice();
    await refreshIndividualDamage();
    await refreshHpLedger();
    await refreshEffectCandidates();
    await refreshBurstWindows();
    await refreshBurstPriority();
    await refreshBurstMugicIntents();
    await refreshBurstMugicCounterplans();
    await refreshMugicTrainingTokens();
    await refreshTrainingAbilities();
    await refreshHarpTrainingEvents();
    await refresh3x3Allies();
    await refreshBurstEquipmentResponses();
    await refreshBurstOrderPlans();
    await refreshBurstEquipmentEffects();
    await refreshResolutionAudits();
  }
  function update3x3UI(){
    const panel=$("lobby-3x3-allies-panel");
    if(!panel)return;
    panel.hidden=!room||room.mode!=="3x3";
    if(panel.hidden)return;
    const current=match?.status==="active"&&room.status==="ready"
      &&new Date(room.expires_at).getTime()>Date.now();
    const myTurn=!!current&&match.current_player===userId;
    const own=allies3x3.filter(x=>x.actor_id===userId).sort((a,b)=>a.position-b.position);
    const donor=own.find(x=>x.creature_name==="Alakazaz");
    const priorTransfer=transfers3x3.some(x=>x.turn_no===match?.turn_no
      &&x.actor_id===userId);
    $("lobby-3x3-prepare").hidden=!(myTurn&&own.length===0);
    const ownHP=hp3x3.filter(x=>x.actor_id===userId);
    $("lobby-3x3-hp-prepare").hidden=!(myTurn&&own.length===3&&ownHP.length===0);
    const myBoard=board3x3.filter(x=>x.actor_id===userId);
    const movedAlready=moves3x3.some(x=>x.actor_id===userId&&x.turn_no===match?.turn_no);
    $("lobby-3x3-board-prepare").hidden=!(myTurn&&ownHP.length===3&&myBoard.length===0);
    $("lobby-3x3-move").hidden=!(myTurn&&myBoard.length===3
      &&!movedAlready&&!clashes.some(x=>x.turn_no===match?.turn_no)
      &&!burstWindows.some(x=>x.turn_no===match?.turn_no));
    const options=$("lobby-3x3-receiver");
    // Values are fixed board positions; names and card IDs are never interpolated into HTML.
    const allowed=own.filter(x=>x.position!==donor?.position);
    const existing=options.value;
    options.innerHTML='<option value="4">Aliado c4</option>'+
      '<option value="5">Aliado c5</option><option value="6">Aliado c6</option>';
    options.value=allowed.some(x=>String(x.position)===existing)?existing:
      String(allowed[0]?.position||4);
    $("lobby-3x3-transfer").hidden=!(myTurn&&donor&&donor.remaining_tokens>0
      &&!priorTransfer&&allowed.length>0
      &&!clashes.some(x=>x.turn_no===match?.turn_no)
      &&!burstWindows.some(x=>x.turn_no===match?.turn_no));
    $("lobby-3x3-allies-history").textContent=allies3x3.length
      ?allies3x3.slice().sort((a,b)=>a.actor_id===b.actor_id?
        a.position-b.position:a.actor_id.localeCompare(b.actor_id)).map(x=>
        (x.actor_id===userId?"Seu Deck":"Deck do adversário")+
        " · c"+x.position+" · "+x.creature_name+
        " · "+x.remaining_tokens+" fichas de treino"+
        (x.creature_name==="Alakazaz"?" (pode doar)":"")).join("\n")
      :"Nenhuma formação 3x3 congelada.";
    $("lobby-3x3-hp-history").textContent=hp3x3.length
      ?hp3x3.slice().sort((a,b)=>a.actor_id===b.actor_id?
        a.position-b.position:a.actor_id.localeCompare(b.actor_id)).map(x=>
        (x.actor_id===userId?"Sua criatura":"Criatura adversária")+
        " · c"+x.position+" · "+x.creature_name+
        " · HP de treino "+x.hp_remaining+"/"+x.hp_max+
        " · 0 ataques aplicados · nenhuma alteração no HP oficial.").join("\n")
      :"HP não preparado. Cada jogador deve iniciar suas três criaturas separadamente.";
    $("lobby-3x3-board-history").textContent=board3x3.length
      ?board3x3.slice().sort((a,b)=>a.actor_id===b.actor_id?
        a.formation_slot-b.formation_slot:a.actor_id.localeCompare(b.actor_id)).map(x=>
        (x.actor_id===userId?"Sua":"Adversária")+" c"+x.formation_slot+
        " · hex "+x.hex_position+
        (x.moved_turn===match?.turn_no?" · já moveu neste turno":"")+
        " · só no treinamento.").join("\n")
      :"Nenhum posicionamento experimental preparado.";
    $("lobby-3x3-move-history").textContent=moves3x3.length
      ?moves3x3.slice().sort((a,b)=>a.turn_no-b.turn_no).map(x=>
        "T"+x.turn_no+" · "+(x.actor_id===userId?"Você":"Adversário")+
        " · c"+x.formation_slot+": hex "+x.from_hex+" → "+x.to_hex+
        ". Sem dano ou posição oficial alterada.").join("\n")
      :"Nenhum movimento realizado.";
    $("lobby-3x3-transfer-history").textContent=transfers3x3.length
      ?transfers3x3.slice().sort((a,b)=>a.turn_no-b.turn_no).map(x=>
        "T"+x.turn_no+" · "+(x.actor_id===userId?"Você":"Adversário")+
        " · Alakazaz c"+x.donor_position+" ("+x.donor_before+"→"+x.donor_after+
        ") doou 1 ficha para c"+x.receiver_position+
        " ("+x.receiver_before+"→"+x.receiver_after+
        "). Apenas treinamento; nenhuma carta oficial alterada.").join("\n")
      :"Nenhuma ficha transferida.";
  }
  async function refresh3x3Allies(){
    if(!$("lobby-3x3-allies-panel"))return;
    if(!room||!match||room.mode!=="3x3"){
      allies3x3=[];transfers3x3=[];hp3x3=[];board3x3=[];moves3x3=[];update3x3UI();return;
    }
    const units=await api.from("chaotic_preview_3x3_allies")
      .select("actor_id,position,deck_slot,creature_instance_id,creature_name,starting_tokens,remaining_tokens,received_tokens")
      .eq("lobby_id",room.id).limit(6);
    if(units.error)throw new Error(units.error.message);
    allies3x3=units.data||[];
    const hpResult=await api.from("chaotic_preview_3x3_hp_wallets")
      .select("actor_id,position,creature_instance_id,creature_name,hp_initial,hp_max,hp_remaining,initialized_turn,damage_events,official_match_modified")
      .eq("lobby_id",room.id).limit(6);
    if(hpResult.error)throw new Error(hpResult.error.message);
    hp3x3=hpResult.data||[];
    const board=await api.from("chaotic_preview_3x3_board_positions")
      .select("actor_id,formation_slot,creature_instance_id,hex_position,moved_turn,official_position_changed")
      .eq("lobby_id",room.id).limit(6);
    if(board.error)throw new Error(board.error.message);
    board3x3=board.data||[];
    const movements=await api.from("chaotic_preview_3x3_move_events")
      .select("actor_id,turn_no,formation_slot,creature_instance_id,from_hex,to_hex,official_position_changed")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(60);
    if(movements.error)throw new Error(movements.error.message);
    moves3x3=movements.data||[];
    const history=await api.from("chaotic_preview_3x3_token_transfers")
      .select("actor_id,turn_no,donor_position,receiver_position,donor_before,donor_after,receiver_before,receiver_after")
      .eq("lobby_id",room.id).order("turn_no",{ascending:false}).limit(50);
    if(history.error)throw new Error(history.error.message);
    transfers3x3=history.data||[];
    update3x3UI();
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
    updateMatchUI();
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
    await refreshMatch();
  }
  function watch() {
    halt();
    if (room && typeof api.channel === "function") {
      const lobbyId = room.id;
      const sync = () => {
        if (room?.id !== lobbyId) return;
        refreshRoom().catch(error=>note("Erro ao sincronizar sala: "+error.message,true));
      };
      // A mesma sala acompanha presença, turno, histórico e cartas declaradas.
      liveChannel=api.channel("chaotic-drome-"+lobbyId+"-"+userId)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_lobbies",filter:"id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_match_turns",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_match_events",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_combat_declarations",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_board",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_clashes",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_damage",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_modifiers",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_dice",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_loadouts",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_attack_instances",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_individual_damage",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_equipment_reveals",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_attack_wallets",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_attack_hand",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_initiatives",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_room_locations",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_effect_candidates",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_hp_wallets",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_hp_events",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_resolution_audits",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_windows",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_priority",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_priority_passes",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_mugic_intents",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_mugic_counterplans",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_mugic_token_wallets",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_mugic_token_settlements",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_ability_heal_events",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_harp_token_events",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_3x3_allies",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_3x3_hp_wallets",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_3x3_board_positions",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_3x3_move_events",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_3x3_token_transfers",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_order_plans",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_equipment_responses",filter:"lobby_id=eq."+lobbyId
        },sync)
        .on("postgres_changes",{
          event:"*",schema:"public",table:"chaotic_preview_burst_equipment_effects",filter:"lobby_id=eq."+lobbyId
        },sync)
        .subscribe(status=>{
          if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")
            console.warn("DROME: canal em tempo real temporariamente indisponível; consultas periódicas seguem ativas.");
        });
    }
    // Plano B para celular sem conexão Realtime ou serviço suspenso em segundo plano.
    poll = setInterval(() => {
      if (!$("lobby-current") || $("tela-entrada-drome")?.style.display !== "flex") { halt(); return; }
      refreshRoom().catch(error => note(error.message, true));
    }, 6000);
  }
  function show() {
    halt(); room = null; match = null; declarations = []; board = []; clashes = []; baseDamage = []; modifiers = []; dice = []; loadouts = []; attackInstances = []; individualDamage = []; equipmentReveals = []; attackWallets = []; handCards = []; initiatives = []; roomLocations = []; effectCandidates = []; hpWallets = []; hpEvents = []; resolutionAudits = []; burstWindows = []; burstOrderPlans = []; burstEquipmentResponses = []; burstEquipmentEffects = []; burstPriority = []; burstPriorityPasses = []; burstMugicIntents = []; burstMugicCounterplans = []; mugicTrainingWallets = []; mugicTrainingSettlements = []; trainingAbilityEvents = []; harpTrainingEvents = []; allies3x3 = []; transfers3x3 = []; hp3x3 = []; board3x3 = []; moves3x3 = [];
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
      '<section id="lobby-turns" class="lobby-turns" hidden>',
      '<strong>⚔️ SINCRONIZAÇÃO DE TURNOS — TESTE</strong>',
      '<p>Não utiliza cartas nem decide vitórias.</p>',
      '<p id="lobby-turn-state" role="status"></p>',
      '<p>Turno: <b id="lobby-turn-count">—</b></p>',
      '<div class="lobby-mini-board" role="group" aria-label="Posição dos jogadores">',
      '<div id="lobby-board-host" class="lobby-board-slot">⬜ Anfitrião</div>',
      '<span class="lobby-board-versus">VS</span>',
      '<div id="lobby-board-guest" class="lobby-board-slot">⬜ Convidado</div>',
      '</div>',
      '<section id="lobby-combat" class="lobby-combat" hidden>',
      '<strong>🃏 DECLARAÇÃO DE CARTAS (TESTE)</strong>',
      '<p>Sem dano, efeitos, vitória ou recompensas.</p>',
      '<div class="lobby-card-sides"><span id="lobby-combat-host">Anfitrião: sem criatura</span>',
      '<span id="lobby-combat-guest">Convidado: sem criatura</span></div>',
      '<label for="lobby-combat-kind">Ação</label>',
      '<select id="lobby-combat-kind"><option value="creature">Escolher criatura</option>',
      '<option value="attack">Declarar ataque</option></select>',
      '<label for="lobby-combat-deck">Slot do deck salvo</label>',
      '<select id="lobby-combat-deck"><option value="1">Deck 1</option>',
      '<option value="2">Deck 2</option><option value="3">Deck 3</option></select>',
      '<label for="lobby-combat-slot">Posição da carta nesse deck</label>',
      '<input type="number" id="lobby-combat-slot" min="1" max="20" step="1" value="1">',
      '<p id="lobby-combat-hint" role="status"></p>',
      '<button type="button" id="lobby-combat-submit" hidden>Registrar escolha</button>',
      '<p class="lobby-history-label">Histórico das escolhas</p>',
      '<p id="lobby-combat-history" class="lobby-events" aria-live="polite">Nenhuma.</p>',
      '</section>',
      '<section id="lobby-hex-board" class="lobby-hex-board" hidden>',
      '<strong>🛡️ TABULEIRO COMPARTILHADO — MOVIMENTO DE TESTE</strong>',
      '<p>Somente posição. Ataques, equipamentos e efeitos continuam no motor original.</p>',
      '<p class="lobby-history-label">Área do anfitrião</p>',
      '<div class="lobby-hex-row">',
      ...[1,2,3,4,5,6].map(n=>'<span id="lobby-hex-host-'+n+'" class="lobby-hex">c'+n+'</span>'),
      '</div>',
      '<p class="lobby-history-label">Área do convidado</p>',
      '<div class="lobby-hex-row">',
      ...[1,2,3,4,5,6].map(n=>'<span id="lobby-hex-guest-'+n+'" class="lobby-hex">c'+n+'</span>'),
      '</div>',
      '<p id="lobby-hex-message" role="status"></p>',
      '<button id="lobby-hex-place" type="button" hidden>Posicionar minha criatura</button>',
      '<label for="lobby-hex-destination">Destino da movimentação</label>',
      '<select id="lobby-hex-destination"><option value="1">c1</option><option value="2">c2</option>',
      '<option value="3">c3</option><option value="4">c4</option>',
      '<option value="5">c5</option><option value="6">c6</option></select>',
      '<button id="lobby-hex-move" type="button" hidden>Mover para a casa escolhida</button>',
      '</section>',
      '<section id="lobby-loadout-panel" class="lobby-combat" hidden>',
      '<strong>🧬 FICHAS INDIVIDUAIS — 1x1 (TESTE)</strong>',
      '<p>A ficha usa os atributos de cada carta salva no álbum, não somente o padrão do catálogo.</p>',
      '<p>Anfitrião: <span id="lobby-loadout-host">Ainda sem ficha individual.</span></p>',
      '<p>Convidado: <span id="lobby-loadout-guest">Ainda sem ficha individual.</span></p>',
      '<button id="lobby-loadout-capture" type="button" hidden>Preparar ficha da minha criatura</button>',
      '<button id="lobby-equipment-reveal" type="button" hidden>Revelar meu equipamento (teste)</button>',
      '<p id="lobby-equipment-reveal-history" class="lobby-events" aria-live="polite">Nenhum equipamento revelado.</p>',
      '<p>Ficha congelada para este teste; nenhuma energia foi reduzida.</p>',
      '</section>',
      '<section id="lobby-attack-resources-panel" class="lobby-combat" hidden>',
      '<strong>🃏 MÃO E PONTOS DE ATAQUE — 1x1 (TESTE)</strong>',
      '<p>Embaralhamento feito pelo servidor: só você vê as cartas compradas e usadas. Começa com 3 pontos de teste e ganha 1 a cada nova vez. O baralho não é revelado, e nada é descontado no combate oficial.</p>',
      '<button id="lobby-hand-prepare" type="button" hidden>Embaralhar e preparar mão de teste</button>',
      '<button id="lobby-hand-sync" type="button" hidden>Comprar carta e atualizar pontos (teste)</button>',
      '<label for="lobby-hand-discard-slot">Descartar da mão de teste</label>',
      '<select id="lobby-hand-discard-slot"></select>',
      '<button id="lobby-hand-discard" type="button" hidden>Descartar carta selecionada (teste)</button>',
      '<p id="lobby-attack-resource-summary" class="lobby-events" aria-live="polite">Mão não preparada.</p>',
      '<p id="lobby-hand-cards" class="lobby-events">Nenhuma carta na mão.</p>',
      '<button id="lobby-hand-spend" type="button" hidden>Confirmar carta e gastar pontos de teste</button>',
      '</section>',
      '<section id="lobby-attack-instance-panel" class="lobby-combat" hidden>',
      '<strong>🃏 ATAQUE INDIVIDUAL — 1x1 (TESTE)</strong>',
      '<p>Confere se o ataque declarado está no seu deck e no álbum, relacionando o ID da captura ao catálogo original. Não aplica dano.</p>',
      '<button id="lobby-attack-instance-capture" type="button" hidden>Validar meu ataque individual</button>',
      '<p id="lobby-attack-instance-history" class="lobby-events" aria-live="polite">Nenhum ataque individual preparado.</p>',
      '</section>',
      '<section id="lobby-clash-panel" class="lobby-clash-panel" hidden>',
      '<strong>⚔️ ENCONTRO DE CRIATURAS (TESTE)</strong>',
      '<p>Utiliza as posições originais do DROME. O dano e os efeitos ainda não são aplicados.</p>',
      '<div class="lobby-official-cards">',
      '<div class="lobby-official-card"><img id="lobby-official-host-img" alt="Criatura do anfitrião" hidden>',
      '<span id="lobby-official-host-text">Sem criatura</span></div>',
      '<div class="lobby-official-versus">VS</div>',
      '<div class="lobby-official-card"><img id="lobby-official-guest-img" alt="Criatura do convidado" hidden>',
      '<span id="lobby-official-guest-text">Sem criatura</span></div>',
      '</div>',
      '<p id="lobby-clash-status" role="status"></p>',
      '<button id="lobby-clash-open" type="button" hidden>Registrar confronto</button>',
      '<section id="lobby-location-preview" class="lobby-combat" hidden>',
      '<strong>🗺️ LOCAL DO COMBATE — 1x1 (TESTE)</strong>',
      '<p>O servidor sorteia um Local entre as cartas do Deck do atacante. A escolha fica fixa nesta sala. Ainda não aplica bônus ou efeitos reais do Local.</p>',
      '<button id="lobby-location-capture" type="button" hidden>Sortear Local do meu Deck no servidor</button>',
      '<p id="lobby-location-history" class="lobby-events">Nenhum Local sorteado.</p>',
      '</section>',
      '<section id="lobby-initiative-preview" class="lobby-combat" hidden>',
      '<strong>⚡ INICIATIVA COM DNA INDIVIDUAL — TESTE</strong>',
      '<p>Compara o atributo do Local sorteado (Sabedoria, Poder ou Velocidade). Sem Local sorteado, usa Velocidade como fallback. O empate favorece o atacante. NÃO muda turnos nem concede pontos.</p>',
      '<button id="lobby-initiative-preview-calculate" type="button" hidden>Conferir iniciativa no servidor</button>',
      '<p id="lobby-initiative-history" class="lobby-events" aria-live="polite">Nenhuma iniciativa calculada.</p>',
      '</section>',
      '<section id="lobby-burst-preview" class="lobby-combat" hidden>',
      '<strong>⚡ BURST — JANELA DE RESPOSTA 1x1 (TESTE)</strong>',
      '<p>O atacante abre a janela após validar a carta. O defensor pode PASSAR mesmo durante a vez do atacante. Não executa respostas, contra-ataques, habilidades nem dano final.</p>',
      '<button id="lobby-burst-open" type="button" hidden>Abrir janela de resposta Burst</button>',
      '<button id="lobby-burst-pass" type="button" hidden>Passar minha resposta ao Burst</button>',
      '<button id="lobby-burst-air-immunity" type="button" hidden>Reconhecer imunidade a Ar (Rex / Amuleto)</button>',
      '<section id="lobby-burst-equipment-panel">',
      '<p>Respostas válidas podem incluir revelar equipamento. Ataques normais NÃO podem ser usados em resposta. O equipamento só produzirá efeitos após uma futura resolução completa.</p>',
      '<button id="lobby-burst-queue-equipment" type="button" hidden>Declarar revelação de meu equipamento no Burst</button>',
      '<p id="lobby-burst-equipment-history" class="lobby-events">Nenhuma resposta de equipamento declarada.</p>',
      '</section>',
      '<p id="lobby-burst-history" class="lobby-events" aria-live="polite">Nenhuma resposta de Burst registrada.</p>',
      '<section id="lobby-burst-priority-preview" class="lobby-combat" hidden>',
      '<strong>⏳ Prioridade sucessiva — treinamento 1x1</strong>',
      '<p>Após a resposta inicial, o atacante e depois o defensor podem PASSAR a prioridade. Durante a própria prioridade também é possível registrar uma INTENÇÃO de Mugic; ela não é conjurada e deve ser cancelada antes do dano experimental.</p>',
      '<button id="lobby-burst-priority-open" type="button" hidden>Abrir rodada de prioridade</button>',
      '<button id="lobby-burst-priority-pass" type="button" hidden>Passar minha prioridade agora</button>',
      '<p id="lobby-burst-priority-history" class="lobby-events" aria-live="polite">Nenhuma rodada de prioridade aberta.</p>',
      '<section id="lobby-burst-mugic-preview" class="lobby-combat" hidden>',
      '<strong>🎵 Mugics — inspeção experimental (0.1.29)</strong>',
      '<p>Durante SUA prioridade, declare uma Mugic já presente no Deck 1x1 e no álbum. Isto NÃO conjura, consome fichas ou revela a carta ao adversário. Enquanto pendente, o dano e o próximo turno ficam bloqueados; cancele para continuar o treinamento.</p>',
      '<button id="lobby-burst-mugic-create" type="button" hidden>Declarar Canção da Criação (prévia)</button>',
      '<button id="lobby-burst-mugic-reject" type="button" hidden>Declarar Canção da Rejeição (prévia)</button>',
      '<button id="lobby-burst-mugic-cancel" type="button" hidden>Cancelar minha intenção Mugic</button>',
      '<p id="lobby-burst-mugic-history" class="lobby-events" aria-live="polite">Nenhuma intenção Mugic registrada.</p>',
      '<section id="lobby-burst-mugic-counter-preview" class="lobby-combat" hidden>',
      '<strong>🔁 Canção da Rejeição × Canção da Criação — revisão LIFO</strong>',
      '<p>Após Criação e Rejeição serem declaradas, ambos passam a prioridade para conferir uma contraposição hipotética. Para continuar, cancele as duas intenções ou valide o desconto APENAS no saldo de treinamento.</p>',
      '<button id="lobby-burst-mugic-counterplan" type="button" hidden>Simular contraposição Mugic (sem aplicar)</button>',
      '<p id="lobby-burst-mugic-counter-history" class="lobby-events" aria-live="polite">Nenhum contra-plano preparado.</p>',
      '<section id="lobby-mugic-tokens-panel" class="lobby-combat" hidden>',
      '<strong>🎟️ Fichas de Mugic — somente treinamento (v0.1.30)</strong>',
      '<p>Cada participante prepara suas fichas a partir da criatura original no Deck 1x1. Após Criação/Rejeição e o contra-plano, somente o atacante pode simular o pagamento. São descontados 1 e 2 pontos, respectivamente, sem tocar em fichas oficiais, cartas ou HP.</p>',
      '<button id="lobby-mugic-token-wallet-prepare" type="button" hidden>Preparar minhas fichas de treinamento</button>',
      '<button id="lobby-mugic-token-settle" type="button" hidden>Simular custos: Criação 1 / Rejeição 2</button>',
      '<p id="lobby-mugic-token-wallet-history" class="lobby-events" aria-live="polite">Sem carteira de treino.</p>',
      '<p id="lobby-mugic-token-settlement-history" class="lobby-events" aria-live="polite">Nenhum desconto de treino registrado.</p>',
      '<section id="lobby-ability-heal-panel" class="lobby-combat" hidden>',
      '<strong>🦁 Habilidades de energia — treino 1x1 (0.1.31)</strong>',
      '<p>Lion: +10 no HP atual e máximo próprio. Vidal: cura até 15. Xamã: cura até 10, sem ultrapassar o máximo. Cada uso gasta 1 ficha somente do treinamento; exige HP de teste preparado e ser a sua vez, antes de abrir um confronto/Burst. No máximo 1 ativação por jogador e turno.</p>',
      '<label for="lobby-ability-target">Alvo da habilidade:</label>',
      '<select id="lobby-ability-target"><option value="self">Minha criatura</option><option value="opponent">Criatura adversária (Vidal/Xamã)</option></select>',
      '<button id="lobby-ability-heal-activate" type="button" hidden>Ativar habilidade no HP de treinamento</button>',
      '<p id="lobby-ability-heal-history" class="lobby-events" aria-live="polite">Nenhuma habilidade ativada.</p>',
      '<section id="lobby-harp-token-panel" class="lobby-combat" hidden>',
      '<strong>🎼 Arpa Mágica — ficha de treinamento (v0.1.32)</strong>',
      '<p>Arpa Mágica ORIGINAL: ao descartar o equipamento equipado, ganha 1 ficha. Aqui o descarte é somente simulado e pode ocorrer uma vez por sala 1x1, após revelar a própria Arpa; nunca apaga sua carta nem altera fichas oficiais. Use antes de abrir Clash/Burst.</p>',
      '<button id="lobby-harp-token-activate" type="button" hidden>Descartar Arpa no treino (+1 ficha)</button>',
      '<p id="lobby-harp-token-history" class="lobby-events" aria-live="polite">Nenhuma Arpa usada no treinamento.</p>',
      '</section>',
      '<section id="lobby-3x3-allies-panel" class="lobby-combat" hidden>',
      '<strong>🛡️ Formação 3x3 — treinamento separado (0.1.35)</strong>',
      '<p>Congele as 3 criaturas originais do Deck 3x3 escolhido, posições c4-c6. Somente depois, Alakazaz pode transferir 1 ficha de seu próprio saldo para outra criatura aliada, uma vez por turno. Nenhum saldo/carta do combate oficial é alterado.</p>',
      '<label for="lobby-3x3-deck">Deck 3x3 salvo</label>',
      '<select id="lobby-3x3-deck"><option value="1">Deck 1</option><option value="2">Deck 2</option><option value="3">Deck 3</option></select>',
      '<button id="lobby-3x3-prepare" type="button" hidden>Preparar minhas três criaturas</button>',
      '<p id="lobby-3x3-allies-history" class="lobby-events" aria-live="polite">Formação ainda não preparada.</p>',
      '<p>Depois de congelar c4–c6, prepare os três valores de HP individuais a partir do DNA salvo no álbum. Sem ataque, movimento, derrota ou bônus de Local nesta etapa.</p>',
      '<button id="lobby-3x3-hp-prepare" type="button" hidden>Preparar HP das três criaturas (teste)</button>',
      '<p id="lobby-3x3-hp-history" class="lobby-events" aria-live="polite">HP de treino ainda não preparado.</p>',
      '<p>Após preparar o HP, posicione c4, c5 e c6 no seu próprio tabuleiro de SEIS hexágonos de treinamento. Escolha uma criatura e um destino adjacente vazio. Só 1 movimento por jogador e turno; colisão entre adversários e ataques ainda não existem.</p>',
      '<button id="lobby-3x3-board-prepare" type="button" hidden>Preparar tabuleiro 3x3 de treino</button>',
      '<p id="lobby-3x3-board-history" class="lobby-events" aria-live="polite">Tabuleiro não preparado.</p>',
      '<label for="lobby-3x3-move-unit">Criatura que anda (slot original)</label>',
      '<select id="lobby-3x3-move-unit"><option value="4">c4</option><option value="5">c5</option><option value="6">c6</option></select>',
      '<label for="lobby-3x3-move-destination">Hexágono de destino</label>',
      '<select id="lobby-3x3-move-destination"><option value="1">Hex 1</option><option value="2">Hex 2</option><option value="3">Hex 3</option><option value="4">Hex 4</option><option value="5">Hex 5</option><option value="6">Hex 6</option></select>',
      '<button id="lobby-3x3-move" type="button" hidden>Mover criatura no tabuleiro de treino</button>',
      '<p id="lobby-3x3-move-history" class="lobby-events" aria-live="polite">Nenhum movimento ainda.</p>',
      '<label for="lobby-3x3-receiver">Aliado que receberá 1 ficha:</label>',
      '<select id="lobby-3x3-receiver"></select>',
      '<button id="lobby-3x3-transfer" type="button" hidden>Alakazaz: transferir 1 ficha</button>',
      '<p id="lobby-3x3-transfer-history" class="lobby-events" aria-live="polite">Nenhuma transferência realizada.</p>',
      '</section>',
      '</section>',
      '</section>',
      '</section>',
      '</section>',
      '</section>',
      '<section id="lobby-burst-order-preview" hidden>',
      '<strong>🔁 Ordem de inspeção — Burst (somente teste)</strong>',
      '<p>A resposta do defensor é conferida antes do ataque. PASSAR não vira carta de resposta; Rex e Amuleto são passivos, não contra-ataques.</p>',
      '<button id="lobby-burst-order-prepare" type="button" hidden>Preparar sequência de verificação no servidor</button>',
      '<p id="lobby-burst-order-history" class="lobby-events" aria-live="polite">Nenhuma sequência preparada.</p>',
      '<section id="lobby-burst-equipment-effects-panel">',
      '<strong>🛡️ Aplicação experimental dos equipamentos</strong>',
      '<p>Após PASSAR, preparar a ordem inversa e iniciar o HP de teste com Local: Anel Precioso (−15 HP), Bastão da Sabedoria (+40 Sabedoria), Bomba de Fogo (+5 HP atual/máximo). Outros equipamentos aguardam implementação. Só altera o estado do treino, nunca o combate oficial.</p>',
      '<button id="lobby-burst-equipment-effect-apply" type="button" hidden>Aplicar efeito ao HP/atributos de TESTE</button>',
      '<p id="lobby-burst-equipment-effects-history" class="lobby-events">Nenhum efeito de treinamento resolvido.</p>',
      '</section>',
      '</section>',
      '</section>',
      '<section id="lobby-hp-ledger" class="lobby-combat" hidden>',
      '<strong>❤️ ENERGIA ACUMULADA — 1x1 (TESTE)</strong>',
      '<p>Saldo de HP independente, salvo no servidor. Exige Local sorteado e dois DNA preparados. Cada dano parcial altera APENAS o saldo hipotético; não é dano final, não altera HP real e não declara vitória.</p>',
      '<button id="lobby-hp-prepare" type="button" hidden>Iniciar HP de teste das duas criaturas</button>',
      '<p id="lobby-hp-summary" class="lobby-events">HP experimental ainda não iniciado.</p>',
      '<button id="lobby-hp-apply" type="button" hidden>Acumular dano hipotético deste turno</button>',
      '<p id="lobby-hp-events" class="lobby-events">Nenhum dano acumulado de teste.</p>',
      '</section>',
      '<section id="lobby-individual-preview" class="lobby-combat">',
      '<strong>🧬 PRÉVIA COM DNA INDIVIDUAL — 1x1</strong>',
      '<p>Simula dano com DNA, equipamentos e Locais após validar pagamento SOMENTE no treino. Se o equipamento declarado no Burst já teve seu efeito experimental aplicado, a prévia usa o HP/atributo experimental atualizado; antes disso o dano fica bloqueado. Dano final, HP oficial, cartas e recompensas não mudam.</p>',
      '<button id="lobby-individual-damage-calculate" type="button" hidden>Simular dano com DNA no servidor</button>',
      '<p id="lobby-individual-damage-history" class="lobby-events" aria-live="polite">Nenhuma simulação individual.</p>',
      '</section>',
      '<section id="lobby-resolution-audit" class="lobby-combat" hidden>',
      '<strong>🔍 AUDITORIA DO DANO FINAL — 1x1 (TESTE)</strong>',
      '<p>Identifica regras ainda não resolvidas para cada ataque. Mesmo que exista dano parcial, Burst, habilidades e outros efeitos podem modificar o resultado. Não ativa dano final, derrota ou vitória.</p>',
      '<button id="lobby-resolution-audit-capture" type="button" hidden>Verificar impedimentos de dano final no servidor</button>',
      '<p id="lobby-resolution-audit-history" class="lobby-events">Nenhuma auditoria registrada.</p>',
      '</section>',
      '<section id="lobby-effect-candidates-preview" class="lobby-combat" hidden>',
      '<strong>🌿⚡ EFEITOS CONDICIONAIS — 1x1 (TESTE)</strong>',
      '<p>Armadilha de Vinha, MÃO ELETRÔNICA e MÃO MÃO exigem dano FINAL positivo. Somente uma possibilidade é registrada; sem bloquear ataques, turnos ou compras.</p>',
      '<button id="lobby-effect-candidate-capture" type="button" hidden>Conferir gatilho condicional no servidor</button>',
      '<p id="lobby-effect-candidates-history" class="lobby-events">Nenhum efeito condicional registrado.</p>',
      '</section>',
      '<div id="lobby-reference-preview">',
      '<button id="lobby-damage-calculate" type="button" hidden>Conferir dano base no servidor</button>',
      '<p class="lobby-history-label">Prévia do dano (sem aplicar pontos de vida)</p>',
      '<p id="lobby-damage-history" class="lobby-events" aria-live="polite">Nenhum cálculo.</p>',
      '<button id="lobby-modifiers-calculate" type="button" hidden>Conferir bônus elementais e atributos</button>',
      '<p id="lobby-modifiers-history" class="lobby-events" aria-live="polite">Nenhuma conferência de bônus.</p>',
      '<button id="lobby-dice-roll" type="button" hidden>🎲 Rolar dado do Fogo Primordial (servidor)</button>',
      '<p id="lobby-dice-history" class="lobby-events" aria-live="polite">Nenhum dado rolado.</p>',
      '</div>',
      '<p class="lobby-history-label">Confrontos registrados</p>',
      '<p id="lobby-clash-history" class="lobby-events" aria-live="polite">Nenhum confronto registrado.</p>',
      '</section>',
      '<p class="lobby-history-label">📜 Histórico de turnos</p>',
      '<p id="lobby-events" class="lobby-events" aria-live="polite">Aguardando início.</p>',
      '<button id="lobby-turn-start" type="button" hidden>Iniciar teste de turnos</button>',
      '<button id="lobby-turn-pass" type="button" hidden>Passar meu turno</button>',
      '<button id="lobby-turn-stop" class="lobby-danger" type="button" hidden>Encerrar teste</button>',
      '<button id="lobby-turn-refresh" class="lobby-outline" type="button">Atualizar turnos</button>',
      '</section>',
      '<button id="lobby-copy" type="button">Copiar convite</button>',
      '<button id="lobby-refresh" type="button">Atualizar status</button>',
      '<button id="lobby-close" class="lobby-danger" type="button">Encerrar sala</button></div>',
      '<p id="lobby-notice" role="status" aria-live="polite"></p>',
      '<button id="lobby-back" class="lobby-outline" type="button">Voltar ao DROME</button>',
      '</div>'
    ].join("");
    // Usa por padrão os slots da linha correta no tabuleiro original.
    // Ataques usam a posição da carta no baralho (1–20), não a posição de criatura.
    function setDefaultCreatureSlot() {
      const slot=$("lobby-combat-slot");
      if(slot)slot.value=room?.mode==="1x1"?"6":room?.mode==="3x3"?"4":"1";
    }
    $("lobby-combat-kind").onchange = () => {
      if($("lobby-combat-kind").value==="creature")setDefaultCreatureSlot();
      else $("lobby-combat-slot").value="1";
    };
    $("lobby-create-btn").onclick = () => action(async () => {
      note("Criando sala...");
      const mode = $("lobby-select-mode").value;
      if (!["1x1","3x3","6x6"].includes(mode)) throw new Error("Modo inválido");
      room = await rpc("chaotic_create_lobby", { p_mode: mode });
      setDefaultCreatureSlot();
      updateRoomUI(); watch(); note("Sala criada. Compartilhe o código com outro jogador.");
    });
    $("lobby-join-btn").onclick = () => action(async () => {
      const code = $("lobby-input-code").value.trim().toUpperCase();
      if (!/^[A-F0-9]{12}$/.test(code)) throw new Error("Digite um código de 12 caracteres válido.");
      note("Entrando na sala...");
      room = await rpc("chaotic_join_lobby", { p_code: code });
      setDefaultCreatureSlot();
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
    $("lobby-turn-refresh").onclick = () => action(refreshRoom);
    $("lobby-loadout-capture").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      await rpc("chaotic_capture_preview_loadout",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshLoadouts();
      note("Ficha individual da criatura confirmada no servidor, com equipamento do deck.");
    });
    $("lobby-equipment-reveal").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      const result=await rpc("chaotic_reveal_preview_equipment",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshEquipmentReveals();
      note(result.equipment_name+" revelado no teste. Efeitos reais não foram ativados.");
    });
    $("lobby-hand-prepare").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const out=await rpc("chaotic_prepare_preview_hand",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshAttackResources();
      note("Baralho embaralhado no servidor: "+out.cards_in_hand+
        " cartas iniciais e "+out.points+" pontos de teste. Restante oculto.");
    });
    $("lobby-hand-sync").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const out=await rpc("chaotic_sync_preview_hand",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshAttackResources();
      note("Saldo experimental: "+out.available_points+
        " pontos"+(out.recycled?"; lixo reembaralhado no servidor":"")+
        (out.drew_card?"; uma carta comprada.":"; nenhuma carta comprada."));
    });
    $("lobby-hand-discard").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const slot=Number($("lobby-hand-discard-slot").value);
      if(!Number.isInteger(slot)||!handCards.some(x=>x.card_slot===slot&&x.card_state==="hand"))
        throw new Error("Escolha uma carta da sua mão de teste.");
      const out=await rpc("chaotic_discard_preview_attack",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,p_card_slot:slot
      });
      await refreshAttackResources();
      note("Carta do slot "+out.discarded_slot+" enviada ao lixo de teste. Nenhum ponto gasto.");
    });
    $("lobby-hand-spend").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const out=await rpc("chaotic_spend_preview_attack",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshAttackResources();
      note("Ataque "+out.attack_name+" pago apenas no teste: -"+out.spent_cost+
        " ponto(s). Restantes: "+out.points_left+". O combate oficial não foi alterado.");
    });
    $("lobby-attack-instance-capture").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      const result=await rpc("chaotic_capture_preview_attack",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshAttackInstances();
      note("Ataque "+result.attack_name+" vinculado à carta individual #"+
        result.attack_instance_id+". Dano real permanece desligado.");
    });
    $("lobby-hex-place").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId)return;
      await rpc("chaotic_place_preview_creature",{p_lobby_id:room.id,p_expected_turn:match.turn_no});
      await refreshBoard();
      note("Criatura posicionada no tabuleiro de teste. Agora pode passar a vez.");
    });
    $("lobby-hex-move").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId)return;
      const target=Number($("lobby-hex-destination").value);
      if(!Number.isInteger(target) || target<1 || target>6)throw Error("Escolha um hexágono válido.");
      await rpc("chaotic_move_preview_creature",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,p_target_slot:target
      });
      await refreshBoard();
      note("Movimento aceito pelo servidor. A criatura mudou de posição.");
    });
    $("lobby-dice-roll").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId)return;
      const outcome=await rpc("chaotic_roll_preview_die",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshDice();
      note("Dado autorizado pelo servidor: "+outcome.rolled_value+
        ". Valor único registrado para os dois jogadores, sem alterar energia.");
    });
    $("lobby-modifiers-calculate").onclick = () => action(async()=>{
      if(!room||!match||match.status!=="active"||match.current_player!==userId)return;
      const result=await rpc("chaotic_preview_calculate_modifiers",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshModifiers();
      note(result.formula_status==="reference_only"
        ?"Bônus de catálogo conferidos; ainda não é dano final e não altera energia."
        :"Carta com efeitos ou referência incompleta: dano final não calculado.");
    });
    $("lobby-location-capture").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      const loc=await rpc("chaotic_capture_preview_room_location",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshRoomLocations();
      note("Local do Deck sorteado no servidor: "+loc.location_name+
        ". Atributo da iniciativa preparado; efeitos reais desligados.");
    });
    $("lobby-initiative-preview-calculate").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      const r=await rpc("chaotic_capture_preview_initiative",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshInitiatives();
      note("Iniciativa de teste ("+
        ({s:"Sabedoria",p:"Poder",v:"Velocidade",c:"Coragem"}[r.attribute_code]||"Atributo")+
        "): "+r.attacker_value+" × "+r.defender_value+
        ". A vez real e os pontos permanecem iguais.");
    });
    $("lobby-individual-damage-calculate").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      const result=await rpc("chaotic_calculate_individual_preview",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshIndividualDamage();
      note(result.calculation_status==="partial_estimate"
        ?"Simulação de dano com DNA individual registrada no servidor. Nenhuma energia real foi alterada."
        :"Ataque especial identificado. A simulação NÃO informa dano final sem resolver seu efeito.");
    });
    $("lobby-burst-open").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      await rpc("chaotic_open_preview_burst",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstWindows();
      note("Janela Burst de teste aberta. Aguardando PASSAR do defensor. Nenhum dano final.");
    });
    $("lobby-burst-pass").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1")return;
      const result=await rpc("chaotic_pass_preview_burst",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstWindows();
      note(result.status==="defender_passed"
        ?"Resposta PASSAR registrada no servidor. O Burst completo ainda NÃO foi resolvido."
        :"Resposta não confirmada.");
    });
    $("lobby-burst-priority-open").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      await rpc("chaotic_open_preview_burst_priority",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstPriority();
      note("Prioridade aberta. Atacante deve PASSAR, depois defensor. Nada é aplicado ao combate oficial.");
    });
    $("lobby-burst-priority-pass").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1")return;
      const state=await rpc("chaotic_pass_preview_burst_priority",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstPriority();
      note(state.priority_status==="closed_preview"
        ?"Os dois jogadores passaram a prioridade. Inspeção Burst disponível; dano final continua pendente."
        :"Prioridade passada. Aguardando PASSAR do defensor.");
    });
    for(const [buttonId,catalogId] of [["lobby-burst-mugic-create","301"],
      ["lobby-burst-mugic-reject","302"]]){
      $(buttonId).onclick = () => action(async()=>{
        if(!room||!match||room.mode!=="1x1")return;
        const result=await rpc("chaotic_queue_preview_burst_mugic",{
          p_lobby_id:room.id,p_expected_turn:match.turn_no,p_catalog_mugic_id:catalogId
        });
        await refreshBurstMugicIntents();
        note(result.mugic_name+" declarada como INTENÇÃO de teste. "+
          "Ainda não foi conjurada, não gasta fichas e bloqueia dano até cancelar.");
      });
    }
    $("lobby-3x3-prepare").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="3x3")return;
      const result=await rpc("chaotic_prepare_preview_3x3_allies",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,
        p_deck_slot:Number($("lobby-3x3-deck").value)
      });
      await refresh3x3Allies();
      note("Formação congelada: "+result.count+" criaturas no Deck 3x3, somente no treinamento.");
    });
    $("lobby-3x3-hp-prepare").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="3x3")return;
      const result=await rpc("chaotic_prepare_preview_3x3_hp",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refresh3x3Allies();
      note("HP inicializado individualmente em "+result.count+
        " criaturas c4–c6. Nenhum dano, HP oficial ou bônus de Local aplicado.");
    });
    $("lobby-3x3-board-prepare").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="3x3")return;
      const result=await rpc("chaotic_prepare_preview_3x3_board",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refresh3x3Allies();
      note("Tabuleiro experimental iniciado: "+result.creatures+
        " criaturas no seu lado. Hex 1-6 não altera a posição oficial.");
    });
    $("lobby-3x3-move").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="3x3")return;
      const unit=Number($("lobby-3x3-move-unit").value);
      const destination=Number($("lobby-3x3-move-destination").value);
      if(![4,5,6].includes(unit)||![1,2,3,4,5,6].includes(destination))
        throw new Error("Escolha uma criatura e hexágono válidos.");
      const moved=await rpc("chaotic_move_preview_3x3_unit",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,
        p_formation_slot:unit,p_target_hex:destination
      });
      await refresh3x3Allies();
      note("Movimento experimental c"+moved.formation_slot+": hex "+
        moved.from_hex+" → "+moved.to_hex+
        ". Sem dano ou movimento no combate oficial.");
    });
    $("lobby-3x3-transfer").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="3x3")return;
      const slot=Number($("lobby-3x3-receiver").value);
      if(![4,5,6].includes(slot))throw new Error("Escolha um campeão aliado válido");
      const result=await rpc("chaotic_transfer_preview_alakazaz_token",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,
        p_receiver_position:slot
      });
      await refresh3x3Allies();
      note("Alakazaz transferiu 1 ficha de TREINAMENTO para c"+
        result.receiver_position+". Fichas do combate oficial intactas.");
    });
    $("lobby-harp-token-activate").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const state=await rpc("chaotic_discard_preview_harp_for_token",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshMugicTrainingTokens();
      await refreshHarpTrainingEvents();
      note("Arpa Mágica DESCARTADA APENAS NO TREINO: fichas "+
        state.tokens_before+"→"+state.tokens_after+
        ". O equipamento original, o álbum e o Deck não foram modificados.");
    });
    $("lobby-ability-heal-activate").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const opponent=userId===room.host_id?room.guest_id:room.host_id;
      const targetId=$("lobby-ability-target").value==="opponent"?opponent:userId;
      const result=await rpc("chaotic_apply_preview_ability_heal",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,p_target_actor_id:targetId
      });
      await refreshHpLedger();
      await refreshMugicTrainingTokens();
      await refreshTrainingAbilities();
      note(result.source_creature_name+" ativou habilidade de treino: fichas "+
        result.tokens_before+"→"+result.tokens_after+", energia "+
        result.hp_before+"→"+result.hp_after+
        " (máximo "+result.hp_max_before+"→"+result.hp_max_after+
        "). Nenhuma alteração no combate oficial.");
    });
    $("lobby-mugic-token-wallet-prepare").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="1x1")return;
      const state=await rpc("chaotic_prepare_preview_mugic_token_wallet",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshMugicTrainingTokens();
      note(state.creature_name+": fichas no treinamento "+
        state.remaining_tokens+"/"+state.starting_tokens+". Sem alterar o jogo oficial.");
    });
    $("lobby-mugic-token-settle").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const result=await rpc("chaotic_simulate_preview_mugic_counter_cost",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstMugicIntents();
      await refreshMugicTrainingTokens();
      note("Pagamento apenas no treino: Criação "+
        result.attacker_tokens_before+"→"+result.attacker_tokens_after+
        "; Rejeição "+result.defender_tokens_before+"→"+
        result.defender_tokens_after+". Nenhuma carta ou ficha oficial consumida.");
    });
    $("lobby-burst-mugic-counterplan").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const result=await rpc("chaotic_prepare_preview_mugic_counterplan",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstMugicCounterplans();
      note("Ordem LIFO conferida: Rejeição → Criação. Sem validar saldo de fichas, sem conjurar, sem cancelar de verdade nem alterar HP.");
    });
    $("lobby-burst-mugic-cancel").onclick=()=>action(async()=>{
      if(!room||!match||room.mode!=="1x1")return;
      await rpc("chaotic_cancel_preview_burst_mugic",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstMugicIntents();
      note("Intenção Mugic cancelada. Sem custos. O treinamento pode retomar após os passes.");
    });
    $("lobby-burst-air-immunity").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1")return;
      const result=await rpc("chaotic_acknowledge_preview_air_immunity",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstWindows();
      note("Imunidade a Ar registrada: "+
        (result.defensive_immunity_source==="rex_air"?"Rex":"Amuleto do Vácuo")+
        ". Não altera dano final, HP real ou efeitos oficiais.");
    });
    $("lobby-burst-queue-equipment").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1")return;
      const r=await rpc("chaotic_queue_preview_burst_equipment",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstEquipmentResponses();
      note("Revelação de "+r.equipment_name+
        " declarada no servidor, mas NÃO EXECUTADA. Você ainda deve PASSAR no Burst.");
    });
    $("lobby-burst-order-prepare").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const r=await rpc("chaotic_prepare_preview_burst_order",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBurstOrderPlans();
      note("Ordem de inspeção preparada em "+r.inspection_step_count+
        " etapa(s). Nenhuma ação executada ou dano oficial confirmado.");
    });
    $("lobby-burst-equipment-effect-apply").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const r=await rpc("chaotic_apply_preview_burst_equipment_effect",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshHpLedger();
      await refreshBurstEquipmentEffects();
      await refreshBurstEquipmentResponses();
      note(r.equipment_name+" aplicado ao TREINO: HP "+r.hp_before+" → "+r.hp_after+
        ", Sabedoria "+r.wisdom_before+" → "+r.wisdom_after+
        ". HP oficial e cartas originais intactos.");
    });
    $("lobby-resolution-audit-capture").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const r=await rpc("chaotic_audit_preview_damage",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshResolutionAudits();
      note("Auditoria concluída: "+r.blocker_count+
        " regra(s) pendentes. Dano final NÃO certificado e HP oficial intacto.");
    });
    $("lobby-hp-prepare").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const r=await rpc("chaotic_prepare_preview_hp",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshHpLedger();
      note("HP hipotético iniciado: "+r.host_hp+" × "+r.guest_hp+
        ". Não altera HP oficial nem conclui combate.");
    });
    $("lobby-hp-apply").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.current_player!==userId)return;
      const r=await rpc("chaotic_apply_preview_hp_projection",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshHpLedger();
      note("HP de TESTE atualizado: "+r.hp_before+" → "+r.hp_after+
        ". Dano final NÃO verificado. HP real e turnos intactos.");
    });
    $("lobby-effect-candidate-capture").onclick = () => action(async()=>{
      if(!room||!match||room.mode!=="1x1"||match.status!=="active"
        ||match.current_player!==userId)return;
      const result=await rpc("chaotic_capture_preview_effect_candidate",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshEffectCandidates();
      note("Efeito "+result.effect_code+" registrado como possibilidade, NÃO aplicado. "+
        "O bloqueio exige dano final confirmado.");
    });
    $("lobby-damage-calculate").onclick = () => action(async()=>{
      if(!room||!match||match.status!=="active"||match.current_player!==userId)return;
      const result=await rpc("chaotic_preview_calculate_base_damage",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshBaseDamage();
      note(result.calculation_status==="base_only"
        ?"Dano BASE conferido pelo servidor. Efeitos e dano final ainda NÃO aplicados."
        :"Cálculo suspenso: referência de carta ambígua ou desconhecida. Nenhuma carta foi alterada.");
    });
    $("lobby-clash-open").onclick = () => action(async()=>{
      if(!room||!match||match.status!=="active"||match.current_player!==userId)return;
      await rpc("chaotic_open_preview_clash",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no
      });
      await refreshClashes();
      note("Encontro validado e registrado no servidor. A resolução de danos segue em desenvolvimento.");
    });
    $("lobby-combat-submit").onclick = () => action(async()=>{
      if(!room || !match || match.status!=="active" || match.current_player!==userId) return;
      const kind=$("lobby-combat-kind").value;
      const deck=Number($("lobby-combat-deck").value);
      const slot=Number($("lobby-combat-slot").value);
      if(!["creature","attack"].includes(kind) || ![1,2,3].includes(deck)
        || !Number.isInteger(slot) || slot<1 || slot>20) {
        throw new Error("Escolha uma ação e posições válidas.");
      }
      const chosen=await rpc("chaotic_declare_combat_action",{
        p_lobby_id:room.id,p_expected_turn:match.turn_no,p_kind:kind,
        p_deck_slot:deck,p_card_slot:slot
      });
      await refreshDeclarations();
      note("Servidor registrou "+(chosen.kind==="creature"?"criatura ":"ataque ")+"#"+chosen.card_id
        +". Agora você pode passar o turno.");
    });
    $("lobby-turn-start").onclick = () => action(async () => {
      if (!room || room.host_id !== userId || room.status !== "ready") return;
      match = await rpc("chaotic_start_match", { p_lobby_id: room.id });
      updateMatchUI();
      await refreshHistory();
      note("Teste de turnos iniciado. O anfitrião começa.");
    });
    $("lobby-turn-pass").onclick = () => action(async () => {
      if (!room || !match || match.status !== "active" || match.current_player !== userId) return;
      // O servidor rejeita turnos antigos e ações de quem não está jogando.
      match = await rpc("chaotic_pass_turn", { p_lobby_id: room.id, p_expected_turn: match.turn_no });
      updateMatchUI();
      await refreshHistory();
      note("Turno registrado. O outro jogador já pode agir.");
    });
    $("lobby-turn-stop").onclick = () => action(async () => {
      if (!room || match?.status !== "active") return;
      match = await rpc("chaotic_stop_match", { p_lobby_id: room.id });
      updateMatchUI();
      await refreshHistory();
      note("Teste encerrado sem alterar cartas nem estatísticas.");
    });
    $("lobby-close").onclick = () => action(async () => {
      if (!room) return;
      const method = room.host_id === userId ? "chaotic_close_lobby" : "chaotic_leave_lobby";
      const success = await rpc(method, { p_id: room.id });
      if (!success) throw new Error("A sala já pode ter sido encerrada. Atualize.");
      halt(); room = null; match = null; updateRoomUI(); note("Você saiu da sala.");
    });
    $("lobby-back").onclick = () => {
      halt();
      if (room && room.status !== "cancelled") {
        note("Use Encerrar/Sair da sala antes de voltar.", true);
        return;
      }
      if (typeof window.abrirEntradaDrome === "function") window.abrirEntradaDrome();
    };
    updateMatchUI();
    note("Salas privadas expiram após duas horas.");
  }
  window.abrirSalaPrivadaDrome = show;
})();