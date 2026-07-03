(function(global){
  'use strict';
  var STORAGE_KEY_PREFIX='raidSheet:';
  var DATA_VERSION=4;
  var SOFT_RESERVE_KEY='soft-reserve-url';
  function isPlainObject(value){ return !!(value && typeof value === 'object' && !Array.isArray(value)); }
  function getEmptyRoster(){ return {groups:{},singles:{},meta:{}}; }
  function normalizeRosterShape(roster){
    var normalized={
      groups:isPlainObject(roster&&roster.groups)?roster.groups:{},
      singles:isPlainObject(roster&&roster.singles)?roster.singles:{},
      meta:isPlainObject(roster&&roster.meta)?roster.meta:{}
    };
    if(Object.prototype.hasOwnProperty.call(normalized.singles,SOFT_RESERVE_KEY)){
      if(!Object.prototype.hasOwnProperty.call(normalized.meta,SOFT_RESERVE_KEY)){
        normalized.meta[SOFT_RESERVE_KEY]=normalized.singles[SOFT_RESERVE_KEY];
      }
      delete normalized.singles[SOFT_RESERVE_KEY];
    }
    return normalized;
  }
  function parseRoster(raw){
    if(!raw) return getEmptyRoster();
    try {
      var parsed=JSON.parse(raw);
      if(parsed && parsed.version && parsed.payload){
        return normalizeRosterShape({groups:parsed.payload.groups, singles:parsed.payload.singles, meta:parsed.payload.meta});
      }
      return normalizeRosterShape(parsed);
    } catch(e){ return getEmptyRoster(); }
  }
  function getBodyRaidId(){
    return global.document && global.document.body ? global.document.body.getAttribute('data-raid-id') : '';
  }
  function getSessionRaidId(){
    var session=null;
    if(global.RaidSessionClient && global.RaidSessionClient.getCurrentSession){
      session=global.RaidSessionClient.getCurrentSession();
    }
    return session && session.raidId ? session.raidId : '';
  }
  function getCurrentRaidId(){
    var sessionRaidId=getSessionRaidId();
    var configRaidId=global.RaidConfig && global.RaidConfig.raidId ? global.RaidConfig.raidId : '';
    var bodyRaidId=getBodyRaidId();
    var raidId=sessionRaidId || configRaidId || bodyRaidId || '';
    if(!raidId && global.console && global.console.error){
      global.console.error('[RosterStorage] No raidId resolved — data-raid-id missing from body?');
    }
    return raidId;
  }
  function getStorageKey(raidId){
    var resolvedRaidId=raidId || getCurrentRaidId();
    if(!resolvedRaidId){
      throw new Error('[RosterStorage] Cannot build storage key: no raidId');
    }
    return STORAGE_KEY_PREFIX + resolvedRaidId;
  }
  function loadRoster(raidId){
    var storageKey;
    try{
      storageKey=getStorageKey(raidId);
    }catch(e){
      if(global.console && global.console.error){ global.console.error(e); }
      return getEmptyRoster();
    }
    return parseRoster(localStorage.getItem(storageKey));
  }
  function saveRoster(roster, raidId){
    var normalized=normalizeRosterShape(roster);
    localStorage.setItem(getStorageKey(raidId), JSON.stringify({version:DATA_VERSION, updatedAt:new Date().toISOString(), payload:{groups:normalized.groups, singles:normalized.singles, meta:normalized.meta}}));
  }
  function clearRoster(raidId){ localStorage.removeItem(getStorageKey(raidId)); }
  function getPageRole(){
    return global.document && global.document.body ? (global.document.body.getAttribute('data-page-role') || '').trim() : '';
  }
  function hasRosterHash(){
    return !!(global.location && global.location.hash && global.location.hash.match(/(?:^#|&)roster=([^&]+)/));
  }
  function canImportRosterFromHash(){
    return getPageRole() === 'roster-editor' && !!getCurrentRaidId();
  }
  function importRosterFromHash(){
    var match=location.hash.match(/(?:^#|&)roster=([^&]+)/); if(!match) return false;
    if(!canImportRosterFromHash()) return false;
    try{
      var b64=match[1].replace(/-/g,'+').replace(/_/g,'/'); while(b64.length%4) b64+='=';
      var json=decodeURIComponent(Array.prototype.map.call(atob(b64),function(c){return '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2);}).join(''));
      localStorage.setItem(getStorageKey(),json);
      if(history&&history.replaceState) history.replaceState(null,'',location.pathname+location.search);
      return true;
    }catch(e){ return false; }
  }
  function debugStorage(){
    var bodyRaidId=getBodyRaidId() || '';
    var configRaidId=global.RaidConfig && global.RaidConfig.raidId ? global.RaidConfig.raidId : '';
    var sessionRaidId=getSessionRaidId() || '';
    var result={
      currentRaidId:getCurrentRaidId(),
      storageKey:'',
      hasBodyRaidId:!!bodyRaidId,
      bodyRaidId:bodyRaidId,
      hasRaidConfig:!!global.RaidConfig,
      raidConfigRaidId:configRaidId,
      hasSessionClient:!!global.RaidSessionClient,
      sessionRaidId:sessionRaidId,
      pageRole:getPageRole(),
      canImportRosterFromHash:canImportRosterFromHash(),
      hasRosterHash:hasRosterHash()
    };
    try{
      result.storageKey=getStorageKey();
    }catch(e){
      result.error=e && e.message ? e.message : String(e);
    }
    return result;
  }
  var api={STORAGE_KEY_PREFIX:STORAGE_KEY_PREFIX,DATA_VERSION:DATA_VERSION,SOFT_RESERVE_KEY:SOFT_RESERVE_KEY,getCurrentRaidId:getCurrentRaidId,getStorageKey:getStorageKey,getEmptyRoster:getEmptyRoster,parseRoster:parseRoster,loadRoster:loadRoster,saveRoster:saveRoster,clearRoster:clearRoster,canImportRosterFromHash:canImportRosterFromHash,importRosterFromHash:importRosterFromHash,debugStorage:debugStorage};
  Object.defineProperty(api,'STORAGE_KEY',{get:function(){ return getStorageKey(); },enumerable:true});
  global.RaidRosterStorage=api;
})(window);
