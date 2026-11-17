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
    // Mobile players can retry an offline/expired read without leaving DROME.
    // This action only re-reads RLS-protected records; it never settles a match.
    let retry=$("lobby-rewards-retry");
    if(!retry){
      retry=document.createElement("button");
      retry.id="lobby-rewards-retry";
      retry.type="button";
      retry.className="lobby-outline";
      retry.textContent="Atualizar extrato";
      retry.style.cssText="margin:8px 0;min-height:44px";
      if(typeof retry.addEventListener==="function") retry.addEventListener("click",()=>refresh());
      else retry.onclick=()=>refresh();
      if(typeof status.insertAdjacentElement==="function") status.insertAdjacentElement("afterend",retry);
      else if(status.parentNode?.insertBefore) status.parentNode.insertBefore(retry,status.nextSibling);
    }
    const request=++serial;
    const {playerId,api}=currentIdentity();
    summary.textContent="";
    let recentSummary="", totalSummary="";
    const renderSummary=()=>{ summary.textContent=[totalSummary,recentSummary].filter(Boolean).join(" "); };
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
        .select("id,player_id,award_kind,xp_awarded,coins_awarded,awarded_at,reward_scope")
        .eq("player_id",playerId)
        .order("awarded_at",{ascending:false}).order("id",{ascending:false}).limit(20);
      if(request!==serial||$("lobby-rewards-list")!==list||(currentIdentity().playerId!==playerId||currentIdentity().api!==api))return;
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
          if(request!==serial||$("lobby-rewards-list")!==list||(currentIdentity().playerId!==playerId||currentIdentity().api!==api))return;
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
          totalSummary="Total oficial registrado no servidor: "+
            format(xp)+" XP e "+format(coins)+" moedas em "+
            format(count)+" lançamento(s).";
          renderSummary();
        }).catch(()=>{ /* Offline: do not invent a total or clear recent receipts. */ });
      }
      // Career counters are computed by an authenticated, RLS-scoped server RPC.
      // Never infer a win from a pending result or from a local training match.
      if(typeof api.rpc==="function"){
        try { Promise.resolve(api.rpc("chaotic_my_official_career_by_mode")).then(response=>{
          if(request!==serial||$("lobby-rewards-list")!==list
            ||(currentIdentity().playerId!==playerId||currentIdentity().api!==api))return;
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
        if(request!==serial||(currentIdentity().playerId!==playerId||currentIdentity().api!==api)){
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
      recentSummary="Somente os últimos "+records.length+" lançamentos: "+
        format(xp)+" XP e "+format(coins)+" moedas. Limite: 20 lançamentos.";
      renderSummary();
      // Mobile receipt history: paginate older RLS-protected records on demand.
      // The all-time balance remains the server RPC, never the visible page sum.
      // Use a stable (timestamp, UUID) cursor: new rewards cannot shift old pages.
      // Cursor follows the last raw server row, including any row rejected by
      // display validation. This avoids repeating earlier receipts on page 2.
      let cursor=Array.isArray(data)&&data.length ? data[data.length-1] : null;
      const seenReceiptIds=new Set(records.map(entry=>entry.id).filter(Boolean));
      const more=document.createElement("button");
      more.type="button";
      more.className="lobby-outline";
      more.textContent="Carregar lançamentos anteriores";
      const appendReceipt=entry=>{
        const div=document.createElement("div");
        div.className="lobby-reward-entry";
        div.style.cssText="border:1px solid #587390;border-radius:8px;padding:9px;margin:6px 0;color:#dbeaff;font-size:12px;overflow-wrap:anywhere";
        const date=new Date(entry.awarded_at);
        const when=Number.isFinite(date.getTime())?date.toLocaleString("pt-BR"):"Data indisponível";
        div.textContent=(entry.award_kind==="official_victory"?"Vitória oficial":"Participação oficial")+
          " · +"+format(entry.xp_awarded)+" XP · +"+format(entry.coins_awarded)+" moedas · "+when;
        list.appendChild(div);
      };
      more.onclick=async()=>{
        if(more.disabled)return;
        more.disabled=true;
        more.textContent="Consultando histórico...";
        try{
          const response=await api.from("chaotic_official_reward_ledger")
            .select("id,player_id,award_kind,xp_awarded,coins_awarded,awarded_at,reward_scope")
            .eq("player_id",playerId)
            .order("awarded_at",{ascending:false}).order("id",{ascending:false})
            .or("awarded_at.lt."+cursor.awarded_at+",and(awarded_at.eq."+cursor.awarded_at+",id.lt."+cursor.id+")")
            .limit(20);
          if(request!==serial||(currentIdentity().playerId!==playerId||currentIdentity().api!==api)
            ||currentIdentity().api!==api||$("lobby-rewards-list")!==list)return;
          if(response.error)throw response.error;
          const page=Array.isArray(response.data)?response.data:[];
          const valid=page.filter(entry=>entry&&entry.player_id===playerId
            &&entry.reward_scope==="official_verified_only"
            &&["official_victory","official_participation"].includes(entry.award_kind)
            &&[entry.xp_awarded,entry.coins_awarded].every(n=>
              Number.isSafeInteger(n)&&n>=0&&n<=10000)
            &&(entry.xp_awarded>0||entry.coins_awarded>0));
          more.remove();
          // A repeated row must never be rendered twice, even when the server
          // returns an overlapping page during a mobile reconnect.
          for(const entry of valid){
            if(!entry.id||seenReceiptIds.has(entry.id))continue;
            seenReceiptIds.add(entry.id);
            appendReceipt(entry);
          }
          if(page.length){
            const next=page[page.length-1];
            if(typeof next.id==="string" && next.id.length>0 &&
              typeof next.awarded_at==="string" && next.awarded_at.length>0){
              cursor=next;
              if(page.length===20)list.appendChild(more);
            }
          }
        }catch(_error){
          if(request===serial&&currentIdentity().playerId===playerId&&currentIdentity().api===api){
            more.textContent="Falha na consulta — tentar novamente";
          }
        }finally{more.disabled=false;}
      };
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
      if(records.length===20)list.appendChild(more);
    }catch(_error){
      if(request!==serial||$("lobby-rewards-list")!==list||(currentIdentity().playerId!==playerId||currentIdentity().api!==api))return;
      status.textContent="Não foi possível acessar o extrato. Confira sua conexão e tente novamente.";
      summary.textContent="";
      list.replaceChildren();
    }
  }
  window.ChaoticOfficialRewards={refresh};
})();
