// Chaotic GO v0.1.131 — official reward receipts, authenticated read-only.
// This panel never calculates rewards from a DROME match or the editable profile.
(function(){
  "use strict";
  // Resolve identity per refresh: mobile login/logout can change without a page reload.
  const currentIdentity=()=>({playerId:window.ChaoticAuthUser?.id,
    api:window.ChaoticAuth?.getClient?.()});
  let serial=0;
  const $=id=>document.getElementById(id);
  const format=n=>Number(n).toLocaleString("pt-BR");
  async function refresh(){
    const status=$("lobby-rewards-status");
    const summary=$("lobby-rewards-summary");
    const list=$("lobby-rewards-list");
    if(!status||!summary||!list)return;
    const request=++serial;
    const {playerId,api}=currentIdentity();
    summary.textContent="";
    list.replaceChildren();
    // Remove any provenance section from a prior refresh.
    if(list.parentNode?.querySelectorAll){
      for(const section of [...list.parentNode.querySelectorAll('section[aria-label="Resultados oficiais do servidor"]')])section.remove();
      for(const section of [...list.parentNode.querySelectorAll('section[aria-label="Carreira oficial por modo"]')])section.remove();
    }
    if(!playerId||!api){
      status.textContent="Entre na sua conta para consultar o extrato.";
      return;
    }
    status.textContent="Consultando lançamentos oficiais protegidos no servidor...";
    try{
      // RLS exposes only this player's receipts. Authenticated SELECT only.
      const {data,error}=await api.from("chaotic_official_reward_ledger")
        .select("player_id,award_kind,xp_awarded,coins_awarded,awarded_at,reward_scope")
        .eq("player_id",playerId)
        .order("awarded_at",{ascending:false}).limit(20);
      if(request!==serial||$("lobby-rewards-list")!==list||currentIdentity().playerId!==playerId)return;
      if(error)throw error;
      const records=(Array.isArray(data)?data:[]).filter(entry=>
        entry&&entry.player_id===playerId
        &&entry.reward_scope==="official_verified_only"
        &&["official_victory","official_participation"].includes(entry.award_kind)
        &&[entry.xp_awarded,entry.coins_awarded].every(n=>
           Number.isSafeInteger(n)&&n>=0&&n<=10000)
        &&(entry.xp_awarded>0||entry.coins_awarded>0));
      // Read the authoritative ALL-TIME balance independently of the last
      // 20 receipts. A stale RPC can never repaint a newer DROME screen.
      if(typeof api.rpc==="function"){
        api.rpc("chaotic_my_official_reward_totals").then(response=>{
          if(request!==serial||$("lobby-rewards-list")!==list||currentIdentity().playerId!==playerId)return;
          if(response?.error)return; // Keep the verified recent view.
          const raw=Array.isArray(response?.data)?response.data[0]:response?.data;
          if(!raw)return;
          // Null/missing values must not be coerced into a fictitious zero balance.
          if(!["total_xp","total_coins","settled_matches"].every(key =>
            raw[key] !== null && raw[key] !== undefined &&
            raw[key] !== "" && typeof raw[key] !== "boolean"))return;
          const xp=Number(raw.total_xp), coins=Number(raw.total_coins);
          const count=Number(raw.settled_matches);
          if(![xp,coins,count].every(n=>Number.isSafeInteger(n)&&n>=0))return;
          const recent=summary.textContent;
          summary.textContent="Total oficial registrado no servidor: "+
            format(xp)+" XP e "+format(coins)+" moedas em "+
            format(count)+" lançamento(s)."+
            (recent?" "+recent:"");
        }).catch(()=>{ /* Offline: do not invent a total or clear recent receipts. */ });
      }
      // Career counters are computed by an authenticated, RLS-scoped server RPC.
      // Never infer a win from a pending result or from a local training match.
      if(typeof api.rpc==="function"){
        try { Promise.resolve(api.rpc("chaotic_my_official_career_by_mode")).then(response=>{
          if(request!==serial||$("lobby-rewards-list")!==list
            ||currentIdentity().playerId!==playerId)return;
          if(response?.error||!Array.isArray(response?.data))return;
          const expected=["1x1","3x3","6x6"];
          const rows=response.data;
          // Require exactly one complete, non-null server row per mode.
          // Number(null) === 0 would otherwise invent clean career statistics.
          if(rows.length!==3||!expected.every(mode=>
            rows.filter(row=>row?.mode===mode).length===1))return;
          if(!rows.every(row=>["victories","defeats","pending"].every(key=>
            row[key]!==null && row[key]!==undefined && row[key]!=="" &&
            typeof row[key]!=="boolean" &&
            Number.isSafeInteger(Number(row[key])) && Number(row[key])>=0)))return;
          const previous=list.parentNode?.querySelector(
            'section[aria-label="Carreira oficial por modo"]');
          previous?.remove();
          if(!list.parentNode||typeof document.createElement!=="function")return;
          const section=document.createElement("section");
          section.setAttribute("aria-label","Carreira oficial por modo");
          const heading=document.createElement("p");
          heading.textContent="Carreira oficial por modo (servidor)";
          heading.style.fontWeight="bold";
          section.appendChild(heading);
          for(const mode of expected){
            const row=rows.find(item=>item.mode===mode);
            const p=document.createElement("p");
            p.textContent=mode+" · "+format(row.victories)+" vitória(s) · "+
              format(row.defeats)+" derrota(s) · "+format(row.pending)+
              " pendente(s), sem premiação";
            section.appendChild(p);
          }
          list.parentNode.insertBefore(section,list);
        }).catch(()=>{ /* Offline: never invent career statistics. */ });
        } catch (_careerError) { /* Optional career RPC must not hide validated reward receipts. */ }
      }
      // Show the server's provenance separately from paid rewards. A pending
      // result is never a victory, and cannot increase XP or currency.
      if(list.parentNode?.insertBefore && typeof document.createElement==="function"){
      const provenance=document.createElement("section");
      provenance.setAttribute("aria-label","Resultados oficiais do servidor");
      const provenanceTitle=document.createElement("p");
      provenanceTitle.textContent="Resultados oficiais — verificação do servidor";
      provenanceTitle.style.fontWeight="bold";
      provenance.appendChild(provenanceTitle);
      const provenanceStatus=document.createElement("p");
      provenanceStatus.textContent="Consultando resultados...";
      provenance.appendChild(provenanceStatus);
      list.parentNode.insertBefore(provenance,list);
      try{
        const {data:matches,error:matchesError}=await api
          .from("chaotic_official_match_results")
          .select("id,host_id,guest_id,mode,winner_id,result_state,verification_source,created_at,verified_at")
          .or("host_id.eq."+playerId+",guest_id.eq."+playerId)
          .order("created_at",{ascending:false}).limit(10);
        if(request!==serial||currentIdentity().playerId!==playerId){
          provenance.remove();return;
        }
        if(matchesError)throw matchesError;
        const safe=(Array.isArray(matches)?matches:[]).filter(m=>
          m&&(m.host_id===playerId||m.guest_id===playerId)
          &&["1x1","3x3","6x6"].includes(m.mode));
        provenanceStatus.textContent=safe.length
          ?"Últimos "+safe.length+" registro(s); pendentes não contam como vitórias."
          :"Nenhuma partida oficial registrada pelo motor.";
        for(const m of safe){
          const verified=m.result_state==="verified"
            &&m.verification_source==="official_engine_v1"
            &&m.verified_at&&[m.host_id,m.guest_id].includes(m.winner_id);
          const label=verified?(m.winner_id===playerId?"Vitória verificada":"Derrota verificada")
            :"Pendente de verificação oficial";
          const p=document.createElement("p");
          p.textContent=m.mode+" · "+label+" · "+
            (Number.isFinite(new Date(m.created_at).getTime())
              ?new Date(m.created_at).toLocaleString("pt-BR"):"Data indisponível");
          provenance.appendChild(p);
        }
      }catch(_err){
        if(request===serial&&currentIdentity().playerId===playerId)
          provenanceStatus.textContent="Não foi possível consultar os resultados oficiais.";
      }
      }
      if(!records.length){
        status.textContent="Nenhuma recompensa oficial lançada neste extrato. Treinos 3×3 não geram XP nem moedas oficiais.";
        return;
      }
      status.textContent="Lançamentos oficiais registrados no servidor (não representam o saldo total legado).";
      const xp=records.reduce((sum,x)=>sum+x.xp_awarded,0);
      const coins=records.reduce((sum,x)=>sum+x.coins_awarded,0);
      summary.textContent="Somente os últimos "+records.length+" lançamentos: "+
        format(xp)+" XP e "+format(coins)+" moedas. Limite: 20 lançamentos.";
      for(const entry of records){
        const div=document.createElement("div");
        div.className="lobby-reward-entry";
        div.style.cssText="border:1px solid #587390;border-radius:8px;padding:9px;margin:6px 0;color:#dbeaff;font-size:12px;overflow-wrap:anywhere";
        const date=new Date(entry.awarded_at);
        const when=Number.isFinite(date.getTime())?date.toLocaleString("pt-BR"):"Data indisponível";
        div.textContent=(entry.award_kind==="official_victory"?"Vitória oficial":"Participação oficial")+
          " · +"+format(entry.xp_awarded)+" XP · +"+format(entry.coins_awarded)+" moedas · "+when;
        list.appendChild(div);
      }
    }catch(_error){
      if(request!==serial||$("lobby-rewards-list")!==list||currentIdentity().playerId!==playerId)return;
      status.textContent="Não foi possível acessar o extrato. Confira sua conexão e tente novamente.";
      summary.textContent="";
      list.replaceChildren();
    }
  }
  window.ChaoticOfficialRewards={refresh};
})();
