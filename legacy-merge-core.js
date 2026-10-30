// Pure, side-effect free migration utilities for a player's original Firebase cards.
export function listAlbum(raw) {
  if (Array.isArray(raw)) return raw.filter(x => x != null && typeof x === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(x=>x && typeof x==="object");
  return [];
}
function stable(value) {
  if (Array.isArray(value)) return "["+value.map(stable).join(",")+"]";
  if (value && typeof value === "object")
    return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
  return JSON.stringify(value);
}
export function mergeAlbum(current,legacy) {
  const existing=listAlbum(current),old=listAlbum(legacy);
  const seen=new Set(existing.map(stable));
  const result=existing.map(x=>structuredClone(x));
  let added=0;
  for(const card of old) {
    const fingerprint=stable(card);
    if(!seen.has(fingerprint)) {
      result.push(structuredClone(card));
      seen.add(fingerprint);added++;
    }
  }
  return {cards:result,added,alreadyPresent:old.length-added,originalCount:existing.length,legacyCount:old.length};
}
export function normalizeDecks(raw) {
  if (!raw || typeof raw!=="object" || Array.isArray(raw)) return {};
  const result={};
  for(const [name,deck] of Object.entries(raw)) {
    const match=/^(1x1|3x3|6x6)_(?:slot_)?([123])$/.exec(name);
    if(match && deck && typeof deck==="object") {
      const key=match[1]+"_slot_"+match[2];
      if(!(key in result) || name===key)result[key]=structuredClone(deck);
    }
  }
  return result;
}
export function selectMissingDecks(legacyDecks,currentDecks) {
  const legacy=normalizeDecks(legacyDecks);
  const current=normalizeDecks(currentDecks);
  const missing={};
  for (const [name,deck] of Object.entries(legacy)) {
    if (!(name in current)) missing[name]=deck;
  }
  return {missing,existingCount:Object.keys(current).length,foundCount:Object.keys(legacy).length,
    skipped:Object.keys(legacy).length-Object.keys(missing).length};
}
