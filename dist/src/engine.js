
(function(){
'use strict';

var cardSeed = 1;
var charSeed = 1;
var match = {scoreA:0, scoreB:0, gameNo:1, mode:'manual'};
var game = null;
var undoStack = [];
var redoStack = [];
var historyLimit = 100;
var COM_DELAY = 3000;
var comTimer = null;
var comTimerToken = 0;
var uiPrefs = {motion:'normal',cinematics:true,chainCollapsed:true,historyCollapsed:false};
var chainAutoOpened = false;
var inspectorRestoreTimer = null;
var startupPending = false;
var setupTransitionPending=false;

var rulesBtn = document.getElementById('rulesBtn');
var rulesOverlay = document.getElementById('rulesOverlay');
var rulesCloseBtn = document.getElementById('rulesCloseBtn');
var rulesBottomCloseBtn = document.getElementById('rulesBottomCloseBtn');
var settingsBtn = document.getElementById('settingsBtn');
var settingsOverlay = document.getElementById('settingsOverlay');
var settingsCloseBtn = document.getElementById('settingsCloseBtn');
var cinematicsToggle = document.getElementById('cinematicsToggle');
var chainToggleBtn = document.getElementById('chainToggleBtn');
var historyToggleBtn = document.getElementById('historyToggleBtn');
var startBtn = document.getElementById('startBtn');
var comStartBtn = document.getElementById('comStartBtn');
var autoStartBtn = document.getElementById('autoStartBtn');
var undoBtn = document.getElementById('undoBtn');
var redoBtn = document.getElementById('redoBtn');
var scoreEl = document.getElementById('scoreText');
var phaseEl = document.getElementById('phaseBanner');
var statusEl = document.getElementById('status');
var controlsEl = document.getElementById('controls');
var logEl = document.getElementById('log');
var chainEl = document.getElementById('chainPanel');
var selectionPanelEl=document.getElementById('selectionPanel');
var selectionPanelTitleEl=document.getElementById('selectionPanelTitle');
var selectionPanelContentEl=document.getElementById('selectionPanelContent');
var resolutionEl = document.getElementById('resolutionBanner');
var simTitleEl = document.getElementById('simTitle');
var modeFooterEl = document.getElementById('modeFooter');
var battleStageEl = document.getElementById('battleStage');
var duelOverlayEl = document.getElementById('duelOverlay');
var activeChainStackEl = document.getElementById('activeChainStack');
var cardInspectorEl = document.getElementById('cardInspector');
var inspectorCardEl = document.getElementById('inspectorCard');
var inspectorTypeEl = document.getElementById('inspectorType');
var inspectorNameEl = document.getElementById('inspectorName');
var inspectorEffectEl = document.getElementById('inspectorEffect');

var A_CHAR_NAMES = ['ジェイ','アンク','トーリ','ココネ','ジャカン'];
var B_CHAR_NAMES = ['プレスボーイ','マグネボーイ','ブレードボーイ','軍人A','軍人B'];
var TRAP_LABEL = {
  levelDown:'罠：相手キャラの攻撃力を永続-1',
  lockZone:'罠：相手の空き枠か表向きカードの枠を指定し、攻防連鎖の全効果処理後に封鎖',
  reviveFromRetreat:'罠：自分の撤退エリアからキャラ1体をLv1で召喚',
  removePower1:'罠：相手の場のキャラ1体を選び、効果処理時に攻撃力1なら除外',
  skipAttack:'罠：相手の次の攻撃宣言を1回スキップ',
  forceEnd:'罠：攻防を強制終了',
  splitAttack:'罠：3体以上の攻撃から1体をその攻防だけ外す'
};
var TRAP_NAME = {
  levelDown:'衰弱の刻印',
  lockZone:'作戦封鎖',
  reviveFromRetreat:'帰還の狼煙',
  removePower1:'弱兵排除',
  skipAttack:'進軍阻止',
  forceEnd:'強制終結',
  splitAttack:'分断工作'
};
var TACTIC_LABEL = {
  buff1:'戦術：この攻防ステップ中、指定キャラ+1',
  debuff1:'戦術：この攻防ステップ中、指定キャラ-1',
  redirect:'戦術：攻撃対象をすげ替え',
  revive:'戦術：撤退エリアから1体召喚',
  peek2:'戦術：相手の戦術手札を2枚確認',
  drawTactic2:'戦術：戦術デッキから2枚ドロー',
  buffAll1:'戦術：この攻防ステップ中、自分側全員+1',
  debuffAll1:'戦術：この攻防ステップ中、相手側全員-1',
  recycle:'戦術：撤退エリアの戦術カード1枚を手札へ戻す',
  negateTrap:'戦術：未処理の相手罠1枚の効果を無効にする',
  strategyShift:'戦術：別の戦術手札1枚をデッキ下へ戻して2枚ドロー',
  supportDefense:'戦術：防御時に自分のキャラを2体選び、1体目-1／2体目+1',
  lastStand:'戦術：単騎対複数なら自分側の参加キャラ+2'
};
var TACTIC_NAME = {
  buff1:'士気高揚',
  debuff1:'威圧',
  redirect:'標的変更',
  revive:'戦線復帰',
  peek2:'偵察',
  drawTactic2:'作戦補給',
  buffAll1:'総力戦',
  debuffAll1:'一斉妨害',
  recycle:'作戦回収',
  negateTrap:'看破',
  strategyShift:'作戦転換',
  supportDefense:'援護防御',
  lastStand:'背水の陣'
};
var EXP_LABEL = {
  growth:'展開：バトルエリアのキャラの攻撃力を永続+1',
  summon:'展開：メインデッキからキャラを1体召喚',
  summonShuffleDraw:'展開：キャラを召喚しシャッフルして1枚ドロー',
  draw2discard2:'手札から2枚をメインデッキに戻してシャッフルし、2枚ドロー',
  draw1:'展開：メインデッキから1枚ドロー',
  searchCharacter:'展開：メインデッキからキャラ1枚を手札に加える',
  defensePrep:'展開：デッキ上3枚から罠1枚を作戦エリアに伏せる'
};
var EXP_NAME = {
  growth:'鍛錬',
  summon:'緊急招集',
  summonShuffleDraw:'増援到着',
  draw2discard2:'手札交換',
  draw1:'補給',
  searchCharacter:'仲間捜索',
  defensePrep:'防衛準備'
};
var LIMITED_KINDS = {
  lockZone:true, reviveFromRetreat:true, removePower1:true, skipAttack:true, forceEnd:true, splitAttack:true,
  peek2:true, drawTactic2:true, redirect:true, revive:true, buffAll1:true, debuffAll1:true, recycle:true,
  negateTrap:true, strategyShift:true, supportDefense:true, lastStand:true
};

function shuffle(arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){
    var j = Math.floor(Math.random()*(i+1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function card(type, data){
  var c = {cid:cardSeed++, type:type};
  Object.keys(data || {}).forEach(function(k){ c[k] = data[k]; });
  return c;
}
function buildMainDeck(characterNames){
  var deck = [];
  characterNames.forEach(function(name){ for(var i=0;i<3;i++) deck.push(card('character',{name:name})); });
  [['growth',3],['summon',3],['draw2discard2',3],['summonShuffleDraw',3],['draw1',2],['searchCharacter',2],['defensePrep',1]].forEach(function(x){
    for(var i=0;i<x[1];i++) deck.push(card('exp',{kind:x[0]}));
  });
  [['levelDown',2],['lockZone',1],['reviveFromRetreat',1],['removePower1',1],['skipAttack',1],['forceEnd',1],['splitAttack',1]].forEach(function(x){
    for(var i=0;i<x[1];i++) deck.push(card('trap',{kind:x[0],chain:x[0]==='forceEnd'}));
  });
  return shuffle(deck);
}
function buildTacticDeck(characterNames){
  var deck = [];
  [['buff1',2,1],['debuff1',2,0],['peek2',1,0],['drawTactic2',1,0],['redirect',1,0],['revive',1,0],['buffAll1',1,0],['debuffAll1',1,0],['recycle',1,0],['negateTrap',1,0],['strategyShift',1,0],['supportDefense',1,0],['lastStand',1,0]].forEach(function(x){
    for(var i=0;i<x[1];i++) deck.push(card('tactic',{kind:x[0],chain:i<x[2]}));
  });
  characterNames.forEach(function(name){
    deck.push(card('tactic',{kind:'namedShift',targetName:name,chain:false}));
  });
  return shuffle(deck);
}
function newPlayer(name, first, characterNames){
  return {
    name:name, isFirst:first, mainDeck:buildMainDeck(characterNames), tacticDeck:buildTacticDeck(characterNames),
    mainHand:[], tacticHand:[], tacticSelected:false, tacticDrawPool:[],
    battleArea:[], trapZone:[], tempPlayed:[], lockedSlotIndexes:[], pendingLockedSlotIndexes:[],
    retreat:[], exclusion:[], attackPassCount:0, skipNextAttack:false,
    openingMainDealt:false, openingTacticsReady:false, standbyComplete:false
  };
}
function label(c){
  if(c.type === 'character') return 'キャラ：' + c.name + '（Lv' + (c.level==null ? 1 : c.level) + '）';
  if(c.type === 'exp') return '展開「' + (EXP_NAME[c.kind] || '名称未定') + '」：' + (EXP_LABEL[c.kind] || '展開：？').replace(/^展開：/,'');
  if(c.type === 'trap') return '罠「' + (TRAP_NAME[c.kind] || '名称未定') + '」：' + (TRAP_LABEL[c.kind] || '罠：？').replace(/^罠：/,'') + (LIMITED_KINDS[c.kind] ? '【制限】' : '') + (c.chain ? '【連続発動】' : '');
  if(c.type === 'tactic' && c.kind === 'namedShift') return '戦術「' + c.targetName + '専用戦術」：自分の' + c.targetName + '+2／相手の' + c.targetName + '-2';
  if(c.type === 'tactic') return '戦術「' + (TACTIC_NAME[c.kind] || '名称未定') + '」：' + (TACTIC_LABEL[c.kind] || '戦術：？').replace(/^戦術：/,'') + (LIMITED_KINDS[c.kind] ? '【制限】' : '') + (c.chain ? '【連続発動】' : '');
  return '？';
}
function cardTypeName(c){
  if(!c) return 'カード';
  return c.type==='character'?'キャラカード':c.type==='exp'?'展開カード':c.type==='trap'?'罠カード':c.type==='tactic'?'戦術カード':'カード';
}
function cardDisplayName(c){
  if(!c) return '名称不明';
  if(c.type==='character') return c.name || '名称不明';
  if(c.type==='exp') return EXP_NAME[c.kind] || '名称未定';
  if(c.type==='trap') return TRAP_NAME[c.kind] || '名称未定';
  if(c.type==='tactic' && c.kind==='namedShift') return (c.targetName || 'キャラ')+'専用戦術';
  if(c.type==='tactic') return TACTIC_NAME[c.kind] || '名称未定';
  return '名称不明';
}
function cardEffectText(c,powerOverride){
  if(!c) return '';
  if(c.type==='character'){
    var lv=powerOverride==null?(c.level==null?1:c.level):powerOverride;
    return '現在の攻撃力：'+lv+(powerOverride!=null && c.level!=null && powerOverride!==c.level?' ／ 元の攻撃力：'+c.level:'');
  }
  if(c.type==='exp') return (EXP_LABEL[c.kind]||'展開：？').replace(/^展開：/,'');
  if(c.type==='trap') return (TRAP_LABEL[c.kind]||'罠：？').replace(/^罠：/,'')+(LIMITED_KINDS[c.kind]?'　【制限カード】':'')+(c.chain?'　【連続発動】':'');
  if(c.type==='tactic' && c.kind==='namedShift') return '自分の'+c.targetName+'を+2／相手の'+c.targetName+'を-2';
  if(c.type==='tactic') return (TACTIC_LABEL[c.kind]||'戦術：？').replace(/^戦術：/,'')+(LIMITED_KINDS[c.kind]?'　【制限カード】':'')+(c.chain?'　【連続発動】':'');
  return '';
}
function cardInspectAttrs(c,powerOverride){
  if(!c) return '';
  return ' data-inspect-type="'+esc(c.type)+'" data-inspect-title="'+esc(cardDisplayName(c))+'" data-inspect-effect="'+esc(cardEffectText(c,powerOverride))+'"'+(c.cid!=null?' data-cid="'+Number(c.cid)+'"':'');
}
function cardSigilHtml(){
  return '<svg class="cardSigil" viewBox="0 0 70 30" aria-hidden="true"><path d="M35 2L49 15 35 28 21 15Z M35 7L43 15 35 23 27 15Z M5 15H17 M53 15H65" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M35 10L40 15 35 20 30 15Z" fill="currentColor"/></svg>';
}
function compactCardHtml(c,powerOverride){
  if(!c) return '';
  if(c.type==='character')return '<span class="cardMiniStat">Lv. '+esc(powerOverride==null?(c.level==null?1:c.level):powerOverride)+'</span>';
  var shortType=c.type==='character'?'CHAR':c.type==='exp'?'展開':c.type==='trap'?'罠':'戦術';
  return '<span class="cardMiniType">'+esc(shortType)+'</span>'+cardSigilHtml()+'<span class="cardMiniName">'+esc(cardDisplayName(c))+'</span>'+
    '';
}
function esc(s){
  return String(s).replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}
function btn(action, text, attrs, cls, disabled){
  var extra = '';
  Object.keys(attrs || {}).forEach(function(k){ extra += ' data-' + k + '="' + esc(attrs[k]) + '"'; });
  return '<button class="controlBtn ' + (cls || '') + '" data-action="' + action + '"' + extra + (disabled ? ' disabled' : '') + '>' + esc(text) + '</button>';
}
function playerByKey(key){ return key === 'A' ? game.A : game.B; }
function playerKey(p){ return p === game.A ? 'A' : 'B'; }
function other(p){ return p === game.A ? game.B : game.A; }
function findChar(p, uid){ return p.battleArea.find(function(c){ return c.uid === Number(uid); }); }
function findCard(list, cid){ return list.find(function(c){ return c.cid === Number(cid); }); }
function findCardAnywhere(cid){
  if(!game || cid==null) return null;
  var id=Number(cid),found=null;
  [game.A,game.B].some(function(p){
    var collections=[p.mainHand,p.mainDeck,p.tacticHand,p.tacticDrawPool,p.tacticDeck,p.trapZone,p.tempPlayed,p.retreat,p.exclusion];
    for(var i=0;i<collections.length;i++){
      found=findCard(collections[i]||[],id);
      if(found) return true;
    }
    return false;
  });
  return found;
}
function findCharacterAnywhere(uid){
  if(!game || uid==null) return null;
  var id=Number(uid),found=null;
  [game.A,game.B].some(function(p){
    found=p.battleArea.concat(p.retreat,p.exclusion).find(function(x){return x && x.uid===id;})||null;
    return !!found;
  });
  return found;
}
function characterBoardChoiceLabel(ch,suffix){
  if(!ch) return 'キャラ未選択';
  var owner=findChar(game.A,ch.uid)?game.A:(findChar(game.B,ch.uid)?game.B:null);
  if(owner) ensureBattleSlots(owner);
  var place=owner ? owner.name+'・バトル'+(Number(ch.battleSlot)+1)+'番枠' : '配置不明';
  var power=game&&game.attack ? currentBattlePower(ch) : (ch.level==null?1:ch.level);
  return ch.name+'（'+place+'／Lv'+power+'）'+(suffix||'');
}
function takeCard(list, cid){
  var i = list.findIndex(function(c){ return c.cid === Number(cid); });
  return i < 0 ? null : list.splice(i,1)[0];
}
function cardsInTypeOrder(list){
  var rank={character:0,exp:1,trap:2,tactic:3};
  return (list || []).map(function(c,index){return {card:c,index:index};}).sort(function(a,b){
    var ar=rank[a.card.type]==null?99:rank[a.card.type];
    var br=rank[b.card.type]==null?99:rank[b.card.type];
    return ar-br || a.index-b.index;
  }).map(function(x){return x.card;});
}
var TACTIC_DISPLAY_ORDER = {
  buff1:0, debuff1:1, buffAll1:2, debuffAll1:3, supportDefense:4, lastStand:5,
  redirect:6, revive:7, drawTactic2:8, recycle:9, strategyShift:10, peek2:11, negateTrap:12
};
var TRAP_DISPLAY_ORDER = {
  levelDown:0, lockZone:1, reviveFromRetreat:2, removePower1:3,
  skipAttack:4, forceEnd:5, splitAttack:6
};
function tacticsInDisplayOrder(list){
  return (list || []).map(function(c,index){return {card:c,index:index};}).sort(function(a,b){
    var ac=a.card,bc=b.card;
    var ag=ac.kind==='namedShift'?0:1;
    var bg=bc.kind==='namedShift'?0:1;
    if(ag!==bg) return ag-bg;
    if(ag===0){
      var nameOrder=String(ac.targetName||'').localeCompare(String(bc.targetName||''),'ja');
      if(nameOrder) return nameOrder;
    }else{
      var ar=TACTIC_DISPLAY_ORDER[ac.kind]==null?99:TACTIC_DISPLAY_ORDER[ac.kind];
      var br=TACTIC_DISPLAY_ORDER[bc.kind]==null?99:TACTIC_DISPLAY_ORDER[bc.kind];
      if(ar!==br) return ar-br;
    }
    if(!!ac.chain!==!!bc.chain) return ac.chain?-1:1;
    return Number(ac.cid||0)-Number(bc.cid||0) || a.index-b.index;
  }).map(function(x){return x.card;});
}
function responseCardsInDisplayOrder(list){
  var traps=(list||[]).filter(function(c){return c.type==='trap';}).sort(function(a,b){
    var ar=TRAP_DISPLAY_ORDER[a.kind]==null?99:TRAP_DISPLAY_ORDER[a.kind];
    var br=TRAP_DISPLAY_ORDER[b.kind]==null?99:TRAP_DISPLAY_ORDER[b.kind];
    return ar-br || (a.chain===b.chain?0:(a.chain?-1:1)) || Number(a.cid||0)-Number(b.cid||0);
  });
  var tactics=tacticsInDisplayOrder((list||[]).filter(function(c){return c.type==='tactic';}));
  return traps.concat(tactics);
}
function openingTacticLabel(c){
  var name=c.kind==='namedShift' ? c.targetName+'専用カード' : (TACTIC_NAME[c.kind]||'名称未定');
  return name+(LIMITED_KINDS[c.kind]?'【制限】':'')+(c.chain?'【連続】':'');
}
function compactChoiceLabel(c,includeType){
  if(!c)return '名称不明';
  var prefix='';
  if(includeType){
    prefix=c.type==='character'?'キャラ｜':c.type==='exp'?'展開｜':c.type==='trap'?'罠｜':'戦術｜';
  }
  var name=c.type==='character'
    ? (c.name||'名称不明')+' Lv'+(c.level==null?1:c.level)
    : (c.type==='tactic'&&c.kind==='namedShift' ? (c.targetName||'キャラ')+'専用' : cardDisplayName(c));
  var flags=(LIMITED_KINDS[c.kind]?'【制限】':'')+(c.chain?'【連続】':'');
  return prefix+name+flags;
}
function cardTypeClass(c){
  return c && ['character','exp','trap','tactic'].indexOf(c.type)>=0 ? 'type-'+c.type : '';
}
function cardButtonClass(c,selected,extra){
  return [extra||'',cardTypeClass(c),selected?'selected':''].filter(Boolean).join(' ');
}
function ensureBattleSlots(p){
  var used=new Set();
  (p.battleArea||[]).forEach(function(ch){
    var slot=Number(ch.battleSlot);
    if(slot>=0 && slot<5 && !used.has(slot)){
      ch.battleSlot=slot;
      used.add(slot);
      return;
    }
    for(var i=0;i<5;i++){
      if(!used.has(i)){
        ch.battleSlot=i;
        used.add(i);
        return;
      }
    }
  });
}
function battleSlotInfo(p,index){
  ensureBattleSlots(p);
  return p.battleArea.find(function(ch){return ch.battleSlot===Number(index);}) || null;
}
function reservedReviveBattleSlotIndexes(p){
  if(!game || !game.attack) return [];
  var key=playerKey(p);
  return game.attack.chainHistory.filter(function(entry){
    return entry.actorKey===key && (entry.kind==='revive'||entry.kind==='reviveFromRetreat') &&
      !entry.negated && (entry.status==='pending'||entry.status==='resolving') && entry.payload && entry.payload.battleSlot!=null;
  }).map(function(entry){return Number(entry.payload.battleSlot);}).filter(function(slot){return slot>=0&&slot<5;});
}
function reservedReviveTargetUids(p){
  if(!game || !game.attack) return new Set();
  var key=playerKey(p),reserved=new Set();
  game.attack.chainHistory.forEach(function(entry){
    if(entry.actorKey===key && (entry.kind==='revive'||entry.kind==='reviveFromRetreat') &&
      !entry.negated && (entry.status==='pending'||entry.status==='resolving') && entry.payload && entry.payload.targetUid!=null){
      reserved.add(Number(entry.payload.targetUid));
    }
  });
  return reserved;
}
function openBattleSlotIndexes(p,includeReserved){
  ensureBattleSlots(p);
  var used=new Set(p.battleArea.map(function(ch){return ch.battleSlot;}));
  if(includeReserved) reservedReviveBattleSlotIndexes(p).forEach(function(slot){used.add(slot);});
  var open=[];
  for(var i=0;i<5;i++) if(!used.has(i)) open.push(i);
  return open;
}
function placeCharacterInBattle(p,ch,slot){
  slot=Number(slot);
  if(openBattleSlotIndexes(p,false).indexOf(slot)<0) return false;
  ch.battleSlot=slot;
  p.battleArea.push(ch);
  window.dispatchEvent(new CustomEvent('duel:card-sound',{detail:{kind:'summon'}}));
  return true;
}
function lockedZoneSlots(p){
  if(!Array.isArray(p.lockedSlotIndexes)) p.lockedSlotIndexes=[];
  return p.lockedSlotIndexes;
}
function pendingLockedZoneSlots(p){
  if(!Array.isArray(p.pendingLockedSlotIndexes)) p.pendingLockedSlotIndexes=[];
  return p.pendingLockedSlotIndexes;
}
function ensureTacticZoneSlots(p){
  var used=new Set(lockedZoneSlots(p));
  p.trapZone.concat(p.tempPlayed).forEach(function(c){
    var index=Number(c.zoneSlot);
    if(index>=0 && index<5 && !used.has(index)){
      used.add(index);
      return;
    }
    for(var i=0;i<5;i++){
      if(!used.has(i)){
        c.zoneSlot=i;
        used.add(i);
        return;
      }
    }
  });
}
function zoneSlotInfo(p,index){
  ensureTacticZoneSlots(p);
  var tactic=p.tempPlayed.find(function(x){return x.zoneSlot===index;});
  if(tactic) return {card:tactic,faceUp:true,source:'tactic'};
  var trap=p.trapZone.find(function(x){return x.zoneSlot===index;});
  if(!trap) return null;
  var faceUp=!!(game && game.attack && game.attack.usedTraps.has(trap.cid));
  return {card:trap,faceUp:faceUp,source:'trap'};
}
function openTacticSlotIndexes(p){
  ensureTacticZoneSlots(p);
  var locked=new Set(lockedZoneSlots(p)),open=[];
  for(var i=0;i<5;i++) if(!locked.has(i) && !zoneSlotInfo(p,i)) open.push(i);
  return open;
}
function firstOpenTacticSlot(p){
  var open=openTacticSlotIndexes(p);
  return open.length ? open[0] : null;
}
function lockableZoneSlotIndexes(p){
  var pending=new Set(pendingLockedZoneSlots(p)),locked=new Set(lockedZoneSlots(p)),targets=[];
  for(var i=0;i<5;i++){
    if(locked.has(i) || pending.has(i)) continue;
    var info=zoneSlotInfo(p,i);
    if(!info || info.faceUp) targets.push(i);
  }
  return targets;
}
function queuedLockTargetIndexes(p){
  if(!game || !game.attack) return [];
  var targetKey=playerKey(p);
  return game.attack.chainHistory.filter(function(entry){
    return entry.kind==='lockZone' && entry.actorKey!==targetKey && !entry.negated &&
      (entry.status==='pending' || entry.status==='resolving');
  }).map(function(entry){return Number(entry.payload.lockSlot);}).filter(function(index){return index>=0 && index<5;});
}
function slotCap(p){ return Math.max(0,5-lockedZoneSlots(p).length); }
function tacticSlotsOpen(p){ return openTacticSlotIndexes(p).length; }
function choice(){
  if(!game.choice) game.choice = {};
  return game.choice;
}
function clearChoice(){ game.choice = {discard:new Set(), attackers:new Set(), effect:new Set(), penalty:new Set()}; }
function phase(text){ phaseEl.textContent = 'フェーズ：' + text; }
function status(text){ statusEl.textContent = text; }
function log(text, cls){
  var d = document.createElement('div');
  d.className = 'entry' + (cls ? ' ' + cls : '');
  d.textContent = text;
  logEl.insertBefore(d,logEl.firstChild);
  logEl.scrollTop = 0;
  window.dispatchEvent(new CustomEvent('duel:log',{detail:{text:text}}));
}
function gameHeader(text){ log(text,'gameHeader'); }

function historyStringify(value){
  return JSON.stringify(value,function(key,item){
    return item instanceof Set ? {__historySet:Array.from(item)} : item;
  });
}
function historyParse(text){
  return JSON.parse(text,function(key,item){
    return item && item.__historySet ? new Set(item.__historySet) : item;
  });
}
function captureSnapshot(){
  return historyStringify({
    game:game, match:match, cardSeed:cardSeed, charSeed:charSeed,
    phase:phaseEl.textContent, status:statusEl.textContent,
    score:scoreEl.textContent, startText:startBtn.textContent,
    logHtml:logEl.innerHTML
  });
}
function restoreSnapshot(snapshot){
  cancelComTimer();
  var data = historyParse(snapshot);
  game = data.game;
  match = data.match;
  cardSeed = data.cardSeed;
  charSeed = data.charSeed;
  phaseEl.textContent = data.phase;
  statusEl.textContent = data.status;
  scoreEl.textContent = data.score;
  startBtn.textContent = data.startText;
  logEl.innerHTML = data.logHtml;
  logEl.scrollTop = 0;
  render();
}
function recordHistory(){
  undoStack.push(captureSnapshot());
  if(undoStack.length>historyLimit) undoStack.shift();
  redoStack = [];
}
function updateHistoryButtons(){
  undoBtn.disabled = undoStack.length===0;
  redoBtn.disabled = redoStack.length===0;
}
function undoOne(){
  if(!undoStack.length) return;
  redoStack.push(captureSnapshot());
  restoreSnapshot(undoStack.pop());
}
function redoOne(){
  if(!redoStack.length) return;
  undoStack.push(captureSnapshot());
  restoreSnapshot(redoStack.pop());
}

function battleHtml(p){
  ensureBattleSlots(p);
  var out = '',pKey=playerKey(p);
  for(var i=0;i<5;i++){
    var c = battleSlotInfo(p,i);
    if(!c){
      out += '<div class="slot empty" data-zone="battle" data-player="'+pKey+'" data-slot="'+i+'"><span class="zoneSlotNumber">' + (i+1) + '</span></div>';
      continue;
    }
    var mod = game && game.attack ? (game.attack.mods[c.uid] || 0) : 0;
    var power = Math.max(0,c.level+mod);
    var powerClass = mod>0 ? ' powerUp' : (mod<0 ? ' powerDown' : '');
    var targetClass = game && game.attack && playerKey(p)===game.attack.defenderKey && c.uid===game.attack.targetUid ? ' attackTarget' : '';
    var attackerClass = game && game.attack && playerKey(p)===game.attack.attackerKey && game.attack.attackerUids.indexOf(c.uid)>=0 ? ' attackAttacker' : '';
    var choiceTargetClass = game && game.choice && (
      (game.choice.responseTargetUid!=null && Number(game.choice.responseTargetUid)===c.uid) ||
      (game.choice.standbyTargetUid!=null && Number(game.choice.standbyTargetUid)===c.uid)
    ) ? ' choiceTarget' : '';
    if(game && !game.attack && game.state==='attackDeclare' && game.choice){
      if(pKey===game.turnKey && game.choice.attackers && game.choice.attackers.has(c.uid)) attackerClass=' attackAttacker';
      if(pKey!==game.turnKey && Number(game.choice.targetUid)===Number(c.uid)) targetClass=' attackTarget';
    }
    out += '<div class="slot char type-character' + powerClass + targetClass + attackerClass + choiceTargetClass + '" data-zone="battle" data-player="'+pKey+'" data-slot="'+i+'" data-uid="'+Number(c.uid)+'"'+cardInspectAttrs(c,power)+'><span class="zoneSlotNumber">' + (i+1) + '</span><span class="cardMiniType">CHAR</span>'+cardSigilHtml()+'<span class="cardMiniName">' + esc(c.name) + '</span><span class="powerValue">Lv. ' + power + '</span>';
    if(mod) out += '<div class="powerBase">元Lv. ' + c.level + '（' + (mod>0?'+':'') + mod + '）</div>';
    out += '</div>';
  }
  return out;
}
function hideTrapDetails(p){
  if(game.mode==='manual')return playerKey(p)!==(game.responseActorKey||game.standbyKey||game.turnKey||'A');
  return game.mode==='auto'||p===game.B;
}
function tacticHtml(p,hideSetTraps){
  ensureTacticZoneSlots(p);
  var pKey=playerKey(p),locked=new Set(lockedZoneSlots(p)),pending=new Set(pendingLockedZoneSlots(p)),queued=new Set(queuedLockTargetIndexes(p));
  var html=[];
  for(var i=0;i<5;i++){
    var number='<span class="zoneSlotNumber">'+(i+1)+'</span>';
    if(locked.has(i)){
      html.push('<div class="slot locked" data-zone="tactic" data-player="'+pKey+'" data-slot="'+i+'">'+number+'封鎖</div>');
      continue;
    }
    var info=zoneSlotInfo(p,i);
    var pendingClass=(pending.has(i)?' pendingLock':(queued.has(i)?' queuedLock':''))+(info&&info.card.pendingPlacement?' choiceTarget':'');
    var pendingText=pending.has(i)?'<span class="zonePending">全処理後に封鎖</span>':(queued.has(i)?'<span class="zonePending queued">封鎖対象・未処理</span>':'');
    if(!info){
      html.push('<div class="slot empty'+pendingClass+'" data-zone="tactic" data-player="'+pKey+'" data-slot="'+i+'">'+number+(pending.has(i)?'封鎖予定':'空き')+pendingText+'</div>');
      continue;
    }
    var cardText,inspect='';
    if(info.source==='trap' && !info.faceUp){
      if(hideSetTraps){
        cardText='<span class="cardMiniType">裏向き</span><span class="cardMiniName">伏せカード</span>';
      }else{
        cardText='<span class="cardMiniType">伏せ罠</span><span class="cardMiniName">'+esc(cardDisplayName(info.card))+'</span>';
        inspect=cardInspectAttrs(info.card);
      }
    }else{
      cardText='<span class="cardMiniType">表向き</span><span class="cardMiniName">'+esc(cardDisplayName(info.card))+'</span>';
      inspect=cardInspectAttrs(info.card);
    }
    html.push('<div class="slot trap '+cardTypeClass(info.card)+pendingClass+'" data-zone="tactic" data-player="'+pKey+'" data-slot="'+i+'"'+(info.source==='trap'&&!info.faceUp?' data-face-down="true"':'')+(hideSetTraps&&info.source==='trap'&&!info.faceUp?' data-hidden-card="true" data-cid="'+Number(info.card.cid)+'"':inspect)+'>'+number+cardText+pendingText+'</div>');
  }
  return html.join('');
}
function pileHtml(cards,isDeck){
  var list=cards || [];
  var cls='pileSlot' + (isDeck ? ' deck' : (list.length?' '+cardTypeClass(list[list.length-1]):''));
  var html='<div class="' + cls + '">';
  if(isDeck){
    html += '<div>カード裏面</div><div class="pileCount">' + list.length + '枚</div>';
  }else if(!list.length){
    html += '<div class="pileCount">0枚</div>';
  }else{
    html += '<div class="pileCount">' + list.length + '枚</div><div class="pileTop">一番上：' + esc(label(list[list.length-1])) + '</div>';
  }
  return html + '</div>';
}
function tacticDeckView(p){
  return p.tacticDrawPool.length ? p.tacticDrawPool : p.tacticDeck;
}
function hiddenHandHtml(p){
  var hand=p.tacticSelected ? p.tacticHand : p.mainHand;
  if(!hand.length) return '';
  return hand.map(function(card){
    var atk=game.attack,ack=atk&&atk.pendingPeekAcknowledgementIndex,entry=ack!=null?atk.chainHistory[ack]:null;
    if(entry&&entry.actorKey==='A'&&(entry.payload.ids||[]).indexOf(card.cid)>=0)return '<div class="card own '+cardTypeClass(card)+'"'+cardInspectAttrs(card)+'>'+compactCardHtml(card)+'</div>';
    return '<div class="cardBack'+(game.choice.effect.has(card.cid)?' selected':'')+'" data-hidden-card="true" data-cid="'+card.cid+'">非公開</div>';
  }).join('');
}
function handHtml(p){
  var hand = p.tacticSelected ? p.tacticHand : p.mainHand;
  if(!hand.length) return '';
  return cardsInTypeOrder(hand).map(function(c){
    var selected = false;
    if(game && game.choice){
      selected = game.choice.standbyCard === c.cid ||
        game.choice.responseCard === c.cid ||
        (game.choice.discard && game.choice.discard.has(c.cid)) ||
        (game.choice.effect && game.choice.effect.has(c.cid)) ||
        (game.choice.penalty && game.choice.penalty.has(c.cid));
    }
    return '<div class="card own ' + cardTypeClass(c) + (selected?' selected':'') + '"'+cardInspectAttrs(c)+'>' + compactCardHtml(c) + '</div>';
  }).join('');
}
function selectedTacticHandHtml(cards){
  if(!cards || !cards.length) return '';
  return tacticsInDisplayOrder(cards).map(function(c){
    return '<div class="card own ' + cardTypeClass(c) + '"'+cardInspectAttrs(c)+'>' + compactCardHtml(c) + '</div>';
  }).join('');
}
function openingTacticSelectionActive(){
  return !!(game&&game.mode==='com'&&!game.humanTacticsReady&&(game.state==='awaitTacticSelection'||(['standby','mulliganConfirm'].indexOf(game.state)>=0&&game.standbyKey==='B')));
}
function openingTacticHandHtml(){
  if(!openingTacticSelectionActive())return '';
  return tacticsInDisplayOrder(game.A.tacticDeck.filter(function(c){return game.humanTacticSelection.has(c.cid);})).map(function(c){
    return '<button type="button" class="card own '+cardTypeClass(c)+' selected" data-action="toggle-opening-tactic"'+cardInspectAttrs(c)+' aria-label="'+esc(cardDisplayName(c))+'を戦術手札から戻す">'+compactCardHtml(c)+'</button>';
  }).join('');
}
function characterReference(uid){
  if(!game || uid==null) return null;
  var found=null;
  [game.A,game.B].some(function(p){
    var ch=p.battleArea.concat(p.retreat,p.exclusion).find(function(x){return x && x.uid===Number(uid);});
    if(!ch) return false;
    found=p.name+'の「'+ch.name+'」';
    return true;
  });
  return found;
}
function cardReference(p,cid){
  if(!p || cid==null) return null;
  var collections=[p.mainHand,p.mainDeck,p.tacticHand,p.tacticDrawPool,p.tacticDeck,p.trapZone,p.tempPlayed,p.retreat,p.exclusion];
  for(var i=0;i<collections.length;i++){
    var found=findCard(collections[i]||[],cid);
    if(found) return label(found);
  }
  return null;
}
function participantReferences(key){
  if(!game || !game.attack) return [];
  return attackParticipants(key).map(function(ch){return playerByKey(key).name+'の「'+ch.name+'」';});
}
function chainTargetDescription(entry){
  if(!game || !game.attack || !entry) return '対象・指定先：記録なし';
  var atk=game.attack,payload=entry.payload||{},actor=playerByKey(entry.actorKey),op=other(actor);
  var target=characterReference(payload.targetUid),items,selected;
  if(entry.kind==='buff1') return '対象：'+(target||'指定キャラなし')+'（攻撃力+1）';
  if(entry.kind==='debuff1') return '対象：'+(target||'指定キャラなし')+'（攻撃力-1）';
  if(entry.kind==='levelDown') return '対象：'+(target||'指定キャラなし')+'（攻撃力を永続-1）';
  if(entry.kind==='namedShift') return '指定：'+(target||entry.targetName+'は場に不在')+'（'+entry.targetName+'専用効果）';
  if(entry.kind==='redirect'){
    var current=characterReference(atk.targetUid);
    return target ? '新しい攻撃対象：'+target : '指定：攻撃対象を変更しない（'+(current||'現在の対象なし')+'）';
  }
  if(entry.kind==='revive' || entry.kind==='reviveFromRetreat'){
    var destination=payload.battleSlot==null?'配置先なし':'バトルエリア'+(Number(payload.battleSlot)+1)+'番枠';
    return '生還対象：'+(target||'指定キャラなし')+'／配置先：'+destination;
  }
  if(entry.kind==='peek2'){
    selected=(payload.revealedLabels||[]).slice();
    if(!selected.length) selected=(payload.ids||[]).map(function(cid){return cardReference(op,cid);}).filter(Boolean);
    return selected.length ? '確認対象：'+op.name+'の戦術手札「'+selected.join('」／「')+'」' : '確認対象：'+op.name+'の戦術手札から効果処理時に最大2枚';
  }
  if(entry.kind==='drawTactic2') return '対象：'+actor.name+'の戦術デッキ';
  if(entry.kind==='buffAll1'){
    items=participantReferences(entry.actorKey);
    return '対象：'+(items.length?items.join('・'):actor.name+'側の参加キャラなし')+'（全員+1）';
  }
  if(entry.kind==='debuffAll1'){
    items=participantReferences(playerKey(op));
    return '対象：'+(items.length?items.join('・'):op.name+'側の参加キャラなし')+'（全員-1）';
  }
  if(entry.kind==='recycle'){
    selected=cardReference(actor,(payload.ids||[])[0]);
    return '対象：'+actor.name+'の撤退エリア'+(selected?'「'+selected+'」':'（指定カードなし）');
  }
  if(entry.kind==='strategyShift'){
    selected=cardReference(actor,(payload.ids||[])[0]);
    return '指定：'+actor.name+'の戦術手札'+(selected?'「'+selected+'」':'（指定カードなし）');
  }
  if(entry.kind==='negateTrap'){
    var index=Number(payload.targetIndex),trapEntry=atk.chainHistory[index];
    return trapEntry ? '対象：'+(index+1)+'. '+trapEntry.player+'「'+trapEntry.card+'」' : '対象：未処理の相手罠なし';
  }
  if(entry.kind==='splitAttack') return '対象：'+(target||'指定した攻撃キャラなし')+'（この攻防から外す）';
  if(entry.kind==='supportDefense'){
    var defended=characterReference(payload.recipientUid);
    return '−1：'+(target||'未選択')+'／＋1：'+(defended||'未選択');
  }
  if(entry.kind==='lastStand'){
    items=participantReferences(entry.actorKey);
    return '対象：'+(items.length?items.join('・'):actor.name+'側の参加キャラなし')+'（単騎条件を確認）';
  }
  if(entry.kind==='removePower1') return '対象：'+(target||'指定した相手キャラなし')+'（処理時に攻撃力1なら除外）';
  if(entry.kind==='lockZone') return '指定：'+op.name+'の作戦エリア'+(Number(payload.lockSlot)+1)+'番枠';
  if(entry.kind==='skipAttack') return '対象：'+op.name+'の次の攻撃宣言';
  if(entry.kind==='forceEnd') return '対象：現在の攻防連鎖全体';
  return '対象・指定先：なし';
}
function chainPanelHtml(){
  if(!game){
    return '<div class="chainEmpty">攻撃宣言・パス・発動カード・対象・処理結果をここへ表示します。</div>';
  }
  var active = !!game.attack;
  var items = active ? game.attack.displayHistory : game.lastChainDisplayHistory;
  if(!items){
    var legacyItems=active ? game.attack.chainHistory : game.lastChainHistory;
    items=(legacyItems||[]).map(function(entry,index){return {type:'card',entry:entry,chainNumber:entry.chainNumber||index+1};});
  }
  var resolving=game.state==='resolving';
  var html = '';
  if(!items || !items.length){
    return html + '<div class="chainEmpty">まだ罠・戦術カードは発動されていません。</div>';
  }
  items.slice().reverse().forEach(function(event){
    var eventActor=(event.entry||event).actorKey||((event.entry||event).player===game.A.name?'A':'B');
    if(event.type==='attackDeclare'){
      html += '<div class="chainItem attackDeclare player-'+eventActor+'"><div class="chainHead"><span class="chainPlayer">'+esc(event.player)+'</span><span class="chainState">連鎖外</span></div><div class="chainCardName">ATTACK　攻撃宣言</div>'+
        '<div class="chainTarget">攻撃キャラ：'+esc(event.attackers)+'<br>攻撃対象：'+esc(event.target)+'</div>'+
        '</div>';
      return;
    }
    if(event.type==='pass'){
      html += '<div class="chainItem pass player-'+eventActor+'"><div class="chainHead"><span class="chainPlayer">'+esc(event.player)+'</span><span class="chainState">連鎖外</span></div><div class="chainCardName">PASS　パス</div>'+
        '<div class="chainTarget">カード発動なし</div></div>';
      return;
    }
    var item=event.entry||event;
    var chainNumber=event.chainNumber||item.chainNumber||'';
    var isNextResolve=resolving && game.attack && game.attack.resolutionIndex>=0 && Number(chainNumber)===game.attack.resolutionIndex+1;
    var artCard=item.sourceCid!=null?findCardAnywhere(item.sourceCid):null,cardType=artCard?artCard.type:(item.src==='trap'?'trap':'tactic'),cardTitle=artCard?cardDisplayName(artCard):String(item.card||''),cardEffect=artCard?cardEffectText(artCard):'';
    html += '<div class="chainItem activeChainItem player-'+eventActor+' ' + (item.status || 'pending') + (isNextResolve?' resolvingNext':'') + ' type-' + esc(item.src||'tactic') + '" data-art-type="'+cardType+'" data-art-title="'+esc(cardTitle)+'" data-art-effect="'+esc(cardEffect)+'"><div class="chainHead"><span class="chainNumber">CHAIN ' + esc(chainNumber) + '</span>';
    html += '<span class="chainPlayer">' + esc(item.player) + '</span></div><div class="chainCardName">'+(item.src==='trap'?'罠｜':'戦術｜')+esc(shortCardLabel(item.card))+'</div>';
    html += '<div class="chainTarget">' + esc(item.targetText || chainTargetDescription(item)) + '</div>';
    if(item.continuous) html += '<span class="chainBadge">連続発動</span>';
    if(isNextResolve && item.status!=='resolving') html += '<span class="chainState">次に処理</span>';
    if(item.status === 'resolving') html += '<span class="chainState">処理中</span>';
    if(item.status === 'resolved') html += '<span class="chainState">処理済み</span>';
    if(item.status === 'resolvedNow') html += '<span class="chainState">いま処理しました</span>';
    if(item.negated) html += '<span class="chainState">無効</span>';
    html += '</div>';
  });
  return html;
}
function selectionPanelHtml(){
  if(!game)return null;
  var title='',cards=[],action='',chosen=null,disabled=false,empty='';
  if(openingTacticSelectionActive()){
    var picked=game.humanTacticSelection;title='戦術デッキ｜手札を7枚選択（'+picked.size+' / 7）';
    cards=tacticsInDisplayOrder(game.A.tacticDeck.filter(function(c){return !picked.has(c.cid);}));action='toggle-opening-tactic';disabled=picked.size>=7;
  }else if(game.state==='standby'){
    var p=playerByKey(game.standbyKey),c=choice(),active=c.expansionActivated?findCard(p.tempPlayed,c.standbyCard):null;
    if(active&&active.kind==='searchCharacter'){
      title='メインデッキ｜手札に加えるキャラ';cards=p.mainDeck.filter(function(x){return x.type==='character';});action='search-character';
    }else if(active&&(active.kind==='summon'||active.kind==='summonShuffleDraw')){
      title='メインデッキ｜召喚するキャラ';cards=p.mainDeck.filter(function(x){return x.type==='character';});action='choose-special-character';chosen=c.summonDeckCid;
    }else if(active&&active.kind==='defensePrep'){
      title='メインデッキ｜上から3枚を確認';cards=p.mainDeck.slice(0,3);action='resolve-defense-prep';disabled=tacticSlotsOpen(p)<=0;
      if(!cards.some(function(x){return x.type==='trap';}))empty='罠カードがありません。操作欄から確認を終えてください。';
    }
  }
  if(['response','chain'].indexOf(game.state)>=0 && !(game.mode==='com'&&game.responseActorKey==='B') && game.mode!=='auto'){
    var info=responseCardInfo(),actor=playerByKey(game.responseActorKey),pick=choice();
    if(info&&(info.src==='trap'||info.card.pendingPlacement)){
      if(info.card.kind==='revive'||info.card.kind==='reviveFromRetreat'){
        var reserved=reservedReviveTargetUids(actor);
        title='撤退エリア｜生還するキャラを選択';cards=actor.retreat.filter(function(x){return x.name&&!reserved.has(Number(x.uid));});action='choose-revive-target';chosen=pick.responseTargetUid;
      }else if(info.card.kind==='recycle'){
        title='撤退エリア｜手札に戻す戦術カードを選択';cards=actor.retreat.filter(function(x){return x.type==='tactic';});action='toggle-effect-card';
      }
    }
  }
  if(!title)return null;
  cards=cards.slice().sort(function(a,b){return cardDisplayName(a).localeCompare(cardDisplayName(b),'ja')||Number(!!a.chain)-Number(!!b.chain)||a.cid-b.cid;});
  var html='<div class="handRow selectionCardGrid">';
  cards.forEach(function(c){
    var isSelected=action==='toggle-effect-card'?choice().effect.has(c.cid):chosen!=null&&Number(chosen)===Number(action==='choose-revive-target'?c.uid:c.cid),isDisabled=disabled&&(action==='toggle-opening-tactic'||action==='resolve-defense-prep')||action==='resolve-defense-prep'&&c.type!=='trap';
    html+='<button type="button" class="card own '+cardTypeClass(c)+' selectionCard'+(isSelected?' selected':'')+'" data-action="'+action+'"'+(action==='choose-revive-target'?' data-uid="'+Number(c.uid)+'"':'')+cardInspectAttrs(c)+' aria-pressed="'+(isSelected?'true':'false')+'"'+(isDisabled?' disabled':'')+'>'+compactCardHtml(c)+'</button>';
  });
  html+='</div>'+(empty?'<div class="selectionPanelEmpty">'+esc(empty)+'</div>':'');
  return {title:title,html:html};
}
function activeChainStackHtml(){
  return '';
}
function resolutionBannerHtml(){
  if(!game || !game.attack) return '';
  var message = game.attack.resolutionMessage;
  if(!message) return '';
  return '<div class="resolutionMain">' + esc(message.title) + '</div>' +
    (message.detail ? '<div class="resolutionDetail">' + esc(message.detail) + '</div>' : '');
}
function setInspector(type,title,effect){
  var valid=['character','exp','trap','tactic'];
  var normalized=valid.indexOf(type)>=0?type:'';
  inspectorCardEl.className='inspectorCard'+(normalized?' inspect-'+normalized:'');
  inspectorTypeEl.textContent=normalized?cardTypeName({type:normalized}):'カード情報';
  inspectorNameEl.textContent=title||'選択待ち';
  inspectorEffectEl.textContent=effect||'盤面のカードを押すと、ここに詳細を表示します。';
}
function setInspectorForCard(c,powerOverride){
  if(!c) return false;
  setInspector(c.type,cardDisplayName(c),cardEffectText(c,powerOverride));
  return true;
}
function shortCardLabel(text){
  var value=String(text||'');
  var quoted=value.match(/「([^」]+)」/);
  if(quoted) return quoted[1];
  return value.replace(/^(キャラ|展開|罠|戦術)：?/,'').split('：')[0].slice(0,18)||'カード';
}
function inspectorFromNode(node){
  if(!node) return false;
  var type=node.dataset.inspectType||'';
  var title=node.dataset.inspectTitle||'';
  var effect=node.dataset.inspectEffect||'';
  if(!title) return false;
  setInspector(type,title,effect);
  return true;
}
function updateInspectorFromState(){
  if(!game){
    setInspector('','対戦開始待ち','上部の「両者手動」または「対COMバージョン」から対戦を始めてください。');
    return;
  }
  var atk=game.attack,entry=null;
  if(atk && game.state==='resolving'){
    entry=atk.chainHistory.find(function(x){return x.status==='resolving'||x.status==='resolvedNow';});
    if(!entry && atk.resolutionIndex>=0) entry=atk.chainHistory[atk.resolutionIndex];
    if(entry){
      setInspector(entry.src||'',shortCardLabel(entry.card),(entry.targetText||chainTargetDescription(entry))+(atk.resolutionMessage&&atk.resolutionMessage.detail?'\n\n処理：'+atk.resolutionMessage.detail:''));
      return;
    }
  }
  var c=game.choice||{};
  var uid=c.responseTargetUid!=null?c.responseTargetUid:(c.standbyTargetUid!=null?c.standbyTargetUid:c.targetUid);
  var ch=findCharacterAnywhere(uid);
  if(ch && setInspectorForCard(ch,currentBattlePower(ch))) return;
  var selected=findCardAnywhere(c.responseCard!=null?c.responseCard:c.standbyCard);
  if(selected && setInspectorForCard(selected)) return;
  if(atk && atk.chainHistory.length){
    entry=atk.chainHistory[atk.chainHistory.length-1];
    setInspector(entry.src||'',shortCardLabel(entry.card),entry.targetText||chainTargetDescription(entry));
    return;
  }
  setInspector('','盤面を確認中',phaseEl.textContent.replace(/^フェーズ：/,''));
}
function decorateInspectableControls(){
  controlsEl.querySelectorAll('.controlBtn').forEach(function(button){
    if(game && game.mode==='com' && button.dataset.action==='toggle-effect-card' && button.textContent.startsWith('裏向きの手札'))return;
    var c=button.dataset.cid?findCardAnywhere(button.dataset.cid):null;
    var ch=!c&&button.dataset.uid?findCharacterAnywhere(button.dataset.uid):null;
    if(c){
      button.dataset.inspectType=c.type;
      button.dataset.inspectTitle=cardDisplayName(c);
      button.dataset.inspectEffect=cardEffectText(c);
    }else if(ch){
      button.dataset.inspectType='character';
      button.dataset.inspectTitle=ch.name;
      button.dataset.inspectEffect=cardEffectText(ch,currentBattlePower(ch));
    }
  });
}
function bindLegalNode(node,button){
  if(!node || (node.dataset.hiddenCard==='true' && !(node.closest('#oppHand')&&button.dataset.action==='toggle-effect-card'&&game.attack&&game.attack.pendingPeekIndex!=null)) || node.closest('#controls,#decisionPanel,#deckActions,#selectionPanel')) return false;
  node.classList.add('legalTarget');
  node.tabIndex=0;
  node.setAttribute('role','button');
  node.setAttribute('aria-label',button.textContent.trim());
  node._proxyControlButton=button;
  return true;
}
function decorateLegalTargets(){
  battleStageEl.querySelectorAll('.legalTarget,.controlTargetPreview').forEach(function(node){
    node.classList.remove('legalTarget');node.classList.remove('placementTarget');
    node.classList.remove('controlTargetPreview');
    node.removeAttribute('tabindex');
    node.removeAttribute('role');
    node.removeAttribute('aria-label');
    node._proxyControlButton=null;
    node._boardAction=null;node._responseSlot=null;
  });
  var marked=0;
  controlsEl.querySelectorAll('.controlBtn[data-action]:not(:disabled)').forEach(function(button){
    var action=button.dataset.action;
    var cardActions=['choose-standby','choose-response-card','toggle-effect-card','toggle-penalty','toggle-exp-discard'];
    var charActions=['toggle-attacker','choose-target','choose-exp-target','choose-response-target','play-response-target-slot','choose-revive-target','toggle-effect-char','choose-tie-victim','choose-support-source','choose-support-recipient'];
    if(cardActions.indexOf(action)>=0 && button.dataset.cid){
      battleStageEl.querySelectorAll('[data-cid="'+Number(button.dataset.cid)+'"]').forEach(function(node){if(bindLegalNode(node,button))marked++;});
    }
    if(charActions.indexOf(action)>=0 && button.dataset.uid){
      battleStageEl.querySelectorAll('[data-uid="'+Number(button.dataset.uid)+'"]').forEach(function(node){if(bindLegalNode(node,button))marked++;});
    }
    if(action==='play-response-index' && game && game.attack){
      var entry=game.attack.chainHistory[Number(button.dataset.index)];
      if(entry && entry.sourceCid!=null){
        var target=battleStageEl.querySelector('.slot[data-zone="tactic"][data-player="'+entry.actorKey+'"][data-cid="'+Number(entry.sourceCid)+'"]');
        if(bindLegalNode(target,button)){button.hidden=true;marked++;}
      }
    }
    var zone='',pKey='',slot=button.dataset.slot;
    if((action==='summon-character'||action==='special-summon') && slot!=null){zone='battle';pKey=game.standbyKey;}
    else if(action==='choose-response-slot' && slot!=null){zone='tactic';pKey=game.responseActorKey;}
    else if(action==='play-response-target-slot' && slot!=null){zone='battle';pKey=game.responseActorKey;}
    else if(action==='play-lock-zone' && slot!=null){zone='tactic';pKey=playerKey(other(playerByKey(game.responseActorKey)));}
    if(zone&&pKey){
      var node=battleStageEl.querySelector('[data-zone="'+zone+'"][data-player="'+pKey+'"][data-slot="'+Number(slot)+'"]');
      if(bindLegalNode(node,button)) marked++;
    }
  });
  if(game&&game.state==='standby'){
    var p=playerByKey(game.standbyKey),c=choice(),card=c.standbyCard!=null?findCard(p.mainHand,c.standbyCard):null,pending=c.expansionActivated?findCard(p.tempPlayed,c.standbyCard):null;
    function bindBoard(node,action,labelText){if(!node)return;node.classList.add('legalTarget','placementTarget');node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',labelText);node._boardAction=action;marked++;}
    var battleId=playerKey(p)==='A'?'ownBattle':'oppBattle',tacticId=playerKey(p)==='A'?'ownTactic':'oppTactic';
    if(card&&card.type==='character'){
      openBattleSlotIndexes(p,false).forEach(function(index){bindBoard(document.getElementById(battleId)?.children[index],{kind:'summonCharacter',slot:index},'ここに召喚');});
    }else if(card&&card.type==='trap'){
      openTacticSlotIndexes(p).forEach(function(index){bindBoard(document.getElementById(tacticId)?.children[index],{kind:'setTrap',slot:index},'ここに罠を伏せる');});
    }else if(card&&card.type==='exp'){
      openTacticSlotIndexes(p).forEach(function(index){bindBoard(document.getElementById(tacticId)?.children[index],{kind:'activateExpansion',slot:index},'ここで展開カードを発動');});
    }else if(pending&&pending.kind==='growth'){
      p.battleArea.filter(function(x){return x.level<3;}).forEach(function(ch){var node=document.querySelector('#'+battleId+' .slot[data-uid="'+Number(ch.uid)+'"]');bindBoard(node,{kind:'growthTarget',uid:ch.uid},'このキャラを強化');});
    }else if(pending&&(pending.kind==='summon'||pending.kind==='summonShuffleDraw')&&c.summonDeckCid!=null&&findCard(p.mainDeck,c.summonDeckCid)){
      openBattleSlotIndexes(p,false).forEach(function(index){bindBoard(document.getElementById(battleId)?.children[index],{kind:'specialSummon',slot:index,cid:c.summonDeckCid},'ここに特殊召喚');});
    }
  }
  if(game&&['response','chain'].indexOf(game.state)>=0){
    var info=responseCardInfo(),actor=playerByKey(game.responseActorKey);
    if(info&&info.src==='tactic'&&!info.card.pendingPlacement){
      openTacticSlotIndexes(actor).forEach(function(index){
        var node=document.getElementById(playerKey(actor)==='A'?'ownTactic':'oppTactic').children[index];
        node.classList.add('legalTarget','placementTarget');node.tabIndex=0;node.setAttribute('aria-label','ここで戦術カードを発動');node._responseSlot=index;marked++;
      });
    }
  }
  if(game&&game.choice){
    var ch=choice();
    [['supportMinus',ch.supportSourceUid],['supportPlus',ch.supportSourceUid!=null?ch.responseTargetUid:null]].forEach(function(pair){
      if(pair[1]!=null)battleStageEl.querySelectorAll('.slot[data-uid="'+Number(pair[1])+'"]').forEach(function(node){node.classList.add(pair[0]);});
    });
  }
  battleStageEl.classList.toggle('awaitingSelection',marked>0);
}
function clearControlTargetPreview(){
  battleStageEl.querySelectorAll('.controlTargetPreview').forEach(function(node){node.classList.remove('controlTargetPreview');});
}
function previewControlTarget(button){
  clearControlTargetPreview();
  if(!button || !button.dataset.uid) return;
  battleStageEl.querySelectorAll('[data-zone="battle"][data-uid="'+Number(button.dataset.uid)+'"]').forEach(function(node){
    node.classList.add('controlTargetPreview');
  });
}
function cinematicHtml(){
  if(!game||!game.attack) return '';
  var atk=game.attack,word='CHAIN',modeClass='chain',detail='発動順を確定中';
  if(game.state==='resolving'){
    word='RESOLVE';modeClass='resolve';
    detail=atk.resolutionIndex>=0
      ? '次は CHAIN '+(atk.resolutionIndex+1)+'／上から逆順'
      : '全効果の処理完了／攻撃結果へ';
  }else if(game.state==='response'){
    detail=playerByKey(game.responseActorKey).name+'が応答する番';
  }else if(game.state==='chain'){
    detail=playerByKey(game.responseActorKey).name+'の連続発動タイミング';
  }else{
    word='RESULT';modeClass='result';detail='攻撃結果と事後処理';
  }
  return '<div class="flowMode '+modeClass+'"><span class="flowModeWord">'+word+'</span><span class="flowModeText">'+esc(detail)+'</span></div>';
}
function updateCinematicOverlay(){
  var html=cinematicHtml();
  duelOverlayEl.innerHTML=html;
  duelOverlayEl.className='duelOverlay'+(html?' show':'');
}
function keepFlowRailCurrentVisible(){
  var historyScroller=document.getElementById('chainPanel');
  var activeScroller=activeChainStackEl;
  if(!game||!game.attack)return;
  if(game.state==='response'||game.state==='chain'){
    if(historyScroller)historyScroller.scrollTop=0;
    if(activeScroller)activeScroller.scrollTop=0;
    return;
  }
  if(game.state!=='resolving')return;
  [historyScroller,activeScroller].forEach(function(scroller){
    if(!scroller)return;
    var current=scroller.querySelector('.resolving')||scroller.querySelector('.resolvedNow')||scroller.querySelector('.resolvingNext');
    if(!current)return;
    var rect=current.getBoundingClientRect(),box=scroller.getBoundingClientRect();
    var top=rect.top-box.top+scroller.scrollTop-8,bottom=rect.bottom-box.top+scroller.scrollTop;
    if(top<scroller.scrollTop)scroller.scrollTop=Math.max(0,top);
    else if(bottom>scroller.scrollTop+scroller.clientHeight)scroller.scrollTop=Math.max(0,bottom-scroller.clientHeight+8);
  });
}
function saveUiPrefs(){
  try{localStorage.setItem('cardSimulatorUiPrefs',JSON.stringify(uiPrefs));}catch(e){}
}
function loadUiPrefs(){
  try{
    var saved=JSON.parse(localStorage.getItem('cardSimulatorUiPrefs')||'null');
    if(saved&&typeof saved==='object') Object.keys(uiPrefs).forEach(function(key){if(saved[key]!=null)uiPrefs[key]=saved[key];});
  }catch(e){}
}
function applyUiPrefs(){
  document.body.classList.toggle('motionFast',uiPrefs.motion==='fast');
  document.body.classList.toggle('motionOff',uiPrefs.motion==='off');
  document.body.classList.toggle('cinematicsOff',!uiPrefs.cinematics);
  document.body.classList.toggle('historyCollapsed',!!uiPrefs.historyCollapsed);
  document.body.classList.toggle('chainRailCollapsed',!!uiPrefs.chainCollapsed);
  var chainPanel=document.getElementById('chainHistoryShell'),historyArea=document.querySelector('.historyArea');
  if(chainPanel)chainPanel.classList.toggle('collapsed',!!uiPrefs.chainCollapsed);
  if(historyArea)historyArea.classList.toggle('collapsed',!!uiPrefs.historyCollapsed);
  chainToggleBtn.textContent=uiPrefs.chainCollapsed?'攻防連鎖を開く':'攻防連鎖を畳む';
  historyToggleBtn.textContent=uiPrefs.historyCollapsed?'履歴を開く':'履歴を畳む';
  chainToggleBtn.setAttribute('aria-expanded',String(!uiPrefs.chainCollapsed));
  historyToggleBtn.setAttribute('aria-expanded',String(!uiPrefs.historyCollapsed));
  cinematicsToggle.checked=!!uiPrefs.cinematics;
  document.querySelectorAll('input[name="motionSpeed"]').forEach(function(input){input.checked=input.value===uiPrefs.motion;});
}
function updateModeUi(){
  var mode=game ? game.mode : match.mode;
  var isCom=mode==='com';
  simTitleEl.textContent=mode==='auto' ? '盤面シミュレーター（COM同士・全情報公開）' : isCom ? '盤面シミュレーター（対COM・相手情報非公開）' : '盤面シミュレーター（両者手動・全情報公開）';
  modeFooterEl.textContent=mode==='auto' ? 'COM AとCOM Bが3秒ごとに一手ずつ進めます。両者の手札を表示し、マッチ終了まで自動で進みます。' : isCom
    ? '対COM版です。あなたは下側を操作します。COMの手札と伏せ罠は非公開で、COMは3秒ごとに一手進めます。'
    : 'これはルール検証用シミュレーターです。AさんとBさんの判断はすべて手動で操作します。本来は非公開の相手の手札・伏せ札も含めて全情報を表示しています。';
  startBtn.textContent=game && game.mode==='manual' ? '両者手動をやり直す' : '両者手動で開始';
  comStartBtn.textContent=game && game.mode==='com' ? '対COMをやり直す' : '対COMバージョン';
  autoStartBtn.textContent=game && game.mode==='auto' ? 'COM同士をやり直す' : 'COM同士を観戦';
  var autoPauseBtn=document.getElementById('autoPauseBtn');
  autoPauseBtn.hidden=!(game&&game.mode==='auto'&&game.state!=='matchOver');
  autoPauseBtn.textContent=game&&game.autoPaused?'▶ 再生':'⏸ 一時停止';
  autoPauseBtn.setAttribute('aria-label',game&&game.autoPaused?'COM同士の対戦を再生':'COM同士の対戦を一時停止');
  scoreEl.textContent=mode==='auto' ? '対戦成績：COM A '+match.scoreA+'勝 ／ COM B '+match.scoreB+'勝' : isCom
    ? '対戦成績：あなた '+match.scoreA+'勝 ／ COM '+match.scoreB+'勝'
    : '対戦成績：'+match.scoreA+' vs '+match.scoreB;
}
function updateAttackingSideHighlight(){
  var attackingKey=(!game||game.state==='gameOver'||game.state==='matchOver')?null:(game.attack?game.attack.attackerKey:game.turnKey);
  document.getElementById('ownHalf').classList.toggle('attackingSide',attackingKey==='A');
  document.getElementById('oppHalf').classList.toggle('attackingSide',attackingKey==='B');
}
function render(){
  if(game&&game.state==='awaitTacticSelection'&&uiPrefs.chainCollapsed){
    uiPrefs.chainCollapsed=false;chainAutoOpened=true;applyUiPrefs();
  }else if(game&&!chainAutoOpened&&['awaitTacticSelection','attackDeclare','response','chain','resolving','penalty','tieChoice'].indexOf(game.state)!==-1){
    uiPrefs.chainCollapsed=false;chainAutoOpened=true;applyUiPrefs();
  }
  updateModeUi();
  battleStageEl.dataset.gameState=game?game.state:'welcome';
  if(game){
    var showPreparedTactics=game.mode==='com'&&game.humanTacticsReady&&!game.A.tacticSelected&&game.standbyKey==='B'&&['standby','mulliganConfirm'].indexOf(game.state)>=0;
    var ownRole=game.A.isFirst ? '先攻' : '後攻';
    var oppRole=game.B.isFirst ? '先攻' : '後攻';
    var ownHandType=openingTacticSelectionActive()?'戦術手札（選択中）':showPreparedTactics?'戦術手札':game.A.tacticSelected?'戦術手札':'メイン手札';
    var oppHandType=game.B.tacticSelected?'戦術手札':'メイン手札';
    document.getElementById('ownHandLabel').textContent='自分（'+game.A.name+'・'+ownRole+'）の'+ownHandType;
    document.getElementById('ownBattleLabel').textContent='自分（'+game.A.name+'・'+ownRole+'）のバトルエリア';
    document.getElementById('oppHandLabel').textContent='相手（'+game.B.name+'・'+oppRole+'）の'+oppHandType+(game.mode==='com'?'（非公開）':'');
    document.getElementById('oppBattleLabel').textContent='相手（'+game.B.name+'・'+oppRole+'）のバトルエリア';
    document.getElementById('ownBattle').innerHTML = battleHtml(game.A);
    document.getElementById('ownTactic').innerHTML = tacticHtml(game.A,hideTrapDetails(game.A));
    document.getElementById('ownMainDeck').innerHTML = pileHtml(game.A.mainDeck,true);
    document.getElementById('ownTacticDeck').innerHTML = pileHtml(tacticDeckView(game.A),true);
    document.getElementById('ownRetreat').innerHTML = pileHtml(game.A.retreat,false);
    document.getElementById('ownExclusion').innerHTML = pileHtml(game.A.exclusion,false);
    document.getElementById('ownHand').innerHTML = openingTacticSelectionActive() ? openingTacticHandHtml() : showPreparedTactics?selectedTacticHandHtml(game.A.tacticHand):handHtml(game.A);
    var showSelectedTactics=game.mode==='com' && !game.A.isFirst && game.humanTacticsReady && !game.A.tacticSelected;
    document.getElementById('ownSelectedTacticPreview').hidden=!showSelectedTactics;
    document.getElementById('ownSelectedTacticHand').innerHTML=showSelectedTactics ? selectedTacticHandHtml(game.A.tacticHand) : '';
    document.getElementById('oppBattle').innerHTML = battleHtml(game.B);
    document.getElementById('oppTactic').innerHTML = tacticHtml(game.B,hideTrapDetails(game.B));
    document.getElementById('oppMainDeck').innerHTML = pileHtml(game.B.mainDeck,true);
    document.getElementById('oppTacticDeck').innerHTML = pileHtml(tacticDeckView(game.B),true);
    document.getElementById('oppRetreat').innerHTML = pileHtml(game.B.retreat,false);
    document.getElementById('oppExclusion').innerHTML = pileHtml(game.B.exclusion,false);
    document.getElementById('oppHand').innerHTML = game.mode==='com' ? hiddenHandHtml(game.B) : handHtml(game.B);
  }else{
    ['ownBattle','ownTactic','ownMainDeck','ownTacticDeck','ownRetreat','ownExclusion','ownHand','ownSelectedTacticHand',
      'oppBattle','oppTactic','oppMainDeck','oppTacticDeck','oppRetreat','oppExclusion','oppHand'].forEach(function(id){
      document.getElementById(id).innerHTML = '';
    });
    document.getElementById('ownSelectedTacticPreview').hidden=true;
  }
  updateAttackingSideHighlight();
  chainEl.innerHTML = chainPanelHtml();
  var selectionPanel=selectionPanelHtml();
  selectionPanelEl.hidden=!selectionPanel;
  battleStageEl.classList.toggle('selectingCards',!!selectionPanel);
  if(selectionPanel){selectionPanelTitleEl.textContent=selectionPanel.title;selectionPanelContentEl.innerHTML=selectionPanel.html;}
  activeChainStackEl.innerHTML = activeChainStackHtml();
  var resolutionHtml = resolutionBannerHtml();
  resolutionEl.innerHTML = resolutionHtml;
  resolutionEl.className = 'resolutionBanner' + (resolutionHtml ? ' show' : '');
  renderControls();
  decorateInspectableControls();
  decorateLegalTargets();
  updateCinematicOverlay();
  var flowRail=document.getElementById('activeFlowRail');
  if(flowRail)flowRail.hidden=!duelOverlayEl.classList.contains('show')&&!resolutionHtml;
  requestAnimationFrame(keepFlowRailCurrentVisible);
  updateInspectorFromState();
  updateHistoryButtons();
  queueComIfNeeded();
  window.dispatchEvent(new CustomEvent('duel:render'));
}

function cancelComTimer(){
  if(comTimer){clearTimeout(comTimer);comTimer=null;}
  comTimerToken++;
}
function startMatch(mode, firstKey){
  cancelComTimer();
  match = {scoreA:0,scoreB:0,gameNo:1,mode:mode||'manual'};
  logEl.innerHTML = '';
  startGame(match.mode, firstKey);
}
function startGame(mode, firstKeyOverride){
  cancelComTimer();setupTransitionPending=false;
  chainAutoOpened=false;uiPrefs.chainCollapsed=true;applyUiPrefs();
  mode=mode || match.mode || 'manual';
  var firstKey = firstKeyOverride==='A'||firstKeyOverride==='B' ? firstKeyOverride : (Math.random()<0.5 ? 'A' : 'B');
  game = {
    A:newPlayer(mode==='auto'?'COM A':mode==='com'?'あなた':'Aさん',firstKey==='A',A_CHAR_NAMES),
    B:newPlayer(mode==='auto'?'COM B':mode==='com'?'COM':'Bさん',firstKey==='B',B_CHAR_NAMES),
    mode:mode, humanKey:'A', comKey:'B', firstKey:firstKey, isDraw:false,
    state:mode==='com'||mode==='auto'?'coinToss':'standby', standbyKey:null, turnKey:null, turnCount:0,
    attack:null, lastChainHistory:[], lastChainDisplayHistory:[],
    responseActorKey:null, penalty:null, tieChoice:null, choice:null,
    humanTacticSelection:new Set(), humanTacticsReady:false, pendingSetupAction:null
  };
  clearChoice();
  gameHeader('ゲーム' + match.gameNo);
  var first=playerByKey(firstKey);
  var second=other(first);
  log('先攻後攻をランダム決定：'+first.name+'が先攻／'+second.name+'が後攻','phaseLine');
  if(mode==='com'||mode==='auto'){
    phase('先攻後攻の抽選結果');
    status('先攻：'+first.name+' ／ 後攻：'+second.name+'　3秒後に開始します');
    render();
  }else{
    beginStandby(first,'先攻スタンバイフェイズ（'+first.name+'が盤面構築）');
  }
}
function beginStandby(p,title){
  if(!p.isFirst&&other(p).standbyComplete&&!setupTransitionPending){
    var currentGame=game,previousStartup=startupPending;setupTransitionPending=true;startupPending=true;cancelComTimer();
    var event=new CustomEvent('duel:standby-transition',{cancelable:true,detail:{
      prepare:function(){if(game!==currentGame)return;setupTransitionPending=true;startupPending=true;cancelComTimer();beginStandbyNow(p,title);},
      done:function(){if(game!==currentGame)return;setupTransitionPending=false;startupPending=false;render();}
    }});
    if(!window.dispatchEvent(event))return;
    setupTransitionPending=false;startupPending=previousStartup;
  }
  beginStandbyNow(p,title);
}
function beginStandbyNow(p, title){
  game.state = 'standby';
  game.standbyKey = playerKey(p);
  game.standbyTitle = title;
  p.tacticSelected = false;
  if(!p.openingMainDealt){
    p.mainHand = p.mainDeck.splice(0,7);
    p.openingMainDealt=true;
    log(p.name + '：メインデッキから7枚ドロー');
  }
  if(game.mode==='com' && p===game.B) prepareComOpeningTactics();
  if(game.mode==='auto' && !p.openingTacticsReady) drawOpeningTactics(p);
  phase(title);
  status(game.mode==='auto' ? p.name+'が3秒ごとに盤面を構築します' : game.mode==='com' && p===game.B ? 'COMが3秒ごとに盤面を構築します。あなたは戦術カード7枚を選んでください' : p.name + 'のスタンバイを手動で操作してください');
  log('■ ' + title,'phaseLine');
  clearChoice();
  if(requireOpeningHandConfirmation(p)) return;
  render();
}
function requireOpeningHandConfirmation(p){
  if(p.mainHand.some(function(x){ return x.type === 'character'; })) return false;
  game.state = 'mulliganConfirm';
  phase(game.standbyTitle + '：初期手札確認');
  status(game.mode==='auto' ? '公開された7枚を相手COMが3秒後に確認します' : game.mode==='com' && other(p)===game.B
    ? 'COMが3秒後に公開された7枚を確認します'
    : other(p).name + 'は公開された7枚にキャラがないことを確認してください');
  log(p.name + '：キャラがないため初期手札7枚をすべて公開');
  log('公開した手札：' + cardsInTypeOrder(p.mainHand).map(label).join(' ／ '));
  render();
  return true;
}
function confirmMulligan(){
  var p = playerByKey(game.standbyKey);
  var verifier = other(p);
  log(verifier.name + '：公開された手札にキャラがないことを確認');
  p.mainDeck = shuffle(p.mainDeck.concat(p.mainHand));
  p.mainHand = p.mainDeck.splice(0,7);
  log(p.name + '：手札をすべてデッキへ戻してシャッフルし、7枚を再ドロー');
  clearChoice();
  game.state = 'standby';
  phase(game.standbyTitle);
  status(game.mode==='auto' ? p.name+'が盤面構築を続けます' : p.name + 'のスタンバイを手動で操作してください');
  if(requireOpeningHandConfirmation(p)) return;
  render();
}
function drawOpeningTactics(p){
  p.tacticHand = p.tacticDeck.splice(0,7);
  p.tacticDrawPool = p.tacticDeck.splice(0);
  p.openingTacticsReady=true;
  p.tacticSelected = p.standbyComplete;
  log(p.name + '：戦術デッキから最初の手札を7枚ドロー');
}
function prepareComOpeningTactics(){
  if(game.B.openingTacticsReady) return;
  drawOpeningTactics(game.B);
  log('COM：戦術手札7枚を非公開で準備');
}
function finishComStandby(p){
  p.standbyComplete=true;
  p.tacticSelected=p.openingTacticsReady;
  if(p===game.B){prepareComOpeningTactics();p.tacticSelected=true;}
  var first=playerByKey(game.firstKey);
  if(p===first){
    if(p===game.B && !game.humanTacticsReady){
      game.state='awaitTacticSelection';
      game.pendingSetupAction='beginSecond';
      phase('戦術手札の選択待ち');
      status('戦術デッキから最初の手札7枚を選んでください');
      render();
      return;
    }
    beginStandby(other(first),'後攻スタンバイフェイズ（'+other(first).name+'が盤面構築）');
    return;
  }
  if(!game.humanTacticsReady){
    game.state='awaitTacticSelection';
    game.pendingSetupAction='beginTurns';
    phase('戦術手札の選択待ち');
    status('戦術デッキから最初の手札7枚を選んでください');
    render();
    return;
  }
  game.A.tacticSelected=true;
  beginTurn(first);
}
function finishStandby(){
  var p = playerByKey(game.standbyKey);
  if(p.mainHand.length || p.tempPlayed.some(function(x){return x.type==='exp';})) return;
  p.standbyComplete=true;
  if(game.A.standbyComplete&&game.B.standbyComplete&&!game.battlePhaseAnnounced){game.battlePhaseAnnounced=true;window.dispatchEvent(new CustomEvent('duel:battle-phase'));}
  log(p.name + '：スタンバイフェイズ終了');
  if(game.mode==='auto'){
    p.standbyComplete=true;
    p.tacticSelected=true;
    var autoFirst=playerByKey(game.firstKey);
    if(p===autoFirst) beginStandby(other(p),'後攻スタンバイフェイズ（'+other(p).name+'が盤面構築）');
    else beginTurn(autoFirst);
    return;
  }
  if(game.mode==='com'){finishComStandby(p);return;}
  p.standbyComplete=true;
  var first=playerByKey(game.firstKey);
  if(p === first){
    var second=other(first);
    drawOpeningTactics(second);
    beginStandby(second,'後攻スタンバイフェイズ（'+second.name+'が盤面構築）');
  }else{
    p.tacticSelected = true;
    drawOpeningTactics(first);
    first.tacticSelected=true;
    beginTurn(first);
  }
}
function completeHumanTacticSelection(automatic){
  if(game.mode!=='com' || game.humanTacticsReady || game.humanTacticSelection.size!==7) return;
  var selectedIds=game.humanTacticSelection;
  var selected=game.A.tacticDeck.filter(function(x){return selectedIds.has(x.cid);});
  if(selected.length!==7) return;
  var remaining=game.A.tacticDeck.filter(function(x){return !selectedIds.has(x.cid);});
  game.A.tacticHand=selected;
  game.A.tacticDrawPool=shuffle(remaining);
  game.A.tacticDeck=[];
  game.A.openingTacticsReady=true;
  game.A.tacticSelected=game.A.standbyComplete;
  game.humanTacticsReady=true;
  log(automatic?'あなた：戦術デッキから最初の戦術手札7枚を自動で選び、残りをシャッフル':'あなた：選んだ7枚を最初の戦術手札にし、残りをシャッフル');
  if(game.state==='awaitTacticSelection'){
    var next=game.pendingSetupAction;
    game.pendingSetupAction=null;
    if(next==='beginSecond'){
      var first=playerByKey(game.firstKey);
      beginStandby(other(first),'後攻スタンバイフェイズ（'+other(first).name+'が盤面構築）');
      return;
    }
    if(next==='beginTurns'){
      game.A.tacticSelected=true;
      beginTurn(playerByKey(game.firstKey));
      return;
    }
  }
  status(automatic?'戦術手札7枚を自動で選びました。COMの盤面構築を確認してください':'戦術手札7枚を選択しました。COMの盤面構築を確認してください');
}
function autoSelectOpeningTactics(){
  if(game.mode!=='com' || game.humanTacticsReady || game.A.tacticDeck.length<7) return;
  var selected=shuffle(game.A.tacticDeck.slice()).slice(0,7);
  game.humanTacticSelection=new Set(selected.map(function(x){return x.cid;}));
  status('自動で選んだ7枚を手札に表示しました。確認して確定してください');
}
function comActionPending(){
  if(!game || (game.mode!=='com' && game.mode!=='auto')) return false;
  if(game.autoPaused) return false;
  if(game.mode==='auto') return ['coinToss','standby','mulliganConfirm','turnDraw','attackDeclare','response','chain','resolving','penalty','tieChoice','gameOver'].indexOf(game.state)!==-1;
  if(game.state==='coinToss') return true;
  if(game.state==='standby') return game.standbyKey==='B';
  if(game.state==='mulliganConfirm') return other(playerByKey(game.standbyKey))===game.B;
  if(game.state==='turnDraw') return game.turnKey==='B';
  if(game.state==='attackDeclare') return game.turnKey==='B';
  if(game.state==='response' || game.state==='chain') return game.responseActorKey==='B';
  if(game.state==='resolving') return !humanResolutionChoiceRequired();
  if(game.state==='penalty') return game.penalty && game.penalty.playerKey==='B';
  if(game.state==='tieChoice') return game.attack && game.attack.defenderKey==='B';
  return false;
}
function queueComIfNeeded(){
  if(startupPending || isDialogOpen() || !comActionPending() || comTimer) return;
  var token=comTimerToken;
  comTimer=setTimeout(function(){
    comTimer=null;
    if(token!==comTimerToken || !comActionPending()) return;
    recordHistory();
    runComStep();
    render();
  },COM_DELAY);
}
function runComStep(){
  if(game.state==='coinToss'){
    var first=playerByKey(game.firstKey);
    beginStandby(first,'先攻スタンバイフェイズ（'+first.name+'が盤面構築）');
  }else if(game.state==='mulliganConfirm'){
    confirmMulligan();
  }else if(game.state==='standby'){
    comStandbyStep();
  }else if(game.state==='turnDraw'){
    resolveTurnDraw();
  }else if(game.state==='attackDeclare'){
    comDeclareAttack();
  }else if(game.state==='response' || game.state==='chain'){
    comResponseStep();
  }else if(game.state==='resolving'){
    comResolutionStep();
  }else if(game.state==='penalty'){
    comPenaltyStep();
  }else if(game.state==='tieChoice'){
    comTieChoiceStep();
  }else if(game.state==='gameOver' && game.mode==='auto'){
    match.gameNo++;
    startGame('auto');
  }
}
function prepareComStandbyChoice(c){
  clearChoice();
  choice().standbyCard=c.cid;
  return c;
}
function discardStandbyCard(p,c){
  var removed=takeCard(p.mainHand,c.cid);
  if(removed){sendToRetreat(p,removed);log(p.name+'：'+label(removed)+'を使用せず捨てた');}
  clearChoice();
}
function comStandbyStep(){
  var p=playerByKey(game.standbyKey);
  if(!p.mainHand.length){finishStandby();return;}
  var ordered=cardsInTypeOrder(p.mainHand),c,target,deckChar,topTrap,others;
  c=ordered.find(function(x){return x.type==='character' && p.battleArea.length<5;});
  if(c){prepareComStandbyChoice(c);summonCharacter(p,c,openBattleSlotIndexes(p,false)[0]);return;}
  c=ordered.find(function(x){return x.type==='exp' && (x.kind==='summon'||x.kind==='summonShuffleDraw') && p.battleArea.length<5 && p.mainDeck.some(function(d){return d.type==='character';});});
  if(c){
    deckChar=p.mainDeck.filter(function(x){return x.type==='character';})[0];
    prepareComStandbyChoice(c);specialSummon(p,c,deckChar.cid,openBattleSlotIndexes(p,false)[0]);return;
  }
  c=ordered.find(function(x){return x.type==='exp' && x.kind==='searchCharacter' && p.mainDeck.some(function(d){return d.type==='character';});});
  if(c){
    deckChar=p.mainDeck.filter(function(x){return x.type==='character';})[0];
    prepareComStandbyChoice(c);searchCharacterToHand(p,c,deckChar.cid);return;
  }
  c=ordered.find(function(x){return x.type==='exp' && x.kind==='growth' && p.battleArea.some(function(ch){return ch.level<3;});});
  if(c){
    target=p.battleArea.filter(function(ch){return ch.level<3;}).sort(function(a,b){return a.level-b.level;})[0];
    prepareComStandbyChoice(c);useExpansionTarget(p,c,target.uid);return;
  }
  c=ordered.find(function(x){return x.type==='trap' && tacticSlotsOpen(p)>0;});
  if(c){prepareComStandbyChoice(c);setTrap(p,c);return;}
  c=ordered.find(function(x){return x.type==='exp' && x.kind==='defensePrep';});
  if(c){
    topTrap=p.mainDeck.slice(0,3).find(function(x){return x.type==='trap';});
    prepareComStandbyChoice(c);resolveDefensePrep(p,c,topTrap&&tacticSlotsOpen(p)>0?topTrap.cid:null);return;
  }
  c=ordered.find(function(x){return x.type==='exp' && x.kind==='draw2discard2' && p.mainHand.length>=3;});
  if(c){
    others=p.mainHand.filter(function(x){return x.cid!==c.cid;}).sort(function(a,b){return comDiscardPriority(b,p)-comDiscardPriority(a,p);}).slice(0,2);
    prepareComStandbyChoice(c);
    choice().discard=new Set(others.map(function(x){return x.cid;}));
    resolveDrawTwo(p,c);return;
  }
  c=ordered.find(function(x){return x.type==='exp' && x.kind==='draw1';});
  if(c){prepareComStandbyChoice(c);resolveDrawOne(p,c);return;}
  c=ordered.find(function(x){return x.type==='exp';});
  if(c){
    prepareComStandbyChoice(c);
    if(c.kind==='summon'||c.kind==='summonShuffleDraw') finishExpansionAfterSummon(p,c);
    else consumeStandbyCard(p,c);
    log(p.name+'：'+label(c)+'を対象なしで処理');
    return;
  }
  discardStandbyCard(p,ordered[0]);
}
function comDiscardPriority(c,p){
  if(c.type==='character') return p.battleArea.length>=5?100:15;
  if(c.type==='trap') return tacticSlotsOpen(p)<=0?90:25;
  if(c.kind==='growth') return p.battleArea.some(function(x){return x.level<3;})?20:85;
  if(c.kind==='summon'||c.kind==='summonShuffleDraw'||c.kind==='searchCharacter') return p.battleArea.length>=5?80:20;
  return 35;
}
function comDeclareAttack(){
  var p=playerByKey(game.turnKey),op=other(p),best=null,n=p.battleArea.length;
  if(!n || !op.battleArea.length){attackPass();return;}
  op.battleArea.forEach(function(target){
    for(var mask=1;mask<(1<<n);mask++){
      var attackers=[],sum=0;
      for(var i=0;i<n;i++) if(mask&(1<<i)){attackers.push(p.battleArea[i]);sum+=p.battleArea[i].level;}
      if(attackers.length>1 && sum>target.level+1) continue;
      var score;
      if(sum>target.level) score=120+target.level*12-sum-attackers.length*3;
      else if(sum===target.level && attackers.length===1) score=65+target.level*4;
      else if(sum===target.level) score=48+target.level*3-attackers.length*2;
      else score=10-(target.level-sum)*8-attackers.length;
      score+=Math.random()*2;
      if(!best || score>best.score) best={score:score,target:target,attackers:attackers};
    }
  });
  if(!best){attackPass();return;}
  clearChoice();
  choice().attackers=new Set(best.attackers.map(function(x){return x.uid;}));
  choice().targetUid=best.target.uid;
  declareAttack();
}
function currentBattlePower(ch){
  var base=ch.level==null?1:ch.level;
  return Math.max(0,base+((game.attack&&game.attack.mods[ch.uid])||0));
}
function strongestCharacter(list){
  return (list||[]).slice().sort(function(a,b){return currentBattlePower(b)-currentBattlePower(a);})[0]||null;
}
function weakestCharacter(list){
  return (list||[]).slice().sort(function(a,b){return currentBattlePower(a)-currentBattlePower(b);})[0]||null;
}
function comReservedTacticCids(actor){
  var reserved=new Set();
  if(!game || !game.attack)return reserved;
  game.attack.chainHistory.forEach(function(entry){
    if(entry.actorKey===playerKey(actor) && entry.kind==='strategyShift' && entry.status==='pending' && !entry.negated){
      (entry.payload.ids||[]).forEach(function(cid){reserved.add(Number(cid));});
    }
  });
  return reserved;
}
function comReservedReviveTargetUids(actor){
  if(!game) return new Set();
  return reservedReviveTargetUids(actor);
}
function comResponsePlan(info){
  var card=info.card,kind=card.kind,atk=game.attack,actor=playerByKey(game.responseActorKey),op=other(actor),actorKey=playerKey(actor),opKey=playerKey(op);
  var own=attackParticipants(actorKey),enemy=attackParticipants(opKey),ownBoard=actor.battleArea.slice(),enemyBoard=op.battleArea.slice(),payload={},score=0,target,targets,index;
  var ownTotal=attackTotal(actorKey),enemyTotal=attackTotal(opKey),needsPower=ownTotal<=enemyTotal;
  if(info.src==='tactic'){
    var openZoneSlots=openTacticSlotIndexes(actor);
    if(!openZoneSlots.length)return null;
    payload.zoneSlot=openZoneSlots[0];
  }
  if(kind==='buff1'){
    target=strongestCharacter(own)||strongestCharacter(ownBoard);if(!target)return null;payload.targetUid=target.uid;score=needsPower?95:35;
  }else if(kind==='debuff1'||kind==='levelDown'){
    target=strongestCharacter(enemy)||strongestCharacter(enemyBoard);if(!target)return null;payload.targetUid=target.uid;score=needsPower?96:42;
  }else if(kind==='buffAll1'||kind==='debuffAll1'){
    if(!(kind==='buffAll1'?own.length:enemy.length))return null;score=needsPower?100:38;
  }else if(kind==='namedShift'){
    targets=ownBoard.filter(function(x){return x.name===card.targetName;});
    target=strongestCharacter(targets);
    if(!target){targets=enemyBoard.filter(function(x){return x.name===card.targetName;});target=strongestCharacter(targets);}
    if(!target)return null;payload.targetUid=target.uid;score=needsPower?110:45;
  }else if(kind==='redirect'){
    targets=playerByKey(atk.defenderKey).battleArea.filter(function(x){return x.uid!==atk.targetUid;});
    if(!targets.length)return null;
    target=atk.attackerKey===actorKey?weakestCharacter(targets):strongestCharacter(targets);
    payload.targetUid=target.uid;score=72;
  }else if(kind==='revive'){
    var reviveSlots=openBattleSlotIndexes(actor,true);
    if(!reviveSlots.length)return null;
    var reservedReviveTargets=comReservedReviveTargetUids(actor);
    target=strongestCharacter(actor.retreat.filter(function(x){return x.name&&!reservedReviveTargets.has(Number(x.uid));}));
    if(!target)return null;payload.targetUid=target.uid;payload.battleSlot=reviveSlots[0];score=70;
  }else if(kind==='reviveFromRetreat'){
    var trapReviveSlots=openBattleSlotIndexes(actor,true);
    if(!trapReviveSlots.length)return null;
    var reservedTrapReviveTargets=comReservedReviveTargetUids(actor);
    target=strongestCharacter(actor.retreat.filter(function(x){return (x.type==='character'||x.name)&&!reservedTrapReviveTargets.has(Number(x.uid));}));
    if(!target)return null;payload.targetUid=target.uid;payload.battleSlot=trapReviveSlots[0];score=74;
  }else if(kind==='peek2'){
    if(!op.tacticHand.length)return null;score=32;
  }else if(kind==='drawTactic2'){
    if(!actor.tacticDrawPool.length)return null;score=actor.tacticHand.length<=3?82:46;
  }else if(kind==='recycle'){
    target=actor.retreat.find(function(x){return x.type==='tactic';});
    if(!target)return null;payload.ids=[target.cid];score=55;
  }else if(kind==='strategyShift'){
    var reservedTactics=comReservedTacticCids(actor);
    var shiftCandidates=actor.tacticHand.filter(function(x){return x.cid!==card.cid&&!reservedTactics.has(Number(x.cid));});
    target=shiftCandidates.find(function(x){return !x.chain;})||shiftCandidates[0];
    if(!target)return null;payload.ids=[target.cid];score=48;
  }else if(kind==='negateTrap'){
    for(index=atk.chainHistory.length-1;index>=0;index--){
      var entry=atk.chainHistory[index];
      if(entry.src==='trap'&&entry.actorKey!==actorKey&&entry.status==='pending'&&!entry.negated)break;
    }
    if(index<0)return null;payload.targetIndex=index;score=92;
  }else if(kind==='splitAttack'){
    if(atk.defenderKey!==actorKey||attackParticipants(atk.attackerKey).length<3)return null;
    target=strongestCharacter(attackParticipants(atk.attackerKey));payload.targetUid=target.uid;score=105;
  }else if(kind==='supportDefense'){
    if(atk.defenderKey!==actorKey)return null;
    target=strongestCharacter(actor.battleArea.filter(function(x){return x.uid!==atk.targetUid&&currentBattlePower(x)>0;}));
    if(!target)return null;payload.targetUid=target.uid;payload.recipientUid=atk.targetUid;score=needsPower?98:40;
  }else if(kind==='lastStand'){
    if(own.length!==1||enemy.length<2)return null;score=needsPower?108:45;
  }else if(kind==='removePower1'){
    var activePowerOne=enemy.filter(function(x){return currentBattlePower(x)===1;});
    target=strongestCharacter(activePowerOne)||strongestCharacter(enemyBoard.filter(function(x){return currentBattlePower(x)===1;}));
    if(!target)return null;payload.targetUid=target.uid;score=112;
  }else if(kind==='forceEnd'){
    score=ownTotal>enemyTotal?115:28;
  }else if(kind==='lockZone'){
    var lockTargets=lockableZoneSlotIndexes(op);
    if(!lockTargets.length)return null;
    payload.lockSlot=lockTargets[0];score=60;
  }else if(kind==='skipAttack'){
    score=60;
  }else{
    score=45;
  }
  return {info:info,payload:payload,score:score+Math.random()*4};
}
function comResponseStep(){
  var isChain=game.state==='chain',actor=playerByKey(game.responseActorKey),atk=game.attack,open=tacticSlotsOpen(actor);
  var reservedTactics=comReservedTacticCids(actor);
  var cards=cardsInTypeOrder(actor.trapZone.concat(actor.tacticHand)).filter(function(x){
    if(!!x.chain!==isChain)return false;
    if(x.type==='trap')return !atk.usedTraps.has(x.cid);
    return open>0&&!reservedTactics.has(Number(x.cid));
  });
  var plans=cards.map(function(x){return comResponsePlan({src:x.type==='trap'?'trap':'tactic',card:x});}).filter(Boolean).sort(function(a,b){return b.score-a.score;});
  var ownTotal=attackTotal(playerKey(actor)),enemyTotal=attackTotal(playerKey(other(actor)));
  var threshold=isChain?50:(ownTotal<=enemyTotal?30:56);
  if(!plans.length||plans[0].score<threshold){
    if(isChain)endChain();else responsePass();
    return;
  }
  var plan=plans[0];
  clearChoice();
  choice().responseCard=plan.info.card.cid;
  if(consumeResponse(plan.info,plan.payload)) finishResponsePlay(plan.info.card.kind);
  else if(isChain)endChain();else responsePass();
}
function comResolutionStep(){
  var atk=game.attack;
  if(atk.pendingPeekAcknowledgementIndex!=null){
    var acknowledgedEntry=atk.chainHistory[atk.pendingPeekAcknowledgementIndex];
    if(game.mode!=='auto' && acknowledgedEntry.actorKey!=='B')return;
    acknowledgePeek();
  }else if(atk.pendingPeekIndex!=null){
    var entry=atk.chainHistory[atk.pendingPeekIndex];
    if(game.mode!=='auto' && entry.actorKey!=='B')return;
    var op=other(playerByKey(entry.actorKey)),max=Math.min(2,op.tacticHand.length);
    clearChoice();
    choice().effect=new Set(op.tacticHand.slice(0,max).map(function(x){return x.cid;}));
    resolvePeekSelection();
  }else if(atk.resolutionIndex>=0){
    resolveNextEffect();
  }else{
    resolveAttack();
  }
}
function comPenaltyStep(){
  var p=playerByKey(game.penalty.playerKey),resources=cardsInTypeOrder(p.trapZone.concat(p.tacticHand));
  var need=Math.min(game.penalty.count,resources.length);
  clearChoice();
  choice().penalty=new Set((need?resources.slice(-need):[]).map(function(x){return x.cid;}));
  resolvePenalty();
}
function resolveTieVictim(uid){
  var p=playerByKey(game.attack.attackerKey),x=findChar(p,uid);
  if(!x)return;
  moveToRetreat(p,x);
  var chooser=playerByKey(game.attack.defenderKey);
  log(chooser.name+'が「'+x.name+'」を撤退対象に選択');
  var zeroRemoved=removeZeroPowerAfterResult();
  game.attack.resolutionMessage={
    title:'攻撃結果：同数',
    detail:chooser.name+'が「'+x.name+'」を撤退'+(zeroRemoved.length?'。さらにLv0のキャラを撤退':'')
  };
  finishAttack();
}
function comTieChoiceStep(){
  var target=strongestCharacter(attackParticipants(game.attack.attackerKey));
  if(target)resolveTieVictim(target.uid);
}
function beginTurn(p){
  if(checkEnd()) return;
  game.turnCount++;
  game.state = 'turnDraw';
  game.turnKey = playerKey(p);
  clearChoice();
  phase('ターンチェンジ：' + p.name + 'のターン');
  log('■ ターンチェンジ：' + p.name + 'のターン','phaseLine');
  status(p.skipNextAttack ? p.name + 'は攻撃宣言をスキップします' : p.name + 'のドローステップです');
  render();
}

function renderControls(){
  if(!game){
    controlsEl.innerHTML = '<div class="controlsTitle">操作</div><div class="controlsText">上部から対戦モードを選んでください。</div>';
    return;
  }
  var html = '<div class="controlsTitle">操作</div>';
  if(game.mode==='auto'){
    var actor=game.state==='standby'?playerByKey(game.standbyKey):game.state==='response'||game.state==='chain'?playerByKey(game.responseActorKey):game.state==='turnDraw'||game.state==='attackDeclare'?playerByKey(game.turnKey):null;
    html+='<div class="controlsText"><span class="modeBadge">COM同士の自動対戦</span></div>';
    html+='<div class="valueBox">'+esc(game.state==='matchOver'?'マッチ終了':game.state==='gameOver'?'3秒後に次のゲームへ':game.state==='coinToss'?'先攻後攻の抽選結果を表示中':actor?actor.name+'が思考中':'効果と攻撃結果を処理中')+'</div>';
    if(game.state!=='matchOver')html+='<div class="controlsText">'+(game.autoPaused?'一時停止中':'3秒ごとに一手進みます。')+'</div>'+btn('toggle-auto',game.autoPaused?'再開':'一時停止',{},'primary');
    controlsEl.innerHTML=html;
    return;
  }
  if(game.state === 'coinToss') html += coinTossControls();
  else if(game.state === 'awaitTacticSelection') html += openingTacticSelectionControls();
  else if(game.state === 'standby' && game.mode==='com' && game.standbyKey==='B') html += comStandbyControls();
  else if(game.state === 'standby') html += standbyControls();
  else if(game.state === 'mulliganConfirm') html += mulliganControls();
  else if(game.state === 'turnDraw' && game.mode==='com' && game.turnKey==='B') html += automaticControls('COMのターン開始処理');
  else if(game.state === 'turnDraw') html += '<div class="activeDecision">'+drawControls()+'</div>';
  else if(game.state === 'attackDeclare' && game.mode==='com' && game.turnKey==='B') html += automaticControls('COMが攻撃方法を検討中');
  else if(game.state === 'attackDeclare') html += attackControls();
  else if(game.state === 'response' && game.mode==='com' && game.responseActorKey==='B') html += automaticControls('COMが応答を検討中');
  else if(game.state === 'response') html += responseControls(false);
  else if(game.state === 'chain' && game.mode==='com' && game.responseActorKey==='B') html += automaticControls('COMが連続発動を検討中');
  else if(game.state === 'chain') html += responseControls(true);
  else if(game.state === 'resolving' && game.mode==='com' && !humanResolutionChoiceRequired()) html += automaticResolutionControls();
  else if(game.state === 'resolving') html += resolutionControls();
  else if(game.state === 'penalty' && game.mode==='com' && game.penalty.playerKey==='B') html += automaticControls('COMがパスペナルティの除外カードを選択中');
  else if(game.state === 'penalty') html += penaltyControls();
  else if(game.state === 'tieChoice' && game.mode==='com' && game.attack.defenderKey==='B') html += automaticControls('COMが撤退させる攻撃キャラを選択中');
  else if(game.state === 'tieChoice') html += tieControls();
  else if(game.state === 'gameOver') html += game.isDraw
    ? '<div class="controlsText">完全同点のため、このゲームは無効です。</div>' + btn('next-game','再試合へ',{},'primary')
    : '<div class="controlsText">このゲームは終了しました。</div>' + btn('next-game','次のゲームへ',{},'primary');
  else if(game.state === 'matchOver') html += '<div class="controlsText">マッチ終了です。「対戦をやり直す」で最初から始められます。</div>';
  if(game.mode!=='auto'&&!(game.mode==='com'&&((game.state==='standby'&&game.standbyKey==='B')||(['response','chain'].indexOf(game.state)>=0&&game.responseActorKey==='B')))){
    var selected=choice();
    if((game.state==='standby'&&selected.standbyCard!=null&&!selected.expansionActivated)||(['response','chain'].indexOf(game.state)>=0&&selected.responseCard!=null)||(game.state==='attackDeclare'&&(selected.attackers.size||selected.targetUid!=null)))html+=btn('cancel-selection','キャンセル',{},'');
  }
  controlsEl.innerHTML = html;
}
function automaticControls(text){
  return '<div class="controlsText"><span class="modeBadge">対COM版</span></div><div class="valueBox">'+esc(text)+'</div><div class="controlsText">3秒ごとに一手進みます。</div>';
}
function coinTossControls(){
  var first=playerByKey(game.firstKey),second=other(first);
  return '<div class="controlsText"><span class="modeBadge">先攻後攻をランダムで決定しました</span></div>'+
    '<div class="valueBox">先攻：'+esc(first.name)+'<br>後攻：'+esc(second.name)+'</div>'+
    '<div class="controlsText">3秒後にスタンバイフェイズを開始します。</div>';
}
function openingTacticSelectionControls(){
  if(game.humanTacticsReady){
    return '<div class="openingSelect"><div class="controlsText"><b>戦術手札7枚は選択済みです。</b></div><div class="controlsText">COMの盤面構築が終わるまでお待ちください。</div></div>';
  }
  var selected=game.humanTacticSelection;
  var html='<div class="openingSelect"><div class="controlsText"><b>あなたの最初の戦術手札を選択</b>　選択済み：'+selected.size+' / 7枚</div>';
  html+='<div class="activeDecision"><div class="controlsText">7枚を選んで確定してください。自動選択した7枚も手札で確認・変更できます。</div><div class="actionDock">';
  html+=btn('auto-opening-tactics','自動で7枚選ぶ',{},'primary');
  html+=btn('confirm-opening-tactics','選んだ7枚で確定',{},'primary',selected.size!==7)+'</div></div>';
  html+='<div class="controlsText">左側に並んだカードを選ぶと手札へ移ります。選んだカードは手札を押すと戻せます。</div></div>';
  return html;
}
function comStandbyControls(){
  var html='<div class="controlsText"><span class="modeBadge">COMが盤面を構築中</span>　未処理のメイン手札：'+game.B.mainHand.length+'枚</div>';
  html+='<div class="controlsText">カード内容は非公開です。盤面への反映を確認してください。</div>';
  return html+openingTacticSelectionControls();
}
function mulliganControls(){
  var p = playerByKey(game.standbyKey);
  var verifier = other(p);
  var html = '<div class="controlsText"><b>' + p.name + '</b>の初期手札にキャラカードがありません。7枚すべてを公開しています。</div>';
  html += '<div class="activeDecision"><div class="controlsText"><b>' + verifier.name + '</b>がキャラカードなしを確認してください。</div><div class="actionDock">';
  if(game.mode==='com' && verifier===game.B){
    html += '<div class="controlsText">COMが3秒後に確認します。</div>';
  }else{
    html += btn('confirm-mulligan',verifier.name + '：確認してデッキへ戻し再ドロー',{},'primary');
  }
  html += '</div></div><div class="controlsText controlsListLabel">公開中の初期手札</div><div class="buttonGroup compactChoiceGrid">';
  cardsInTypeOrder(p.mainHand).forEach(function(x){html+='<span class="controlBtn '+cardTypeClass(x)+'">'+esc(compactChoiceLabel(x,true))+'</span>';});
  html += '</div>';
  if(game.mode==='com' && p===game.B) html+=openingTacticSelectionControls();
  return html;
}
function standbyControls(){
  var p = playerByKey(game.standbyKey);
  var c = choice();
  var html = '<div class="controlsText"><b>' + p.name + '</b>を操作中　メイン手札：' + p.mainHand.length + '枚</div>';
  var pendingExpansion=c.expansionActivated?findCard(p.tempPlayed,c.standbyCard):null;
  if(!p.mainHand.length&&!pendingExpansion)return html+'<div class="activeDecision standbyFinishPrompt"><div class="controlsText"><b>スタンバイフェイズを終了しますか？</b></div>'+btn('finish-standby','スタンバイフェイズを終了',{},'primary')+'</div>';
  var selected = pendingExpansion||findCard(p.mainHand,c.standbyCard);
  if(selected){
    var details='',actions='';
    if(selected.type === 'character'){
      var characterSlots=openBattleSlotIndexes(p,false);
      details='<div class="controlsText">バトルエリアの光っている空き枠をタップして召喚します。</div>';
      if(!characterSlots.length) details='<div class="controlsText">バトルエリアに空き枠がありません。</div>';
    }else if(selected.type === 'trap'){
      details='<div class="controlsText">作戦エリアの光っている空き枠をタップして伏せます。</div>';
      if(tacticSlotsOpen(p)<=0)details='<div class="controlsText">作戦エリアに空き枠がありません。</div>';
    }else if(selected.kind === 'growth'&&!pendingExpansion){
      details='<div class="controlsText">作戦エリアの空き枠をタップして発動します。</div>';
    }else if(selected.kind === 'growth'){
      var targets=p.battleArea.filter(function(x){return x.level<3;});
      details='作戦エリアで発動しました。強化するキャラを盤面でタップしてください。';
      if(!targets.length)details='強化できるキャラがいません。';
    }else if(selected.kind === 'summon' || selected.kind === 'summonShuffleDraw'){
      if(!pendingExpansion)details='<div class="controlsText">作戦エリアの空き枠をタップして発動します。</div>';
      else if(c.summonDeckCid==null)details='左側のカード一覧から召喚するキャラを選んでください。';
      else details='作戦エリアで発動中です。バトルエリアの光っている空き枠をタップしてください。';
    }else if(selected.kind === 'searchCharacter'){
      details=pendingExpansion?'左側のカード一覧から手札に加えるキャラをタップしてください。':'作戦エリアの空き枠をタップして発動します。';
    }else if(selected.kind === 'draw2discard2'){
      if(!pendingExpansion)details='<div class="controlsText">作戦エリアの空き枠をタップして発動します。</div>';
      else{
      var others=p.mainHand.filter(function(x){return x.cid!==selected.cid;}),need=2;
      details='<div class="controlsText">メインデッキに戻すカードを手札から2枚選んでください。</div>';
      cardsInTypeOrder(others).forEach(function(x){actions+=btn('toggle-exp-discard',compactChoiceLabel(x,true),{cid:x.cid},cardButtonClass(x,c.discard.has(x.cid)));});
      actions+=btn('resolve-draw2','2枚をデッキに戻してドロー',{},'primary',others.length<need || c.discard.size!==need);
      }
    }else if(selected.kind === 'defensePrep'){
      details=pendingExpansion?'左側のカード一覧から伏せる罠を選んでください。残りは戻してシャッフルします。':'作戦エリアの空き枠をタップして発動します。';
      if(pendingExpansion&&(!p.mainDeck.slice(0,3).some(function(x){return x.type==='trap';})||tacticSlotsOpen(p)<=0))actions+=btn('resolve-defense-prep-empty','罠を伏せずにシャッフル',{},'');
    }else{
      details='<div class="controlsText">作戦エリアの空き枠をタップして発動します。</div>';
    }
    if(!pendingExpansion)actions+=btn('discard-standby','捨てる',{},'danger');
    var needsDecision=pendingExpansion&&selected.kind==='draw2discard2';
    html+='<div class="'+(needsDecision?'activeDecision':'standbyInlineHint')+'"><div class="controlsText selectedCardSummary"><b>選択中：</b>'+esc(label(selected))+'</div>'+details+'<div class="buttonGroup activeActionGrid">'+actions+'</div></div>';
  }
  if(p.mainHand.length&&!pendingExpansion){html+='<div class="controlsText controlsListLabel">処理するカードを選んでください。</div><div class="buttonGroup compactChoiceGrid standbyCardGrid">';
    cardsInTypeOrder(p.mainHand).forEach(function(x){html+=btn('choose-standby',compactChoiceLabel(x,true),{cid:x.cid},cardButtonClass(x,c.standbyCard===x.cid));});html+='</div>';}
  return html;
}
function drawControls(){
  var p = playerByKey(game.turnKey);
  var canDraw=p.tacticHand.length<=3 && p.tacticDrawPool.length>0;
  var html = '<div class="controlsText"><b>' + p.name + '</b>を操作中　戦術手札：'+p.tacticHand.length+'枚</div>';
  if(p.skipNextAttack) html += '<div class="controlsText">ターン開始処理後、このターンの攻撃宣言だけをスキップします。</div>';
  if(canDraw) return html + '<div class="controlsText">戦術手札が3枚以下なので1枚ドローします。</div>' + btn('draw-tactic','戦術デッキから1枚ドロー',{},'primary');
  if(p.tacticHand.length<=3) return html + '<div class="controlsText">戦術手札は3枚以下ですが、戦術デッキが尽きています。</div>' + btn('skip-tactic-draw','ドローなしでターンを進める',{},'primary');
  return html + '<div class="controlsText">戦術手札が4枚以上なので、このターンはドローしません。</div>' + btn('skip-tactic-draw','攻撃宣言ステップへ進む',{},'primary');
}
function attackControls(){
  var p = playerByKey(game.turnKey), c = choice();
  function fixedSide(player, position, sideName, cssClass){
    var isAttacker = player === p;
    var role = isAttacker ? '攻撃キャラ' : '攻撃対象';
    var html = '<div class="selectionSide ' + cssClass + '"><div class="selectionLabel">' + position + '：' + sideName + '（' + player.name + '）― ' + role + '</div><div class="buttonGroup compactChoiceGrid">';
    player.battleArea.forEach(function(x){
      if(isAttacker){
        html += btn('toggle-attacker','攻撃：' + x.name + '（'+(Number(x.battleSlot)+1)+'番枠／Lv' + x.level + '）',{uid:x.uid},cardButtonClass(x,c.attackers.has(x.uid)));
      }else{
        html += btn('choose-target','対象：' + x.name + '（'+(Number(x.battleSlot)+1)+'番枠／Lv' + x.level + '）',{uid:x.uid},cardButtonClass(x,c.targetUid===x.uid));
      }
    });
    return html + '</div></div>';
  }
  var html = '<div class="controlsText"><b>' + p.name + '</b>の攻撃宣言　攻撃キャラを1体以上と相手キャラを1体選んでください。</div>';
  var selectedAttackers=Array.from(c.attackers).map(function(uid){return findChar(p,uid);}).filter(Boolean);
  var selectedTarget=findChar(other(p),c.targetUid);
  var declaredTotal=selectedAttackers.reduce(function(sum,x){return sum+x.level;},0);
  var overMultiLimit=selectedAttackers.length>1 && selectedTarget && declaredTotal>selectedTarget.level+1;
  html += '<div class="activeDecision"><div class="controlsText selectedCardSummary">攻撃側：'+(selectedAttackers.length?esc(selectedAttackers.map(function(x){return x.name;}).join('＋')):'未選択')+
    '（合計'+declaredTotal+'）<br>攻撃対象：'+(selectedTarget?esc(selectedTarget.name)+'（Lv'+selectedTarget.level+'）':'未選択')+'</div>';
  if(overMultiLimit){
    html += '<div class="controlsText"><b>複数攻撃の合計は対象の攻撃力＋1までです。</b> 現在は攻撃側'+declaredTotal+'／対象'+selectedTarget.level+'です。</div>';
  }
  html += '<div class="actionDock">';
  html += btn('declare-attack','この組み合わせで攻撃宣言',{},'primary',!c.attackers.size || !c.targetUid || overMultiLimit);
  html += btn('attack-pass','攻撃宣言をパス',{},'danger');
  html += '</div></div>';
  html += fixedSide(game.B,'上段','相手側','opponent');
  html += fixedSide(game.A,'下段','自分側','self');
  return html;
}
function attackParticipants(side){
  var atk = game.attack;
  if(side === atk.attackerKey){
    var p = playerByKey(side);
    return atk.attackerUids.map(function(uid){ return findChar(p,uid); }).filter(Boolean);
  }
  var d = findChar(playerByKey(atk.defenderKey),atk.targetUid);
  return d ? [d] : [];
}
function attackTotal(side){
  var list = attackParticipants(side);
  return list.reduce(function(sum,x){ return sum+Math.max(0,x.level+(game.attack.mods[x.uid]||0)); },0);
}
function responseCanActivate(info){
  if(!game||!game.attack||!info)return false;
  var c=info.card,k=c.kind,a=playerByKey(game.responseActorKey),op=other(a),atk=game.attack;
  if(!!c.chain!==(game.state==='chain'))return false;
  if(info.src==='trap'&&atk.usedTraps.has(c.cid))return false;
  if(info.src==='tactic'&&!c.pendingPlacement&&tacticSlotsOpen(a)<=0)return false;
  if(k==='buff1')return a.battleArea.length>0;
  if(['debuff1','levelDown','removePower1'].indexOf(k)>=0)return op.battleArea.length>0;
  if(k==='namedShift')return a.battleArea.concat(op.battleArea).some(function(x){return x.name===c.targetName;});
  if(k==='redirect')return playerByKey(atk.defenderKey).battleArea.some(function(x){return x.uid!==atk.targetUid;});
  if(k==='revive'||k==='reviveFromRetreat')return openBattleSlotIndexes(a,true).length>0&&a.retreat.some(function(x){return x.name&&!reservedReviveTargetUids(a).has(x.uid);});
  if(k==='peek2')return op.tacticHand.length>0;
  if(k==='drawTactic2')return a.tacticDrawPool.length>0;
  if(k==='recycle')return a.retreat.some(function(x){return x.type==='tactic';});
  if(k==='strategyShift')return a.tacticHand.some(function(x){return x.cid!==c.cid;});
  if(k==='negateTrap')return atk.chainHistory.some(function(x){return x.src==='trap'&&x.actorKey!==game.responseActorKey&&x.status==='pending'&&!x.negated;});
  if(k==='splitAttack')return game.responseActorKey===atk.defenderKey&&attackParticipants(atk.attackerKey).length>=3;
  if(k==='supportDefense')return game.responseActorKey===atk.defenderKey&&a.battleArea.length>=2;
  if(k==='lastStand')return attackParticipants(game.responseActorKey).length===1&&attackParticipants(playerKey(op)).length>=2;
  if(k==='lockZone')return lockableZoneSlotIndexes(op).length>0;
  return true;
}
function validResponsePayload(info,payload){
  if(payload.empty||!responseCanActivate(info))return false;
  var a=playerByKey(game.responseActorKey),op=other(a),k=info.card.kind,t=Number(payload.targetUid),ids=payload.ids||[];
  if(k==='buff1')return !!findChar(a,t);
  if(['debuff1','levelDown','removePower1'].indexOf(k)>=0)return !!findChar(op,t);
  if(k==='namedShift'){var ch=findAnyCharacter(t);return !!ch&&ch.name===info.card.targetName;}
  if(k==='redirect')return t!==game.attack.targetUid&&!!findChar(playerByKey(game.attack.defenderKey),t);
  if(k==='splitAttack')return game.attack.attackerUids.indexOf(t)>=0;
  if(k==='supportDefense')return !!findChar(a,t)&&!!findChar(a,Number(payload.recipientUid))&&t!==Number(payload.recipientUid);
  if(k==='recycle')return ids.length===1&&a.retreat.some(function(x){return x.type==='tactic'&&x.cid===Number(ids[0]);});
  if(k==='strategyShift')return ids.length===1&&Number(ids[0])!==info.card.cid&&!!findCard(a.tacticHand,Number(ids[0]));
  if(k==='negateTrap'){var entry=game.attack.chainHistory[Number(payload.targetIndex)];return !!entry&&entry.src==='trap'&&entry.actorKey!==game.responseActorKey&&entry.status==='pending'&&!entry.negated;}
  return true;
}
function responseCardInfo(){
  var actor = playerByKey(game.responseActorKey), c = choice();
  var trap = findCard(actor.trapZone,c.responseCard);
  if(trap && !game.attack.usedTraps.has(trap.cid)){
    if(!responseCanActivate({src:'trap',card:trap}))return null;
    return {src:'trap',card:trap};
  }
  var pending=actor.tempPlayed.find(function(x){return x.cid===c.responseCard&&x.pendingPlacement;});
  if(pending)return responseCanActivate({src:'tactic',card:pending})?{src:'tactic',card:pending}:null;
  var tactic = findCard(actor.tacticHand,c.responseCard);
  return tactic && responseCanActivate({src:'tactic',card:tactic}) ? {src:'tactic',card:tactic} : null;
}
function placeResponseTactic(slot){
  if(!game||['response','chain'].indexOf(game.state)<0)return;
  var info=responseCardInfo(),actor=playerByKey(game.responseActorKey);
  if(!info||info.src!=='tactic'||info.card.pendingPlacement||openTacticSlotIndexes(actor).indexOf(Number(slot))<0)return;
  var played=takeCard(actor.tacticHand,info.card.cid);
  played.zoneSlot=Number(slot);played.pendingPlacement=true;actor.tempPlayed.push(played);choice().responseZoneSlot=Number(slot);
  if(['peek2','drawTactic2','buffAll1','debuffAll1','lastStand'].indexOf(played.kind)>=0)playSimple(false);
  else status('作戦エリアに出した戦術カードの対象を選んでください');
}
function responseControls(isChain){
  var actor = playerByKey(game.responseActorKey), atk = game.attack, c = choice();
  var openSlots = tacticSlotsOpen(actor);
  var html = isChain
    ? '<div class="controlsText"><b>' + actor.name + '</b>の連続発動タイミングです。直前のカードに続けて【連続発動】カードを使えます。</div>'
    : '<div class="controlsText"><b>' + actor.name + '</b>が応答する番です。通常カードを使うかパスしてください。</div>';
  html += '<div class="valueBox">現在の合計　' + playerByKey(atk.attackerKey).name + '側 ' + attackTotal(atk.attackerKey) + ' ／ ' + playerByKey(atk.defenderKey).name + '側 ' + attackTotal(atk.defenderKey) + '</div>';
  var info = responseCardInfo();
  html += '<div class="'+(info&&info.src==='tactic'&&!info.card.pendingPlacement?'standbyInlineHint':'activeDecision')+'">';
  if(info) html += '<div class="controlsText selectedCardSummary"><b>選択中：</b>'+esc(label(info.card))+'</div>';
  else html += '<div class="controlsText selectedCardSummary">使用するカードは未選択です。</div>';
  if(!info||!info.card.pendingPlacement)html += '<div class="actionDock">'+(isChain
    ? btn('end-chain','連続発動を終了して相手へ',{},'danger')
    : btn('response-pass','パス',{},'danger'))+'</div>';
  if(info && info.src==='tactic'){
    if(info.card.pendingPlacement)html+=responseEffectControls(info);
    else html+='<div class="controlsText">水色に光る作戦エリアの空き枠を押して発動してください。</div>';
  }else if(info){
    html += responseEffectControls(info);
  }
  html += '</div>';
  if(info&&info.card.pendingPlacement)return html;
  if(actor.tacticHand.some(function(x){return !!x.chain===isChain;}) && openSlots<=0){
    html += '<div class="controlsText">作戦エリアの5枠が埋まっているため、これ以上戦術カードを発動できません。</div>';
  }
  html += '<div class="controlsText controlsListLabel">使用するカードを選んでください。</div><div class="buttonGroup compactChoiceGrid">';
  responseCardsInDisplayOrder(actor.trapZone.concat(actor.tacticHand)).forEach(function(x){
    if(!!x.chain!==isChain) return;
    if(x.type==='trap' && atk.usedTraps.has(x.cid)) return;
    var unavailable=!responseCanActivate({src:x.type==='trap'?'trap':'tactic',card:x});
    html += btn('choose-response-card',compactChoiceLabel(x,true),{cid:x.cid},cardButtonClass(x,c.responseCard===x.cid),unavailable);
  });
  html += '</div>';
  return html;
}
function responseCharacterTargetControls(targets,labelBuilder,confirmText,emptyText){
  var c=choice();
  var selectedUid=c.responseTargetUid==null ? null : Number(c.responseTargetUid);
  var chosen=(targets||[]).find(function(x){return x.uid===selectedUid;})||null;
  var html='<div class="buttonGroup activeActionGrid">';
  (targets||[]).forEach(function(x){
    html+=btn('choose-response-target',labelBuilder(x),{uid:x.uid},cardButtonClass(x,chosen&&chosen.uid===x.uid,'primary'));
  });

  html+='</div>';
  if(chosen){
    html+='<div class="controlsText selectedTargetSummary"><b>対象選択中：</b>'+esc(characterBoardChoiceLabel(chosen,''))+'</div>';
    html+='<div class="actionDock">'+btn('confirm-response-target',confirmText,{},'primary')+'</div>';
  }
  return html;
}
function responseEffectControls(info){
  var kind = info.card.kind, actorKey = game.responseActorKey, atk = game.attack, c = choice();
  var actor = playerByKey(actorKey), opponent = other(actor), html = '<div class="buttonGroup activeActionGrid">';
  var targets = [];
  if(kind === 'buff1') targets = actor.battleArea.slice();
  if(kind === 'debuff1') targets = opponent.battleArea.slice();
  if(kind === 'levelDown') targets = opponent.battleArea.slice();
  if(kind === 'lockZone'){
    var lockSlots=lockableZoneSlotIndexes(opponent);
    lockSlots.forEach(function(index){
      var slotInfo=zoneSlotInfo(opponent,index);
      var description=slotInfo ? (index+1)+'番枠（表向き：'+label(slotInfo.card)+'）' : (index+1)+'番の空き枠';
      html += btn('play-lock-zone',description+'を処理後に封鎖',{slot:index},'primary');
    });
    if(!lockSlots.length) html += '<div class="controlsText">指定できる枠がないため発動できません。</div>';
    return html + '</div>';
  }
  if(['buff1','debuff1','levelDown'].indexOf(kind)>=0){
    return responseCharacterTargetControls(targets,function(x){return characterBoardChoiceLabel(x,'を対象に選ぶ');},'選んだキャラを対象にして発動',targets.length?'':'対象がいない状態で使用');
  }
  if(kind === 'redirect'){
    var redirectTargets=playerByKey(atk.defenderKey).battleArea.filter(function(x){return x.uid!==atk.targetUid;});
    return responseCharacterTargetControls(redirectTargets,function(x){return characterBoardChoiceLabel(x,'へ変更');},'選んだキャラへ標的変更を発動','変更せず使用');
  }
  if(kind === 'revive' || kind === 'reviveFromRetreat'){
    var reservedTargets=reservedReviveTargetUids(actor);
    var reviveTargets=actor.retreat.filter(function(x){ return x.name && !reservedTargets.has(Number(x.uid)); });
    var chosenRevive=reviveTargets.find(function(x){return x.uid===Number(c.responseTargetUid);});
    if(!chosenRevive){
      reviveTargets.forEach(function(x){
        html += btn('choose-revive-target',x.name + 'を生還対象に選ぶ',{uid:x.uid},cardButtonClass(x,false));
      });
    }else{
      html += '</div><div class="controlsText">生還するキャラ：<b>'+esc(chosenRevive.name)+'</b>　配置先を選んでください。</div><div class="buttonGroup activeActionGrid">';
      openBattleSlotIndexes(actor,true).forEach(function(slot){
        html += btn('play-response-target-slot',(slot+1)+'番枠にLv1で召喚',{uid:chosenRevive.uid,slot:slot},'primary');
      });
      html += btn('choose-revive-target','生還するキャラを選び直す',{uid:''},'');
    }
    if(!reviveTargets.length || !openBattleSlotIndexes(actor,true).length){
      html += '<div class="controlsText">生還対象または配置できる空き枠がありません。</div>';
    }
    return html + '</div>';
  }
  if(kind === 'peek2'){
    html += btn('play-response-simple','効果処理時の相手手札から2枚を選んで確認',{},'primary');
    return html + '</div>';
  }
  if(kind === 'namedShift'){
    var namedTargets=actor.battleArea.concat(opponent.battleArea).filter(function(x){
      return x.name===info.card.targetName;
    });
    return responseCharacterTargetControls(namedTargets,function(x){
      var ownTarget=!!findChar(actor,x.uid);
      return characterBoardChoiceLabel(x,'を'+(ownTarget?'+2':'-2'));
    },'選んだキャラを対象にして発動',namedTargets.length?'':'指定キャラがいない状態で使用');
  }
  if(kind === 'recycle'){
    var recyclable=actor.retreat.filter(function(x){ return x.type==='tactic'; });
    recyclable.forEach(function(x){ html += btn('toggle-effect-card',label(x),{cid:x.cid},cardButtonClass(x,c.effect.has(x.cid))); });
    html += btn('resolve-response-multi','選択した戦術カードを手札へ戻す',{},'primary',c.effect.size!==1);
    return html + '</div>';
  }
  if(kind === 'strategyShift'){
    actor.tacticHand.filter(function(x){return x.cid!==info.card.cid;}).forEach(function(x){
      html += btn('toggle-effect-card',label(x),{cid:x.cid},cardButtonClass(x,c.effect.has(x.cid)));
    });
    html += btn('resolve-response-multi','選んだ1枚をデッキ下へ戻して2枚ドロー',{},'primary',c.effect.size!==1);
    return html + '</div>';
  }
  if(kind === 'negateTrap'){
    var unresolvedTraps=atk.chainHistory.map(function(x,index){return {entry:x,index:index};}).filter(function(x){
      return x.entry.src==='trap' && x.entry.actorKey!==actorKey && x.entry.status==='pending' && !x.entry.negated;
    });
    unresolvedTraps.forEach(function(x){
      html += btn('play-response-index',(x.index+1)+'. '+x.entry.player+'「'+x.entry.card+'」を無効',{index:x.index},'primary');
    });
    if(!unresolvedTraps.length) html += '<div class="controlsText">無効にできる相手の罠がありません。</div>';
    return html + '</div>';
  }
  if(kind === 'splitAttack'){
    var splitTargets=attackParticipants(atk.attackerKey);
    if(splitTargets.length>=3){
      return responseCharacterTargetControls(splitTargets,function(x){return characterBoardChoiceLabel(x,'を攻防から外す');},'選んだキャラを攻防から外す効果を発動','');
    }
    return html + '<div class="controlsText">3体以上の攻撃に対して発動できます。</div></div>';
  }
  if(kind === 'supportDefense'){
    var helpers=actorKey===atk.defenderKey ? actor.battleArea.slice() : [];
    if(helpers.length<2)return html+'<div class="controlsText">自分のキャラが2体必要です。</div></div>';
    html+='<div class="controlsText">'+(c.supportSourceUid==null?'1枚目：−1にするキャラを選択（赤）':'2枚目：＋1にする別のキャラを選択（緑）')+'</div>';
    helpers.forEach(function(x){
      if(c.supportSourceUid==null)html+=btn('choose-support-source',x.name+'（−1）',{uid:x.uid},'');
      else if(x.uid!==c.supportSourceUid)html+=btn('choose-support-recipient',x.name+'（＋1）',{uid:x.uid},c.responseTargetUid===x.uid?'selected supportPlus':'');
    });
    if(c.supportSourceUid!=null)html+=btn('reset-support','選び直す',{},'')+btn('confirm-support','この2体で発動',{},'primary',c.responseTargetUid==null);
    return html+'</div>';
  }
  if(kind === 'removePower1'){
    var removableTargets=opponent.battleArea.slice();
    return responseCharacterTargetControls(removableTargets,function(x){
      var currentPower=Math.max(0,x.level+(atk.mods[x.uid]||0));
      return characterBoardChoiceLabel(x,'を指定（処理時の攻撃力が1なら除外／現在'+currentPower+'）');
    },'選んだキャラを対象にして発動',removableTargets.length?'':'対象にできる相手キャラがいない状態で使用');
  }
  if(kind === 'lastStand'){
    var ownCount=attackParticipants(actorKey).length;
    var opposingCount=attackParticipants(playerKey(opponent)).length;
    if(ownCount===1 && opposingCount>=2)html += btn('play-response-simple','決定',{},'primary');
    return html + '</div>';
  }
  html += btn('play-response-simple','このカードを使用',{},'primary');
  return html + '</div>';
}
function resolutionControls(){
  var atk = game.attack;
  var html = '<div class="controlsText"><b>攻防連鎖を最後に発動したカードから逆順で処理します。</b></div>';
  if(atk.pendingPeekAcknowledgementIndex!=null){
    var acknowledgedEntry=atk.chainHistory[atk.pendingPeekAcknowledgementIndex];
    var revealed=(acknowledgedEntry.payload.revealedLabels||[]);
    html += '<div class="activeDecision"><div class="controlsText"><b>「偵察」で確認した戦術手札</b></div><div class="valueBox">';
    html += revealed.length ? revealed.map(function(text,index){return '<div class="revealedCard type-tactic">'+(index+1)+'. '+esc(text)+'</div>';}).join('') : '確認できるカードはありませんでした。';
    html += '</div><div class="controlsText">内容を確認してから効果処理を再開してください。</div>';
    html += '<div class="actionDock">'+btn('acknowledge-peek','確認した',{},'primary')+'</div></div>';
    return html;
  }
  if(atk.pendingPeekIndex!=null){
    var peekEntry=atk.chainHistory[atk.pendingPeekIndex];
    var peekOpponent=other(playerByKey(peekEntry.actorKey));
    var currentMax=Math.min(2,peekOpponent.tacticHand.length);
    var selected=choice().effect;
    html += '<div class="activeDecision"><div class="valueBox">' + esc(peekOpponent.name) + 'の現在の戦術手札から' + currentMax + '枚選んで確認してください。</div><div class="actionDock">';
    html += btn('resolve-peek-selection','選んだ' + currentMax + '枚を確認する',{},'primary',selected.size!==currentMax) + '</div>';
    html += '<div class="controlsText controlsListLabel">確認するカードを選んでください。</div><div class="buttonGroup compactChoiceGrid">';
    var hidePeekChoices=game.mode==='com' && peekEntry.actorKey==='A' && peekOpponent===game.B;
    peekOpponent.tacticHand.forEach(function(x,index){
      var choiceLabel=hidePeekChoices?'裏向きの手札'+(index+1):compactChoiceLabel(x,true);
      html += btn('toggle-effect-card',choiceLabel,{cid:x.cid},cardButtonClass(x,selected.has(x.cid)));
    });
    html += '</div></div>';
    return html;
  }
  if(atk.resolutionIndex >= 0){
    var entry = atk.chainHistory[atk.resolutionIndex];
    html += '<div class="activeDecision"><div class="valueBox">次の処理：' + (atk.resolutionIndex+1) + '. ' + esc(entry.player) + '　' + esc(entry.card) + '</div>';
    html += '<div class="actionDock">'+btn('resolve-next-effect','この効果を処理',{},'primary')+'</div></div>';
  }else{
    html += '<div class="activeDecision"><div class="valueBox">すべてのカード効果を処理しました。</div>';
    html += '<div class="actionDock">'+btn('resolve-battle-result','攻撃結果を処理',{},'primary')+'</div></div>';
  }
  return html;
}
function humanResolutionChoiceRequired(){
  if(!game || !game.attack) return false;
  var index=game.attack.pendingPeekAcknowledgementIndex!=null
    ? game.attack.pendingPeekAcknowledgementIndex : game.attack.pendingPeekIndex;
  if(index==null) return false;
  var entry=game.attack.chainHistory[index];
  return !!entry && entry.actorKey==='A';
}
function automaticResolutionControls(){
  var atk=game.attack;
  if(atk.pendingPeekAcknowledgementIndex!=null) return automaticControls('COMが「偵察」で確認した内容を整理中');
  if(atk.pendingPeekIndex!=null) return automaticControls('COMが確認する戦術手札を選択中');
  if(atk.resolutionIndex>=0){
    var entry=atk.chainHistory[atk.resolutionIndex];
    return automaticControls('次の効果：'+(atk.resolutionIndex+1)+'. '+entry.player+'「'+entry.card+'」');
  }
  return automaticControls('カード効果が完了しました。攻撃結果を処理します');
}
function penaltyControls(){
  var pen = game.penalty, p = playerByKey(pen.playerKey), c = choice();
  var resources = cardsInTypeOrder(p.trapZone.concat(p.tacticHand));
  var need = Math.min(pen.count,resources.length);
  var html = '<div class="controlsText"><b>' + p.name + '</b>のパスペナルティ　除外するカードを' + need + '枚選んでください。</div>';
  html += '<div class="activeDecision"><div class="controlsText selectedCardSummary">選択済み：'+c.penalty.size+' / '+need+'枚</div><div class="actionDock">';
  html += btn('resolve-penalty','選択したカードを除外',{},'primary',c.penalty.size!==need) + '</div></div>';
  html += '<div class="controlsText controlsListLabel">除外するカードを選んでください。</div><div class="buttonGroup compactChoiceGrid">';
  resources.forEach(function(x){ html += btn('toggle-penalty',compactChoiceLabel(x,true),{cid:x.cid},cardButtonClass(x,c.penalty.has(x.cid))); });
  html += '</div>';
  return html;
}
function tieControls(){
  var atk = game.attack, p = playerByKey(atk.attackerKey);
  var html = '<div class="controlsText"><b>' + playerByKey(atk.defenderKey).name + '</b>が除去する攻撃キャラを選んでください。</div><div class="activeDecision"><div class="buttonGroup activeActionGrid">';
  attackParticipants(atk.attackerKey).forEach(function(x){ html += btn('choose-tie-victim',x.name + '（Lv' + x.level + '）を除去',{uid:x.uid},cardButtonClass(x,false,'primary')); });
  return html + '</div></div>';
}

function consumeStandbyCard(p,c){
  var inHand=!!findCard(p.mainHand,c.cid);
  var used = takeCard(p.mainHand,c.cid)||takeCard(p.tempPlayed,c.cid);
  if(used){sendToRetreat(p,used);if(inHand)window.dispatchEvent(new CustomEvent('duel:card-sound',{detail:{kind:'exp'}}));}
  choice().standbyCard = null;
  choice().standbyTargetUid = null;
  choice().summonDeckCid = null;
  choice().expansionActivated=false;
  choice().standbyEffect=null;
  choice().discard.clear();
}
function summonCharacter(p,c,slot){
  slot=Number(slot);
  if(openBattleSlotIndexes(p,false).indexOf(slot)<0) return;
  var summoned=takeCard(p.mainHand,c.cid);
  if(!summoned) return;
  placeCharacterInBattle(p,{uid:charSeed++,type:'character',name:c.name,level:1},slot);
  log(p.name + '：キャラ「' + c.name + '」をバトルエリア'+(slot+1)+'番枠に召喚');
  choice().standbyCard = null;
  choice().standbyTargetUid = null;
  choice().summonDeckCid = null;
}
function setTrap(p,c,slotIndex){
  var slot=slotIndex==null?firstOpenTacticSlot(p):Number(slotIndex);
  if(slot==null||openTacticSlotIndexes(p).indexOf(slot)<0) return;
  var placed=takeCard(p.mainHand,c.cid);
  if(!placed) return;
  placed.zoneSlot=slot;
  p.trapZone.push(placed);
  window.dispatchEvent(new CustomEvent('duel:card-sound',{detail:{kind:'set'}}));
  log(p.name + '：罠カードを作戦エリア'+(slot+1)+'番枠に伏せた');
  choice().standbyCard = null;
  choice().standbyTargetUid = null;
}
function activateExpansion(p,c,slot){
  slot=Number(slot);
  if(openTacticSlotIndexes(p).indexOf(slot)<0)return;
  var played=takeCard(p.mainHand,c.cid);if(!played)return;
  played.zoneSlot=slot;p.tempPlayed.push(played);
  window.dispatchEvent(new CustomEvent('duel:card-sound',{detail:{kind:'exp'}}));
  var state=choice();state.standbyCard=played.cid;state.expansionActivated=true;state.standbyTargetUid=null;state.summonDeckCid=null;state.discard.clear();
  log(p.name+'：展開カード「'+cardDisplayName(played)+'」を作戦エリア'+(slot+1)+'番枠で発動');
  if(played.kind==='draw1'){resolveDrawOne(p,played);return;}
  if(played.kind==='draw2discard2'&&p.mainHand.length<2){log(p.name+'：手札が2枚未満のため「手札交換」を処理できない');consumeStandbyCard(p,played);return;}
  if(played.kind==='searchCharacter'&&!p.mainDeck.some(function(x){return x.type==='character';})){log(p.name+'：メインデッキにサーチできるキャラがない');consumeStandbyCard(p,played);return;}
  if((played.kind==='summon'||played.kind==='summonShuffleDraw')&&(!p.mainDeck.some(function(x){return x.type==='character';})||!openBattleSlotIndexes(p,false).length)){log(p.name+'：特殊召喚できるキャラまたは空き枠がない');finishExpansionAfterSummon(p,played);return;}
  if(played.kind==='growth'&&!p.battleArea.some(function(x){return x.level<3;})){log(p.name+'：強化できるキャラがいない');consumeStandbyCard(p,played);return;}
  if(played.kind==='defensePrep'&&!p.mainDeck.length){resolveDefensePrep(p,played,null);return;}
  state.standbyEffect=played.kind;
  status(played.kind==='growth'?'強化するキャラを盤面で選んでください':played.kind==='draw2discard2'?'メインデッキに戻すカードを手札から2枚選んでください':'左のカード一覧から効果の対象を選んでください');
}
function useExpansionTarget(p,c,uid){
  var target = findChar(p,uid);
  if(target && target.level<3){
    target.level++;
    log(p.name + '：展開カードで「' + target.name + '」をLv' + target.level + 'に強化');
  }
  consumeStandbyCard(p,c);
}
function searchCharacterToHand(p,c,deckCid){
  var found=takeCard(p.mainDeck,deckCid);
  if(found){
    p.mainHand.push(found);
    log(p.name + '：メインデッキから「' + found.name + '」を手札に加えた');
  }
  consumeStandbyCard(p,c);
}
function resolveDrawOne(p,c){
  consumeStandbyCard(p,c);
  var drawn=p.mainDeck.length ? p.mainDeck.shift() : null;
  if(drawn) p.mainHand.push(drawn);
  log(p.name + '：メインデッキから' + (drawn ? label(drawn) + 'を1枚ドロー' : 'ドローできなかった'));
}
function resolveDefensePrep(p,c,trapCid){
  var topIds=p.mainDeck.slice(0,3).map(function(x){return x.cid;});
  var selected=topIds.indexOf(Number(trapCid))>=0 ? findCard(p.mainDeck,trapCid) : null;
  var slot=firstOpenTacticSlot(p);
  if(selected && selected.type==='trap' && slot!=null){
    var placed=takeCard(p.mainDeck,selected.cid);
    placed.zoneSlot=slot;
    p.trapZone.push(placed);
  window.dispatchEvent(new CustomEvent('duel:card-sound',{detail:{kind:'set'}}));
    log(p.name+'：デッキ上3枚から罠カードを1枚選び、作戦エリア'+(slot+1)+'番枠に伏せた');
  }else{
    log(p.name+'：デッキ上3枚を確認したが罠カードを伏せなかった');
  }
  consumeStandbyCard(p,c);
  p.mainDeck=shuffle(p.mainDeck);
  log(p.name+'：確認した残りのカードを戻してメインデッキをシャッフル');
}
function specialSummon(p,c,deckCid,slot){
  slot=Number(slot);
  if(openBattleSlotIndexes(p,false).indexOf(slot)>=0){
    var dc = takeCard(p.mainDeck,deckCid);
    if(dc){
      placeCharacterInBattle(p,{uid:charSeed++,type:'character',name:dc.name,level:1},slot);
      log(p.name + '：メインデッキから「' + dc.name + '」をバトルエリア'+(slot+1)+'番枠に特殊召喚');
    }
  }
  finishExpansionAfterSummon(p,c);
}
function finishExpansionAfterSummon(p,c){
  var kind = c.kind;
  consumeStandbyCard(p,c);
  if(kind === 'summonShuffleDraw'){
    p.mainDeck = shuffle(p.mainDeck);
    var drawn=p.mainDeck.length ? p.mainDeck.shift() : null;
    if(drawn) p.mainHand.push(drawn);
    log(p.name + '：メインデッキをシャッフルして' + (drawn ? label(drawn) + 'を1枚ドロー' : 'ドローできなかった'));
  }
}
function resolveDrawTwo(p,c){
  var ids = Array.from(choice().discard).filter(function(cid){
    return cid!==c.cid && !!findCard(p.mainHand,cid);
  });
  if(ids.length!==2) return;
  var returned = [];
  ids.forEach(function(cid){
    var x=takeCard(p.mainHand,cid);
    if(x)returned.push(x);
  });
  p.mainDeck=shuffle(p.mainDeck.concat(returned));
  consumeStandbyCard(p,c);
  var drawn = p.mainDeck.splice(0,Math.min(2,p.mainDeck.length));
  drawn.forEach(function(x){ p.mainHand.push(x); });
  log(p.name + '：' + returned.map(label).join(' ／ ') + 'をメインデッキに戻してシャッフル');
  log(p.name + '：メインデッキから' + drawn.length + '枚ドロー' + (drawn.length ? '（' + drawn.map(label).join(' ／ ') + '）' : ''));
  status(drawn.length===2 ? p.name + 'が2枚をデッキに戻して2枚ドローしました' : 'メインデッキ不足のため' + drawn.length + '枚だけドローしました');
}

function resolveTurnDraw(){
  var p=playerByKey(game.turnKey);
  if(p.tacticHand.length<=3 && p.tacticDrawPool.length){
    p.tacticHand.push(p.tacticDrawPool.shift());
    log(p.name+'：戦術手札が3枚以下のため、戦術デッキから1枚ドロー');
  }else if(p.tacticHand.length>3){
    log(p.name+'：戦術手札が4枚以上のためドローなし');
  }else{
    log(p.name+'：戦術手札は3枚以下だが、戦術デッキが尽きておりドローなし');
  }
  if(p.skipNextAttack){
    p.skipNextAttack=false;
    log(p.name+'：このターンの攻撃宣言ステップをスキップ');
    beginTurn(other(p));
    return;
  }
  game.state='attackDeclare';
  clearChoice();
  phase(p.name+'の攻撃宣言ステップ');
  status(p.name+'が攻撃キャラと攻撃対象を選んでください');
}

function declareAttack(){
  var p = playerByKey(game.turnKey), op = other(p), c = choice();
  var attackers = Array.from(c.attackers).filter(function(uid){ return !!findChar(p,uid); });
  var target = findChar(op,c.targetUid);
  if(!attackers.length || !target) return;
  var declaredTotal=attackers.reduce(function(sum,uid){var x=findChar(p,uid);return sum+(x?x.level:0);},0);
  if(attackers.length>1 && declaredTotal>target.level+1){
    status('複数攻撃の合計は攻撃対象の攻撃力＋1までです');
    render();
    return;
  }
  game.attack = {
    attackerKey:playerKey(p), defenderKey:playerKey(op), attackerUids:attackers,
    allAttackerUids:attackers.slice(),
    targetUid:target.uid, mods:{}, usedTraps:new Set(), consecutivePasses:0,
    chainHistory:[], displayHistory:[], resolutionIndex:-1, pendingPeekIndex:null,
    pendingPeekAcknowledgementIndex:null, resolutionMessage:null
  };
  game.attack.displayHistory.push({
    type:'attackDeclare',
    actorKey:playerKey(p),player:p.name,
    attackers:attackParticipants(playerKey(p)).map(function(x){return x.name+'(Lv'+x.level+')';}).join('＋'),
    target:op.name+'の「'+target.name+'」(Lv'+target.level+')'
  });
  game.state = 'response';
  game.responseActorKey = playerKey(op);
  clearChoice();
  log('【攻撃宣言】' + p.name + '：' + attackParticipants(playerKey(p)).map(function(x){return x.name+'(Lv'+x.level+')';}).join('＋') + ' が ' + op.name + 'の「' + target.name + '」に攻撃');
  emitBoardAction({kind:'attack',attackers:attackers,targetUid:target.uid,actorKey:playerKey(p),text:'攻撃'});
  status(op.name + 'が応答する番です');
  render();
}
function responseInfoByChoice(){
  return responseCardInfo();
}
function consumeResponse(info,payload){
  var actor = playerByKey(game.responseActorKey);
  payload=payload || {};
  if(!validResponsePayload(info,payload))return false;
  if((info.card.kind==='revive'||info.card.kind==='reviveFromRetreat') && payload.targetUid!=null){
    var reviveUid=Number(payload.targetUid),battleSlot=Number(payload.battleSlot);
    var validReviveTarget=actor.retreat.some(function(x){return x.uid===reviveUid && x.name;});
    if(!validReviveTarget || reservedReviveTargetUids(actor).has(reviveUid) || openBattleSlotIndexes(actor,true).indexOf(battleSlot)<0) return false;
    payload.targetUid=reviveUid;
    payload.battleSlot=battleSlot;
  }
  if(info.card.kind==='lockZone'){
    var lockSlot=Number(payload.lockSlot);
    if(lockableZoneSlotIndexes(other(actor)).indexOf(lockSlot)<0) return false;
    payload.lockSlot=lockSlot;
  }
  var tacticZoneSlot=null;
  if(info.src === 'tactic'){
    tacticZoneSlot=payload.zoneSlot==null ? choice().responseZoneSlot : payload.zoneSlot;
    tacticZoneSlot=Number(tacticZoneSlot);
    if(info.card.pendingPlacement ? info.card.zoneSlot!==tacticZoneSlot : openTacticSlotIndexes(actor).indexOf(tacticZoneSlot)<0) return false;
    payload.zoneSlot=tacticZoneSlot;
  }
  var chainEntry={
    player:actor.name,
    card:label(info.card),
    kind:info.card.kind,
    targetName:info.card.targetName || null,
    actorKey:game.responseActorKey,
    src:info.src,
    sourceCid:info.card.cid,
    negated:false,
    payload:payload,
    continuous:game.state === 'chain',
    status:'pending'
  };
  chainEntry.chainNumber=game.attack.chainHistory.length+1;
  chainEntry.targetText=chainTargetDescription(chainEntry);
  game.attack.chainHistory.push(chainEntry);
  if(!game.attack.displayHistory) game.attack.displayHistory=[];
  game.attack.displayHistory.push({type:'card',entry:chainEntry,chainNumber:chainEntry.chainNumber});
  if(info.src === 'trap') game.attack.usedTraps.add(info.card.cid);
  else{
    var wasPlaced=!!info.card.pendingPlacement;
    var playedTactic=wasPlaced?info.card:takeCard(actor.tacticHand,info.card.cid);
    if(!playedTactic) return false;
    playedTactic.zoneSlot=tacticZoneSlot;
    delete playedTactic.pendingPlacement;
    if(!wasPlaced)actor.tempPlayed.push(playedTactic);
  }
  log('【攻防】' + actor.name + 'が' + label(info.card) + 'を使用');
  window.dispatchEvent(new CustomEvent('duel:response-card',{detail:{src:info.src}}));
  emitBoardAction({kind:'card',targetUid:payload.targetUid,actorKey:playerKey(actor),text:cardDisplayName(info.card)});
  return true;
}
function hasChainCard(actor){
  var unusedTrap = actor.trapZone.some(function(x){ return x.chain && !game.attack.usedTraps.has(x.cid); });
  var reservedTactics=(game.mode==='auto'||game.mode==='com'&&actor===game.B) ? comReservedTacticCids(actor) : new Set();
  var chainTactic = tacticSlotsOpen(actor)>0 && actor.tacticHand.some(function(x){ return x.chain&&!reservedTactics.has(Number(x.cid)); });
  return unusedTrap || chainTactic;
}
function finishResponsePlay(kind){
  var actor = playerByKey(game.responseActorKey);
  game.attack.consecutivePasses = 0;
  choice().responseCard = null;choice().supportSourceUid=null;
  choice().responseZoneSlot = null;
  choice().responseTargetUid = null;
  choice().effect.clear();
  if(kind === 'forceEnd'){ beginResolution(); return; }
  if(hasChainCard(actor)&&!confirmHandsOff){
    game.state = 'chain';
    status(actor.name + 'は連続発動カードを使えます');
    render();
    return;
  }
  game.state = 'response';
  game.responseActorKey = playerKey(other(actor));
  status(playerByKey(game.responseActorKey).name + 'が応答する番です');
  render();
}
function endChain(){
  var actor = playerByKey(game.responseActorKey);
  log(actor.name + '：連続発動を終了');
  game.state = 'response';
  game.responseActorKey = playerKey(other(actor));
  clearChoice();
  status(playerByKey(game.responseActorKey).name + 'が応答する番です');
  render();
}
function beginResolution(){
  var atk = game.attack;
  game.state = 'resolving';
  atk.resolutionIndex = atk.chainHistory.length-1;
  atk.pendingPeekIndex = null;
  atk.pendingPeekAcknowledgementIndex = null;
  atk.resolutionMessage = {
    title:'攻防連鎖を確定',
    detail:atk.chainHistory.length
      ? '最後に発動した' + atk.chainHistory.length + '番のカードから逆順に処理します'
      : '発動カードがないため攻撃結果へ進みます'
  };
  clearChoice();
  phase('攻防連鎖の効果処理');
  status('カード効果を逆順に処理してください');
  log('◆攻防連鎖を確定。最後に発動したカードから逆順に処理');
  render();
}
function playTarget(uid){
  var info = responseInfoByChoice();
  if(!info) return;
  var kind=info.card.kind;
  if(!consumeResponse(info,{targetUid:Number(uid)})) return;
  finishResponsePlay(kind);
}
function playTargetSlot(uid,slot){
  var info=responseInfoByChoice();
  if(!info || (info.card.kind!=='revive'&&info.card.kind!=='reviveFromRetreat')) return;
  var kind=info.card.kind;
  if(!consumeResponse(info,{targetUid:Number(uid),battleSlot:Number(slot)})) return;
  finishResponsePlay(kind);
}
function playIndex(index){
  var info=responseInfoByChoice();
  if(!info) return;
  var kind=info.card.kind;
  if(!consumeResponse(info,{targetIndex:Number(index)})) return;
  finishResponsePlay(kind);
}
function playSimple(empty){
  var info=responseInfoByChoice();
  if(!info) return;
  var kind=info.card.kind;
  if(!consumeResponse(info,{empty:!!empty})) return;
  finishResponsePlay(kind);
}
function playLockZone(slot){
  var info=responseInfoByChoice();
  if(!info || info.card.kind!=='lockZone') return;
  if(!consumeResponse(info,{lockSlot:Number(slot)})) return;
  finishResponsePlay(info.card.kind);
}
function resolveMultiResponse(){
  var info=responseInfoByChoice();
  if(!info) return;
  var kind=info.card.kind, ids=Array.from(choice().effect);
  if(!consumeResponse(info,{ids:ids})) return;
  finishResponsePlay(kind);
}
function findAnyCharacter(uid){
  return findChar(game.A,uid) || findChar(game.B,uid);
}
function applyQueuedEffect(entry){
  var atk=game.attack, actor=playerByKey(entry.actorKey), op=other(actor);
  var kind=entry.kind, payload=entry.payload || {}, target, before, after;
  if(['buff1','debuff1'].indexOf(kind)>=0){
    target=findAnyCharacter(payload.targetUid);
    if(!target) return '対象が場を離れているため効果は不発';
    before=Math.max(0,target.level+(atk.mods[target.uid]||0));
    var delta=kind==='debuff1'?-1:1;
    atk.mods[target.uid]=(atk.mods[target.uid]||0)+delta;
    after=Math.max(0,target.level+atk.mods[target.uid]);
    return target.name+'の攻撃力が'+before+'から'+after+'へ変化（この攻防ステップ中）';
  }
  if(kind==='namedShift'){
    target=findAnyCharacter(payload.targetUid);
    if(!target || target.name!==entry.targetName) return '指定キャラが場にいないため効果は不発';
    before=Math.max(0,target.level+(atk.mods[target.uid]||0));
    var namedDelta=findChar(actor,target.uid) ? 2 : -2;
    atk.mods[target.uid]=(atk.mods[target.uid]||0)+namedDelta;
    after=Math.max(0,target.level+atk.mods[target.uid]);
    return '専用効果で'+target.name+'の攻撃力が'+before+'から'+after+'へ変化（この攻防ステップ中）';
  }
  if(kind==='levelDown'){
    target=findAnyCharacter(payload.targetUid);
    if(!target) return '対象が場を離れているため効果は不発';
    before=Math.max(0,target.level+(atk.mods[target.uid]||0));
    target.level=Math.max(0,target.level-1);
    after=Math.max(0,target.level+(atk.mods[target.uid]||0));
    return target.name+'の攻撃力が'+before+'から'+after+'へ永続変化';
  }
  if(kind==='buffAll1' || kind==='debuffAll1'){
    var affected=attackParticipants(kind==='buffAll1' ? entry.actorKey : playerKey(op));
    var groupDelta=kind==='buffAll1' ? 1 : -1;
    affected.forEach(function(ch){ atk.mods[ch.uid]=(atk.mods[ch.uid]||0)+groupDelta; });
    return (affected.length ? affected.map(function(ch){return ch.name;}).join('・') : '対象なし')+
      'の攻撃力をこの攻防ステップ中'+(groupDelta>0?'+1':'-1');
  }
  if(kind==='redirect'){
    target=findChar(playerByKey(atk.defenderKey),payload.targetUid);
    if(!target) return '変更先が場を離れているため攻撃対象は変わらない';
    atk.targetUid=target.uid;
    return '攻撃対象を「'+target.name+'」へ変更';
  }
  if(kind==='revive' || kind==='reviveFromRetreat'){
    var ri=actor.retreat.findIndex(function(x){return x.uid===Number(payload.targetUid);});
    var reviveSlot=Number(payload.battleSlot);
    if(ri<0 || openBattleSlotIndexes(actor,false).indexOf(reviveSlot)<0) return '召喚対象がないか指定したバトルエリアの枠が埋まっているため不発';
    var rc=actor.retreat.splice(ri,1)[0];
    placeCharacterInBattle(actor,{uid:charSeed++,type:'character',name:rc.name,level:1},reviveSlot);
    return '撤退エリアから「'+rc.name+'」をバトルエリア'+(reviveSlot+1)+'番枠にLv1で召喚';
  }
  if(kind==='peek2'){
    var seen=(payload.revealedLabels||[]).slice();
    if(!seen.length) seen=(payload.ids||[]).map(function(cid){var x=findCard(op.tacticHand,cid);return x?label(x):null;}).filter(Boolean);
    return op.name+'の戦術手札を確認'+(seen.length?'：'+seen.join(' ／ '):'（対象なし）');
  }
  if(kind==='drawTactic2'){
    var tacticDrawn=actor.tacticDrawPool.splice(0,Math.min(2,actor.tacticDrawPool.length));
    tacticDrawn.forEach(function(x){actor.tacticHand.push(x);});
    return actor.name+'が戦術デッキから'+tacticDrawn.length+'枚ドロー';
  }
  if(kind==='recycle'){
    var recycleCid=Number((payload.ids||[])[0]);
    var recycleIndex=actor.retreat.findIndex(function(x){return x.type==='tactic' && x.cid===recycleCid;});
    if(recycleIndex<0) return '対象の戦術カードが撤退エリアにないため不発';
    var recycled=actor.retreat.splice(recycleIndex,1)[0];
    actor.tacticHand.push(recycled);
    return label(recycled)+'を撤退エリアから手札へ戻した';
  }
  if(kind==='strategyShift'){
    var shiftCid=Number((payload.ids||[])[0]);
    var shifted=takeCard(actor.tacticHand,shiftCid);
    if(!shifted) return 'デッキの下へ戻す戦術カードが手札にないため不発';
    actor.tacticDrawPool.push(shifted);
    var shiftedDraw=actor.tacticDrawPool.splice(0,Math.min(2,actor.tacticDrawPool.length));
    shiftedDraw.forEach(function(x){actor.tacticHand.push(x);});
    return label(shifted)+'を戦術デッキの一番下へ戻し、'+shiftedDraw.length+'枚ドロー';
  }
  if(kind==='negateTrap'){
    var trapEntry=atk.chainHistory[Number(payload.targetIndex)];
    if(!trapEntry || trapEntry.src!=='trap' || trapEntry.actorKey===entry.actorKey || trapEntry.status!=='pending'){
      return '無効にできる未処理の相手罠がないため不発';
    }
    trapEntry.negated=true;
    return trapEntry.player+'の「'+trapEntry.card+'」の効果を無効にした';
  }
  if(kind==='splitAttack'){
    var splitUid=Number(payload.targetUid);
    if(attackParticipants(atk.attackerKey).length<3 || atk.attackerUids.indexOf(splitUid)<0){
      return '処理時点で攻撃キャラが3体未満か対象が攻防を離れているため不発';
    }
    var splitChar=findChar(playerByKey(atk.attackerKey),splitUid);
    atk.attackerUids=atk.attackerUids.filter(function(uid){return uid!==splitUid;});
    return splitChar ? splitChar.name+'をバトルエリアに残したまま、この攻防から外した' : '対象が場にいないため不発';
  }
  if(kind==='supportDefense'){
    if(entry.actorKey!==atk.defenderKey) return '防御側ではないため不発';
    var helper=findChar(actor,payload.targetUid);
    var defended=findChar(actor,payload.recipientUid);
    if(!helper || !defended || helper.uid===defended.uid) return '援護するキャラまたは攻撃対象がいないため不発';
    var helperBefore=Math.max(0,helper.level+(atk.mods[helper.uid]||0));
    var defendedBefore=Math.max(0,defended.level+(atk.mods[defended.uid]||0));
    atk.mods[helper.uid]=(atk.mods[helper.uid]||0)-1;
    atk.mods[defended.uid]=(atk.mods[defended.uid]||0)+1;
    return helper.name+'を'+helperBefore+'から'+Math.max(0,helper.level+atk.mods[helper.uid])+'へ、'+defended.name+'を'+defendedBefore+'から'+Math.max(0,defended.level+atk.mods[defended.uid])+'へ変更（この攻防ステップ中）';
  }
  if(kind==='lastStand'){
    var ownParticipants=attackParticipants(entry.actorKey);
    var opposingParticipants=attackParticipants(playerKey(op));
    if(ownParticipants.length!==1 || opposingParticipants.length<2) return '単騎対複数の条件を満たさないため不発';
    var lastChar=ownParticipants[0];
    var lastBefore=Math.max(0,lastChar.level+(atk.mods[lastChar.uid]||0));
    atk.mods[lastChar.uid]=(atk.mods[lastChar.uid]||0)+2;
    return lastChar.name+'の攻撃力が'+lastBefore+'から'+Math.max(0,lastChar.level+atk.mods[lastChar.uid])+'へ変化（この攻防ステップ中）';
  }
  if(kind==='removePower1'){
    var targetOwner=op;
    var removedChar=findChar(targetOwner,payload.targetUid);
    var removedPower=removedChar ? Math.max(0,removedChar.level+(atk.mods[removedChar.uid]||0)) : null;
    if(!removedChar || removedPower!==1) return '対象にした相手キャラが効果処理時に攻撃力1ではないため不発';
    var removedName=removedChar.name+'（効果処理時の攻撃力1）';
    moveToExclusion(targetOwner,removedChar);
    atk.attackerUids=atk.attackerUids.filter(function(id){return id!==removedChar.uid;});
    return removedName+'を除外';
  }
  if(kind==='lockZone'){
    var lockSlot=Number(payload.lockSlot);
    if(lockSlot<0 || lockSlot>=5 || lockedZoneSlots(op).indexOf(lockSlot)>=0 || pendingLockedZoneSlots(op).indexOf(lockSlot)>=0){
      return '指定した枠を封鎖できないため不発';
    }
    pendingLockedZoneSlots(op).push(lockSlot);
    return op.name+'の作戦エリア'+(lockSlot+1)+'番枠を、攻防連鎖の処理後に封鎖することが確定';
  }
  if(kind==='skipAttack'){
    op.skipNextAttack=true;
    return op.name+'の次の攻撃宣言を1回スキップ';
  }
  if(kind==='forceEnd') return '追加発動を終了した状態で、残りの連鎖処理を続行';
  return '効果を処理';
}
function resolveNextEffect(){
  var atk=game.attack;
  if(atk.pendingPeekAcknowledgementIndex!=null) return;
  if(atk.resolutionIndex<0) return;
  atk.chainHistory.forEach(function(x){if(x.status==='resolvedNow')x.status='resolved';});
  var index=atk.resolutionIndex;
  var entry=atk.chainHistory[index];
  if(!entry.negated && entry.kind==='peek2' && !entry.payload.selectionFinalized&&!other(playerByKey(entry.actorKey)).tacticHand.length){entry.payload.selectionFinalized=true;entry.payload.ids=[];entry.payload.revealedLabels=[];}
  if(!entry.negated && entry.kind==='peek2' && !entry.payload.selectionFinalized){
    atk.pendingPeekIndex=index;
    entry.status='resolving';
    clearChoice();
    atk.resolutionMessage={
      title:(index+1)+'. '+entry.player+'「'+entry.card+'」を処理中',
      detail:'この瞬間に残っている相手の戦術手札から確認するカードを選んでください'
    };
    status('相手の現在の戦術手札から確認するカードを選んでください');
    render();
    return;
  }
  var before=visualBattleSnapshot(),previousTarget=atk.targetUid;
  var detail=entry.negated ? '効果は「看破」により無効' : applyQueuedEffect(entry);
  entry.status='resolvedNow';
  atk.resolutionIndex--;
  if(atk.resolutionIndex<0){
    clearFaceUpResponseCards();
    finalizePendingZoneLocks();
  }
  atk.resolutionMessage={title:(index+1)+'. '+entry.player+'「'+entry.card+'」を処理',detail:detail};
  log('【効果処理】'+(index+1)+'. '+entry.player+'：'+detail);
  status(atk.resolutionIndex>=0?'次のカード効果を処理してください':'全効果の処理完了。攻撃結果へ進んでください');
  render();
  emitBoardAction({kind:'resolve',actorKey:entry.actorKey,targetUid:entry.payload.targetUid,changes:visualChanges(before,visualBattleSnapshot()),redirectedTarget:previousTarget!==atk.targetUid?atk.targetUid:null,text:detail});
}
function resolvePeekSelection(){
  var atk=game.attack;
  if(atk.pendingPeekIndex==null) return;
  var entry=atk.chainHistory[atk.pendingPeekIndex];
  var op=other(playerByKey(entry.actorKey));
  var max=Math.min(2,op.tacticHand.length);
  var ids=Array.from(choice().effect).filter(function(cid){return !!findCard(op.tacticHand,cid);});
  if(ids.length!==max) return;
  entry.payload.ids=ids;
  entry.payload.revealedLabels=ids.map(function(cid){var x=findCard(op.tacticHand,cid);return x?label(x):null;}).filter(Boolean);
  entry.payload.selectionFinalized=true;
  entry.targetText=chainTargetDescription(entry);
  var index=atk.pendingPeekIndex;
  atk.pendingPeekIndex=null;
  atk.pendingPeekAcknowledgementIndex=index;
  entry.status='resolving';
  atk.resolutionMessage={
    title:(index+1)+'. '+entry.player+'「偵察」で確認中',
    detail:entry.actorKey==='A'?'選んだ相手の手札を表向きに表示しています':'COMが確認したカードを整理しています'
  };
  clearChoice();
  status(entry.actorKey==='A'?'確認したカードを読み終えたら「確認した」を押してください':'COMが確認内容を整理しています');
  render();
}
function acknowledgePeek(){
  var atk=game.attack;
  if(!atk || atk.pendingPeekAcknowledgementIndex==null) return;
  atk.pendingPeekAcknowledgementIndex=null;
  resolveNextEffect();
}
function responsePass(){
  var atk=game.attack;
  var passingPlayer=playerByKey(game.responseActorKey);
  atk.consecutivePasses++;
  if(!atk.displayHistory) atk.displayHistory=[];
  atk.displayHistory.push({type:'pass',actorKey:playerKey(passingPlayer),player:passingPlayer.name});
  log(passingPlayer.name + '：攻防ステップをパス');
  if(atk.consecutivePasses>=2){ beginResolution(); return; }
  game.responseActorKey=playerKey(other(playerByKey(game.responseActorKey)));
  clearChoice();
  status(playerByKey(game.responseActorKey).name + 'が応答する番です');
  render();
}
function sendToRetreat(p,item){
  if(item && item.type==='character'){
    if(item.uid==null) item.uid=charSeed++;
    delete item.battleSlot;
  }
  p.retreat.push(item);
}
function moveToRetreat(p,ch){
  p.battleArea=p.battleArea.filter(function(x){return x.uid!==ch.uid;});
  sendToRetreat(p,ch);
}
function moveToExclusion(p,ch){
  p.battleArea=p.battleArea.filter(function(x){return x.uid!==ch.uid;});
  delete ch.battleSlot;
  p.exclusion.push(ch);
}
function clearFaceUpResponseCards(){
  [game.A,game.B].forEach(function(p){
    if(p.tempPlayed.length){
      p.tempPlayed.forEach(function(x){sendToRetreat(p,x);});
      log(p.name+'：効果処理完了により表向きの戦術カードを'+p.tempPlayed.length+'枚撤退エリアへ');
      p.tempPlayed=[];
    }
    var usedTrapCount=0;
    p.trapZone=p.trapZone.filter(function(x){
      if(game.attack.usedTraps.has(x.cid)){
        sendToRetreat(p,x);
        usedTrapCount++;
        return false;
      }
      return true;
    });
    if(usedTrapCount) log(p.name+'：効果処理完了により表向きの罠カードを'+usedTrapCount+'枚撤退エリアへ');
  });
}
function clearBattleCards(){
  [game.A,game.B].forEach(function(p){
    p.trapZone=p.trapZone.filter(function(x){
      if(game.attack.usedTraps.has(x.cid)){sendToRetreat(p,x);return false;}
      return true;
    });
    p.tempPlayed.forEach(function(x){sendToRetreat(p,x);});
    p.tempPlayed=[];
  });
}
function finalizePendingZoneLocks(){
  [game.A,game.B].forEach(function(p){
    var remaining=[];
    pendingLockedZoneSlots(p).forEach(function(index){
      if(lockedZoneSlots(p).indexOf(index)>=0) return;
      if(zoneSlotInfo(p,index)){
        remaining.push(index);
        return;
      }
      lockedZoneSlots(p).push(index);
      lockedZoneSlots(p).sort(function(a,b){return a-b;});
      log(p.name+'：作戦エリア'+(index+1)+'番枠を封鎖');
    });
    p.pendingLockedSlotIndexes=remaining;
  });
}
function removeZeroPowerAfterResult(){
  var removed=[];
  [game.A,game.B].forEach(function(p){
    p.battleArea.slice().forEach(function(ch){
      if(ch.level+(game.attack.mods[ch.uid]||0)<=0){
        moveToRetreat(p,ch);
        removed.push(p.name+'の「'+ch.name+'」');
      }
    });
  });
  if(removed.length) log('攻撃結果処理後、Lv0のため撤退：'+removed.join(' ／ '));
  return removed;
}
function resolveAttack(){
  var atk=game.attack, ap=playerByKey(atk.attackerKey), dp=playerByKey(atk.defenderKey);
  var visualBefore=visualBattleSnapshot(),visualTarget=atk.targetUid;
  var attackers=attackParticipants(atk.attackerKey), target=findChar(dp,atk.targetUid);
  var aSum=attackTotal(atk.attackerKey), dSum=attackTotal(atk.defenderKey);
  log('◆結果ステップ');
  log('合計値 ' + ap.name + '側 ' + aSum + ' ／ ' + dp.name + '側 ' + dSum);
  if(!attackers.length || !target){
    var failed='攻撃側の参加キャラまたは攻撃対象が場を離れたため攻撃不成立';
    log(failed);
    atk.resolutionMessage={title:'攻撃結果',detail:failed};
    removeZeroPowerAfterResult();
    finishAttack();
  }else if(aSum===dSum && attackers.length>1){
    target.level=Math.max(0,target.level-1);
    game.state='tieChoice';
    clearChoice();
    phase('結果ステップ：単騎側の除去対象選択');
    status(dp.name + 'が除去する攻撃キャラを選んでください');
    atk.resolutionMessage={title:'攻撃結果：同数',detail:'単騎側が複数側から撤退させるキャラを選択します'};
    render();
  }else{
    var resultText='';
    if(aSum===dSum){
      var singleAttacker=attackers[0];
      singleAttacker.level=Math.max(0,singleAttacker.level-1);
      target.level=Math.max(0,target.level-1);
      resultText='単騎対単騎で同数のため、'+singleAttacker.name+'と'+target.name+'の元の攻撃力を永続-1';
      log(resultText);
    }else if(aSum>dSum){
      moveToRetreat(dp,target);
      resultText=ap.name + '側が上回り、' + dp.name + 'の「' + target.name + '」を撤退';
      log(resultText);
    }else{
      attackers.forEach(function(x){moveToRetreat(ap,x);});
      resultText='合計値が届かず、攻撃側の参加キャラをすべて撤退';
      log(resultText);
    }
    var zeroRemoved=removeZeroPowerAfterResult();
    atk.resolutionMessage={
      title:'攻撃結果　'+ap.name+'側 '+aSum+' ／ '+dp.name+'側 '+dSum,
      detail:resultText+(zeroRemoved.length?'。さらにLv0のキャラを撤退':'')
    };
    finishAttack();
  }
  emitBoardAction({kind:'result',targetUid:visualTarget,actorKey:atk.attackerKey,changes:visualChanges(visualBefore,visualBattleSnapshot()),text:atk.resolutionMessage?.detail||'攻撃結果'});
}
function visualBattleSnapshot(){
  var entries={};if(!game)return entries;
  [game.A,game.B].forEach(function(p){p.battleArea.forEach(function(ch){entries[ch.uid]={uid:ch.uid,key:playerKey(p),slot:ch.battleSlot,level:currentBattlePower(ch),name:ch.name};});});
  return entries;
}
function visualChanges(before,after){
  return Object.keys(before).filter(function(uid){return !after[uid]||before[uid].level!==after[uid].level;}).map(function(uid){return {uid:Number(uid),key:before[uid].key,slot:before[uid].slot,name:before[uid].name,from:before[uid].level,to:after[uid]?.level??null};});
}
function emitBoardAction(detail){window.dispatchEvent(new CustomEvent('duel:visual',{detail:detail}));}
function finishAttack(){
  var next=playerByKey(game.attack.defenderKey);
  game.lastChainHistory=game.attack.chainHistory.slice();
  game.lastChainDisplayHistory=(game.attack.displayHistory||[]).slice();
  clearBattleCards();
  finalizePendingZoneLocks();
  removeZeroPowerAfterTemporaryExpiry();
  game.attack=null;
  clearChoice();
  if(checkEnd()) return;
  beginTurn(next);
}
function removeZeroPowerAfterTemporaryExpiry(){
  var removed=[];
  [game.A,game.B].forEach(function(p){
    p.battleArea.slice().forEach(function(ch){
      if(ch.level<=0){
        moveToRetreat(p,ch);
        removed.push(p.name+'の「'+ch.name+'」');
      }
    });
  });
  if(removed.length) log('攻防ステップ終了で一時効果が消え、攻撃力0のため撤退：'+removed.join(' ／ '));
  return removed;
}
function attackPass(){
  var p=playerByKey(game.turnKey);
  p.attackPassCount++;
  log(p.name + '：攻撃宣言パス（' + p.attackPassCount + '回目）');
  var n=p.attackPassCount-1;
  if(n>0){
    game.state='penalty';
    game.penalty={playerKey:playerKey(p),count:n,nextKey:playerKey(other(p))};
    clearChoice();
    phase('攻撃宣言パスのペナルティ');
    status(p.name+'がパスペナルティで除外するカードを選んでください');
    render();
  }else beginTurn(other(p));
}
function resolvePenalty(){
  var p=playerByKey(game.penalty.playerKey), ids=Array.from(choice().penalty);
  ids.forEach(function(cid){
    var x=takeCard(p.tacticHand,cid)||takeCard(p.trapZone,cid);
    if(x)p.exclusion.push(x);
  });
  log(p.name + '：パスペナルティで' + ids.length + '枚を除外');
  var next=playerByKey(game.penalty.nextKey);
  game.penalty=null;
  if(checkEnd()) return;
  beginTurn(next);
}
function usable(p){
  return p.trapZone.length+p.tacticHand.length+p.tacticDrawPool.length;
}
function checkEnd(){
  if(!game || game.state==='gameOver'||game.state==='matchOver') return false;
  if(game.A.battleArea.length===0 || game.B.battleArea.length===0 || (usable(game.A)===0&&usable(game.B)===0)){
    finishForcedGame('決着');
    return true;
  }
  return false;
}
function finishForcedGame(reason){
  var A=game.A,B=game.B,winner;
  if(!A.battleArea.length&&!B.battleArea.length){
    var ar=usable(A),br=usable(B);
    log('【決着】両者全滅。残りリソース Aさん:' + ar + '枚 ／ Bさん:' + br + '枚');
    if(ar===br){finishDraw('両者全滅後の残りリソースも同数');return;}
    winner=ar>br?A:B;
  }else if(!A.battleArea.length){winner=B;log('【決着】Aさんのキャラが全滅');}
  else if(!B.battleArea.length){winner=A;log('【決着】Bさんのキャラが全滅');}
  else{
    var as=A.battleArea.reduce(function(s,x){return s+x.level;},0);
    var bs=B.battleArea.reduce(function(s,x){return s+x.level;},0);
    log('【決着】' + reason + '。残キャラ合計 Aさん:' + as + ' ／ Bさん:' + bs);
    if(as===bs){finishDraw('残っているキャラの攻撃力合計も同数');return;}
    winner=as>bs?A:B;
  }
  log(winner.name + 'の勝ち','winLine');
  if(winner===A)match.scoreA++;else match.scoreB++;
  scoreEl.textContent='対戦成績：'+match.scoreA+' vs '+match.scoreB;
  if(match.scoreA>=2||match.scoreB>=2){
    game.state='matchOver';
    phase('マッチ終了');
    status(winner.name + 'が2勝を先取してマッチ勝利');
    gameHeader('マッチ結果');
    log(winner.name + 'がマッチ勝利（' + match.scoreA + ' - ' + match.scoreB + '）','winLine');
  }else{
    game.state='gameOver';
    phase('ゲーム終了');
    status(winner.name + 'の勝利');
  }
  render();
}

function finishDraw(detail){
  game.isDraw=true;
  game.state='gameOver';
  log('【完全同点】'+detail+'のため得点を付けず再試合','winLine');
  phase('ゲーム終了：完全同点');
  status('得点を付けず、先攻後攻を再抽選して再試合します');
  render();
}

var confirmHandsOff=false;
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-action]');
  if(!b||(!b.closest('#controls,#decisionPanel,#deckActions,#selectionPanel,#ownHand')&&!b.closest('#autoPauseBtn'))||b.disabled||!game||setupTransitionPending)return;
  confirmHandsOff=b.dataset.handoff==='true';
  recordHistory();
  var a=b.dataset.action,cid=Number(b.dataset.cid),uid=Number(b.dataset.uid),c=choice();
  window.dispatchEvent(new CustomEvent('duel:action',{detail:{action:a}}));
  if(a==='toggle-opening-tactic'){
    if(game.humanTacticSelection.has(cid))game.humanTacticSelection.delete(cid);
    else if(game.humanTacticSelection.size<7)game.humanTacticSelection.add(cid);
  }
  else if(a==='toggle-auto' && game.mode==='auto'){
    game.autoPaused=!game.autoPaused;
    if(game.autoPaused)cancelComTimer();
  }
  else if(a==='auto-opening-tactics')autoSelectOpeningTactics();
  else if(a==='confirm-opening-tactics')completeHumanTacticSelection();
  else if(a==='cancel-selection'){
    if(['response','chain'].indexOf(game.state)>=0){var actor=playerByKey(game.responseActorKey),pending=findCard(actor.tempPlayed,c.responseCard);if(pending&&pending.pendingPlacement){takeCard(actor.tempPlayed,pending.cid);delete pending.pendingPlacement;delete pending.zoneSlot;actor.tacticHand.push(pending);}}
    clearChoice();
  }
  else if(a==='choose-standby'){c.standbyCard=cid;c.standbyTargetUid=null;c.summonDeckCid=null;c.discard.clear();}
  else if(a==='confirm-mulligan')confirmMulligan();
  else if(a==='summon-character'){var p=playerByKey(game.standbyKey),x=findCard(p.mainHand,c.standbyCard);if(x)summonCharacter(p,x,Number(b.dataset.slot));}
  else if(a==='set-trap'){var p=playerByKey(game.standbyKey),x=findCard(p.mainHand,c.standbyCard);if(x)setTrap(p,x);}
  else if(a==='discard-standby'){var p=playerByKey(game.standbyKey),x=takeCard(p.mainHand,c.standbyCard);if(x){sendToRetreat(p,x);log(p.name+'：'+label(x)+'を使用せず捨てた');}c.standbyCard=null;c.standbyTargetUid=null;c.summonDeckCid=null;c.discard.clear();}
  else if(a==='choose-exp-target')c.standbyTargetUid=uid;
  else if(a==='confirm-exp-target'){var p=playerByKey(game.standbyKey),x=findCard(p.mainHand,c.standbyCard);if(x&&c.standbyTargetUid!=null)useExpansionTarget(p,x,c.standbyTargetUid);}
  else if(a==='choose-special-character'){c.summonDeckCid=cid||null;}
  else if(a==='special-summon'){var p=playerByKey(game.standbyKey),x=findCard(p.mainHand,c.standbyCard);if(x)specialSummon(p,x,cid,Number(b.dataset.slot));}
  else if(a==='search-character'){var p=playerByKey(game.standbyKey),x=findCard(p.tempPlayed,c.standbyCard);if(x)searchCharacterToHand(p,x,cid);}
  else if(a==='resolve-draw1'){var p=playerByKey(game.standbyKey),x=findCard(p.tempPlayed,c.standbyCard)||findCard(p.mainHand,c.standbyCard);if(x)resolveDrawOne(p,x);}
  else if(a==='resolve-defense-prep'||a==='resolve-defense-prep-empty'){
    var p=playerByKey(game.standbyKey),x=findCard(p.tempPlayed,c.standbyCard)||findCard(p.mainHand,c.standbyCard);
    if(x)resolveDefensePrep(p,x,a==='resolve-defense-prep'?cid:null);
  }
  else if(a==='use-exp-empty'){var p=playerByKey(game.standbyKey),x=findCard(p.tempPlayed,c.standbyCard)||findCard(p.mainHand,c.standbyCard);if(x){log(p.name+'：'+label(x)+'を対象なしで処理');if(x.kind==='summon'||x.kind==='summonShuffleDraw')finishExpansionAfterSummon(p,x);else consumeStandbyCard(p,x);}}
  else if(a==='toggle-exp-discard'){c.discard.has(cid)?c.discard.delete(cid):c.discard.add(cid);}
  else if(a==='resolve-draw2'){var p=playerByKey(game.standbyKey),x=findCard(p.tempPlayed,c.standbyCard);if(x)resolveDrawTwo(p,x);}
  else if(a==='finish-standby')finishStandby();
  else if(a==='draw-tactic'||a==='skip-tactic-draw')resolveTurnDraw();
  else if(a==='toggle-attacker'){c.attackers.has(uid)?c.attackers.delete(uid):c.attackers.add(uid);}
  else if(a==='choose-target')c.targetUid=uid;
  else if(a==='declare-attack')declareAttack();
  else if(a==='attack-pass')attackPass();
  else if(a==='choose-response-card'){c.responseCard=cid;c.supportSourceUid=null;c.responseZoneSlot=null;c.responseTargetUid=null;c.effect.clear();}
  else if(a==='choose-support-source'){c.supportSourceUid=uid;c.responseTargetUid=null;}
  else if(a==='choose-support-recipient'){if(uid!==c.supportSourceUid)c.responseTargetUid=uid;}
  else if(a==='reset-support'){c.supportSourceUid=null;c.responseTargetUid=null;}
  else if(a==='confirm-support'){
    var info=responseCardInfo(),p=playerByKey(game.responseActorKey);
    if(info&&info.card.kind==='supportDefense'&&c.supportSourceUid!==c.responseTargetUid&&findChar(p,c.supportSourceUid)&&findChar(p,c.responseTargetUid)&&consumeResponse(info,{targetUid:c.supportSourceUid,recipientUid:c.responseTargetUid}))finishResponsePlay(info.card.kind);
  }
  else if(a==='choose-response-slot')placeResponseTactic(Number(b.dataset.slot));
  else if(a==='choose-response-target')c.responseTargetUid=uid;
  else if(a==='confirm-response-target'){if(c.responseTargetUid!=null)playTarget(c.responseTargetUid);}
  else if(a==='choose-revive-target')c.responseTargetUid=uid||null;
  else if(a==='play-response-target')playTarget(uid);
  else if(a==='play-response-target-slot')playTargetSlot(uid,Number(b.dataset.slot));
  else if(a==='play-response-index')playIndex(Number(b.dataset.index));
  else if(a==='play-lock-zone')playLockZone(Number(b.dataset.slot));
  else if(a==='play-response-simple')playSimple(false);
  else if(a==='toggle-effect-card'){c.effect.has(cid)?c.effect.delete(cid):c.effect.add(cid);}
  else if(a==='toggle-effect-char'){c.effect.has(uid)?c.effect.delete(uid):c.effect.add(uid);}
  else if(a==='resolve-response-multi')resolveMultiResponse();
  else if(a==='end-chain')endChain();
  else if(a==='response-pass')responsePass();
  else if(a==='resolve-next-effect')resolveNextEffect();
  else if(a==='resolve-peek-selection')resolvePeekSelection();
  else if(a==='acknowledge-peek')acknowledgePeek();
  else if(a==='resolve-battle-result')resolveAttack();
  else if(a==='toggle-penalty'){c.penalty.has(cid)?c.penalty.delete(cid):c.penalty.add(cid);}
  else if(a==='resolve-penalty')resolvePenalty();
  else if(a==='choose-tie-victim'){
    resolveTieVictim(uid);
  }
  else if(a==='next-game'){var nextMode=game.mode;match.gameNo++;startGame(nextMode);}
  confirmHandsOff=false;
  render();
});

function beginSelectedMode(mode, firstKey, skipConfirm){
  if(game && game.state!=='matchOver' && !skipConfirm && !window.confirm('進行中の対戦を破棄して最初からやり直しますか？')) return;
  recordHistory();
  startMatch(mode, firstKey);
}
function isDialogOpen(){
  return !rulesOverlay.hidden || !settingsOverlay.hidden;
}
function syncDialogState(){
  var anyOpen=isDialogOpen();
  document.body.classList.toggle('dialogOpen',anyOpen);
  rulesOverlay.setAttribute('aria-hidden',String(rulesOverlay.hidden));
  settingsOverlay.setAttribute('aria-hidden',String(settingsOverlay.hidden));
  rulesBtn.setAttribute('aria-expanded',String(!rulesOverlay.hidden));
  settingsBtn.setAttribute('aria-expanded',String(!settingsOverlay.hidden));
  if(anyOpen) cancelComTimer();
  else queueComIfNeeded();
}
function openRules(){
  if(!rulesOverlay.hidden){closeRules();return;}
  settingsOverlay.hidden=true;
  rulesOverlay.hidden=false;
  syncDialogState();
  rulesCloseBtn.focus();
}
function closeRules(restoreFocus){
  if(rulesOverlay.hidden)return;
  rulesOverlay.hidden=true;
  syncDialogState();
  if(restoreFocus!==false)rulesBtn.focus();
}
function openSettings(){
  if(!settingsOverlay.hidden){closeSettings();return;}
  rulesOverlay.hidden=true;
  settingsOverlay.hidden=false;
  syncDialogState();
  settingsCloseBtn.focus();
}
function closeSettings(restoreFocus){
  if(settingsOverlay.hidden)return;
  settingsOverlay.hidden=true;
  syncDialogState();
  if(restoreFocus!==false)settingsBtn.focus();
}
function trapDialogFocus(e){
  if(e.key!=='Tab')return;
  var overlay=!settingsOverlay.hidden?settingsOverlay:(!rulesOverlay.hidden?rulesOverlay:null);
  if(!overlay)return;
  var focusable=Array.from(overlay.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])'));
  if(!focusable.length){e.preventDefault();return;}
  var first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey && (document.activeElement===first || !overlay.contains(document.activeElement))){e.preventDefault();last.focus();}
  else if(!e.shiftKey && (document.activeElement===last || !overlay.contains(document.activeElement))){e.preventDefault();first.focus();}
}
rulesBtn.addEventListener('click',openRules);
rulesCloseBtn.addEventListener('click',function(){closeRules();});
rulesBottomCloseBtn.addEventListener('click',function(){closeRules();});
settingsBtn.addEventListener('click',openSettings);
settingsCloseBtn.addEventListener('click',function(){closeSettings();});
rulesOverlay.addEventListener('click',function(e){
  if(e.target===rulesOverlay)closeRules();
});
settingsOverlay.addEventListener('click',function(e){
  if(e.target===settingsOverlay)closeSettings();
});
document.querySelectorAll('input[name="motionSpeed"]').forEach(function(input){
  input.addEventListener('change',function(){
    if(!input.checked)return;
    uiPrefs.motion=input.value;
    saveUiPrefs();applyUiPrefs();
  });
});
cinematicsToggle.addEventListener('change',function(){
  uiPrefs.cinematics=cinematicsToggle.checked;
  saveUiPrefs();applyUiPrefs();
});
chainToggleBtn.addEventListener('click',function(e){
  if(e.detail>1)return;
  uiPrefs.chainCollapsed=!uiPrefs.chainCollapsed;
  saveUiPrefs();applyUiPrefs();
});
historyToggleBtn.addEventListener('click',function(e){
  if(e.detail>1)return;
  uiPrefs.historyCollapsed=!uiPrefs.historyCollapsed;
  saveUiPrefs();applyUiPrefs();
});
document.addEventListener('keydown',function(e){
  trapDialogFocus(e);
  if(e.key==='Escape'&&!settingsOverlay.hidden){closeSettings();return;}
  if(e.key==='Escape'&&!rulesOverlay.hidden)closeRules();
});
document.addEventListener('mouseover',function(e){
  var node=e.target.closest&&e.target.closest('[data-inspect-title]');
  if(!node)return;
  if(inspectorRestoreTimer){clearTimeout(inspectorRestoreTimer);inspectorRestoreTimer=null;}
  inspectorFromNode(node);
});
document.addEventListener('mouseout',function(e){
  var node=e.target.closest&&e.target.closest('[data-inspect-title]');
  if(!node || (e.relatedTarget&&node.contains(e.relatedTarget)))return;
  inspectorRestoreTimer=setTimeout(updateInspectorFromState,80);
});
document.addEventListener('focusin',function(e){
  var node=e.target.closest&&e.target.closest('[data-inspect-title]');
  if(node)inspectorFromNode(node);
});
document.addEventListener('mouseover',function(e){
  var button=e.target.closest&&e.target.closest('.controlBtn[data-uid]');
  if(button&&button.closest('#controls,#decisionPanel'))previewControlTarget(button);
});
document.addEventListener('mouseout',function(e){
  var button=e.target.closest&&e.target.closest('.controlBtn[data-uid]');
  if(!button||!button.closest('#controls,#decisionPanel')||(e.relatedTarget&&button.contains(e.relatedTarget)))return;
  clearControlTargetPreview();
});
document.addEventListener('focusin',function(e){
  var button=e.target.closest&&e.target.closest('.controlBtn[data-uid]');
  if(button&&button.closest('#controls,#decisionPanel'))previewControlTarget(button);
});
document.addEventListener('focusout',function(e){
  var button=e.target.closest&&e.target.closest('.controlBtn[data-uid]');
  if(!button||!button.closest('#controls,#decisionPanel')||(e.relatedTarget&&button.contains(e.relatedTarget)))return;
  clearControlTargetPreview();
});
function performStandbyBoardAction(node){
  var action=node._boardAction;if(!action||!game||game.state!=='standby')return;
  var p=playerByKey(game.standbyKey),c=choice(),card;
  recordHistory();window.dispatchEvent(new CustomEvent('duel:action',{detail:{action:action.kind}}));
  if(action.kind==='summonCharacter'){
    card=findCard(p.mainHand,c.standbyCard);if(card)summonCharacter(p,card,action.slot);
  }else if(action.kind==='setTrap'){
    card=findCard(p.mainHand,c.standbyCard);if(card)setTrap(p,card,action.slot);
  }else if(action.kind==='activateExpansion'){
    card=findCard(p.mainHand,c.standbyCard);if(card)activateExpansion(p,card,action.slot);
  }else if(action.kind==='growthTarget'){
    card=c.expansionActivated?findCard(p.tempPlayed,c.standbyCard):null;if(card)useExpansionTarget(p,card,action.uid);
  }else if(action.kind==='specialSummon'){
    card=c.expansionActivated?findCard(p.tempPlayed,c.standbyCard):null;if(card)specialSummon(p,card,action.cid,action.slot);
  }
  render();
}
battleStageEl.addEventListener('click',function(e){
  if(setupTransitionPending||e.target.closest('[data-action]'))return;
  var node=e.target.closest('.legalTarget');
  if(node&&node._responseSlot!=null){e.preventDefault();recordHistory();placeResponseTactic(node._responseSlot);render();}
  else if(node&&node._boardAction){e.preventDefault();performStandbyBoardAction(node);}
  else if(node&&node._proxyControlButton&&!node._proxyControlButton.disabled)node._proxyControlButton.click();
});
battleStageEl.addEventListener('keydown',function(e){
  if(setupTransitionPending||e.target.closest('[data-action]'))return;
  if(e.key!=='Enter'&&e.key!==' ')return;
  var node=e.target.closest('.legalTarget');
  if(node&&(node._boardAction||node._responseSlot!=null)){e.preventDefault();node.click();}
  else if(node&&node._proxyControlButton&&!node._proxyControlButton.disabled){e.preventDefault();node._proxyControlButton.click();}
});
startBtn.addEventListener('click',function(){beginSelectedMode('manual');});
comStartBtn.addEventListener('click',function(){beginSelectedMode('com');});
autoStartBtn.addEventListener('click',function(){beginSelectedMode('auto');});

undoBtn.addEventListener('click',undoOne);
redoBtn.addEventListener('click',redoOne);


window.DuelEngine=Object.freeze({
  pileContents:function(side,suffix){
    if(!game||['own','opp'].indexOf(side)<0||['Retreat','Exclusion'].indexOf(suffix)<0)return null;
    var p=side==='own'?game.A:game.B,cards=suffix==='Retreat'?p.retreat:p.exclusion;
    return {title:p.name+'の'+(suffix==='Retreat'?'撤退エリア':'除外エリア')+'（'+cards.length+'枚）',html:cards.map(function(c){return '<div class="card '+cardTypeClass(c)+'"'+cardInspectAttrs(c)+'>'+compactCardHtml(c)+'</div>';}).join('')||'<p>カードはありません</p>'};
  },
  start:function(mode,firstKey){beginSelectedMode(mode==='com'||mode==='auto'?mode:'manual',firstKey,firstKey==='A'||firstKey==='B');},
  prepareInitialHand:function(){if(game&&game.state==='coinToss')runComStep();},
  setStartupPending:function(value){startupPending=!!value;if(startupPending)cancelComTimer();else queueComIfNeeded();},
  view:function(){return game?{mode:game.mode,state:game.state,turn:game.turnKey,first:game.firstKey,turnCount:game.turnCount,actor:['response','chain'].indexOf(game.state)>=0?game.responseActorKey:['standby','mulliganConfirm'].indexOf(game.state)>=0?game.standbyKey:game.turnKey,scoreA:match.scoreA,scoreB:match.scoreB}:null;},
  inspect:function(node){if(node&&node.dataset.inspectTitle)setInspector(node.dataset.inspectType,node.dataset.inspectTitle,node.dataset.inspectEffect);}
});

loadUiPrefs();
uiPrefs.chainCollapsed=true;
applyUiPrefs();
syncDialogState();
render();
})();
