// Run with NODE_PATH pointing to an installed jsdom package. No test API ships in dist.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',url:'https://test.invalid'}),w=dom.window,d=w.document;
w.requestAnimationFrame=()=>0;w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
const api=['newPlayer','card','cardDisplayName','choice','clearChoice','render','runComStep','comStandbyStep','startGame','comResponsePlan','consumeResponse','finishResponsePlay','resolveNextEffect','finishAttack','resolvePeekSelection','acknowledgePeek','beginResolution','applyQueuedEffect','declareAttack','resolveAttack','resolveTieVictim','attackPass','resolvePenalty','resolveTurnDraw','completeHumanTacticSelection','autoSelectOpeningTactics','activateExpansion','useExpansionTarget','specialSummon','beginReinforcement','revealReinforcement','chooseReinforcement','resolveDrawTwo','resolveDefensePrep','responseCanActivate','validResponsePayload','finishStandby','comActionPending','captureSnapshot','openTacticSlotIndexes','beginTurn','recordHistory','undoOne','redoOne'];
let src=fs.readFileSync(root+'/src/engine.js','utf8').replace("var game = null;","var game = null;var testBulk=false;")
.replace('function render(){','function render(){if(testBulk)return;')
.replace('function log(text, cls){','function log(text, cls){if(testBulk)return;')
.replace('function applyQueuedEffect(entry){','function applyQueuedEffect(entry){window.effectCoverage[entry.kind]=(window.effectCoverage[entry.kind]||0)+1;')
.replace('window.DuelEngine=Object.freeze({',`window.test={${api.join(',')},get:()=>game,set:g=>{game=g;clearChoice();},bulk:x=>{testBulk=x;},handoff:x=>{confirmHandsOff=x;},reset:()=>{match.scoreA=match.scoreB=0;startupPending=true;}};window.DuelEngine=Object.freeze({`);
w.effectCoverage={};w.eval(src);const t=w.test;w.DuelEngine.setStartupPending(true);
w.eval(fs.readFileSync(root+'/src/decision-ui.js','utf8').replace('export ',''));const ui=w.createDecisionUI(d.querySelector('#battleStage'),d.querySelector('#controls'));
function paint(){t.render();ui.sync();assert(d.querySelector('#deckActions').children.length<=2,'More than two deck buttons');assert(!d.querySelector('#deckActions [data-action="play-response-empty"]'));}
function click(action,where=''){const el=d.querySelector(`${where} [data-action="${action}"]`);assert(el,`Missing visible action ${action}`);assert(!el.disabled,`Disabled ${action}`);el.click();paint();}
function character(uid,level,slot,name='unit'+uid){return {uid,type:'character',name,level,battleSlot:slot};}
function scenario(){t.reset();t.startGame('com','A');const g=t.get();for(const p of [g.A,g.B]){p.battleArea=[];p.trapZone=[];p.tempPlayed=[];p.retreat=[];p.exclusion=[];p.tacticHand=[];p.tacticDrawPool=[];p.lockedSlotIndexes=[];p.pendingLockedSlotIndexes=[];p.standbyComplete=true;p.tacticSelected=true;}g.A.battleArea=[character(1001,2,0),character(1002,1,1),character(1003,1,2)];g.B.battleArea=[character(2001,2,0),character(2002,1,1),character(2003,1,2)];g.state='response';g.turnKey='A';g.responseActorKey='B';g.attack={attackerKey:'A',defenderKey:'B',attackerUids:[1001],allAttackerUids:[1001],targetUid:2001,mods:{},usedTraps:new w.Set(),chainHistory:[],displayHistory:[],resolutionIndex:-1,consecutivePasses:0,pendingPeekIndex:null,pendingPeekAcknowledgementIndex:null};t.clearChoice();return g;}
{const p=t.newPlayer('deck',true,['a','b','c','d','e']),main=p.mainDeck;assert.equal(main.length,40);const count=kind=>main.filter(x=>x.kind===kind).length;for(const [kind,n] of Object.entries({growth:3,rapidGrowth:1,summon:2,summonShuffleDraw:3,draw2discard2:3,draw1:2,defensePrep:2,levelDown:2,lockZone:1,reviveFromRetreat:1,removePower1:1,skipAttack:1,forceEnd:1,splitAttack:2}))assert.equal(count(kind),n,kind);assert.equal(count('searchCharacter'),0);console.log('PASS main deck: 40 cards, revisions and limits');}
{const names={growth:'進化Lv.1',rapidGrowth:'進化Lv.2',summon:'援軍',summonShuffleDraw:'援軍指名',draw2discard2:'手札入替',draw1:'手札交換',defensePrep:'地雷探知機',lockZone:'侵された大地',removePower1:'消えない裂傷',skipAttack:'被食者の復讐',forceEnd:'神の終止符',splitAttack:'引裂かれる想い'};
 for(const [kind,name] of Object.entries(names))assert.equal(t.cardDisplayName(t.card(['lockZone','removePower1','skipAttack','forceEnd','splitAttack'].includes(kind)?'trap':'exp',{kind})),name,kind);
 console.log('PASS renamed cards: all 12 names');}

{const g=scenario();g.mode='auto';g.autoPaused=false;t.recordHistory();g.turnCount=42;g.autoPaused=true;t.undoOne();assert.equal(t.get().autoPaused,true,'undo keeps playback paused');t.redoOne();assert.equal(t.get().autoPaused,true,'redo keeps playback paused');assert.equal(t.get().turnCount,42);console.log('PASS playback: undo and redo preserve pause');}
{const g=scenario();g.state='gameOver';g.mode='com';w.dispatchEvent(new w.CustomEvent('duel:victory-se-start'));t.render();assert(d.querySelector('[data-action="next-game"]').disabled,'next game waits for victory SE');w.dispatchEvent(new w.CustomEvent('duel:victory-se-end'));assert(d.querySelector('[data-action="next-game"]').disabled);const original=w.Date.now;w.Date.now=()=>original()+1100;t.render();assert(!d.querySelector('[data-action="next-game"]').disabled,'next game unlocks one second after SE');w.Date.now=original;console.log('PASS victory: next game waits for full SE and one more second');}
function entry(kind,actorKey='B',payload={}){return {kind,actorKey,payload,src:'tactic',status:'pending',player:actorKey,card:kind};}
// A named tactical card must affect a participant in this attack, not a bystander.
{const g=scenario();const dedicated=t.card('tactic',{kind:'namedShift',targetName:g.B.battleArea[1].name});g.B.tacticHand=[dedicated];
 assert.equal(t.comResponsePlan({src:'tactic',card:dedicated}),null);
 dedicated.targetName=g.B.battleArea[0].name;
 assert.equal(t.comResponsePlan({src:'tactic',card:dedicated}).payload.targetUid,g.B.battleArea[0].uid);
}
// Both COM modes expose the expansion in a zone for a full step before resolving it.
for(const mode of ['com','auto']){
 const g=scenario();g.mode=mode;g.state='standby';g.standbyKey='B';g.B.mainHand=[t.card('exp',{kind:'draw1'})];
 const expansion=g.B.mainHand[0],before=g.B.mainDeck.length;
 t.comStandbyStep();assert.equal(g.B.tempPlayed[0],expansion);assert.equal(g.B.mainHand.length,0);assert.equal(g.B.mainDeck.length,before);
 t.render();assert(d.querySelector('#oppTactic [data-cid="'+expansion.cid+'"]'),'COM expansion is visible in its strategy zone');
 t.comStandbyStep();assert.equal(g.B.tempPlayed.length,0);assert(g.B.retreat.includes(expansion));assert.equal(g.B.mainDeck.length,before-1);
}
console.log('PASS COM: dedicated tactic targets attack participants; expansions visibly occupy a zone in both modes');
// Negate Trap selects the pending opponent trap directly on the board.
for(const [mode,actorKey] of [['com','A']]){
 const g=scenario();g.mode=mode;g.state='chain';g.responseActorKey=actorKey;const opponent=actorKey==='A'?'B':'A';
 const traps=['pending','resolved','pending'].map((status,i)=>t.card('trap',{kind:'levelDown',zoneSlot:i}));
 g[opponent].trapZone=traps;g.attack.usedTraps=new w.Set(traps.map(x=>x.cid));
 g.attack.chainHistory=traps.map((x,i)=>({...entry('levelDown',opponent,{targetUid:g[actorKey].battleArea[0].uid}),src:'trap',sourceCid:x.cid,status:i===1?'resolved':'pending',negated:i===2}));
 const counter=t.card('tactic',{kind:'negateTrap',chain:true,zoneSlot:0,pendingPlacement:true});g[actorKey].tempPlayed=[counter];t.choice().responseCard=counter.cid;t.choice().responseZoneSlot=0;paint();
 assert(d.querySelector('#decisionPanel').hidden,'Negate Trap must not open the selection panel');
 const node=d.querySelector('.slot[data-cid="'+traps[0].cid+'"]');assert(node.classList.contains('legalTarget'));
 for(const c of traps.slice(1))assert(!d.querySelector('.slot[data-cid="'+c.cid+'"]').classList.contains('legalTarget'));
 node.click();paint();assert.equal(g.attack.chainHistory.at(-1).kind,'negateTrap');assert.equal(g.attack.chainHistory.at(-1).payload.targetIndex,0);
}
console.log('PASS UI: direct Negate Trap target selection');
// Reproduce the scout selection through the exact visible controls, for 0, 1 and >=2 remaining cards.
for(const count of [0,1,2,5]){const g=scenario();g.state='resolving';g.B.tacticHand=Array.from({length:count},()=>t.card('tactic',{kind:'buff1',chain:false}));g.attack.chainHistory=[entry('peek2','A')];g.attack.resolutionIndex=0;t.resolveNextEffect();paint();if(count){
 assert(d.querySelector('#decisionPanel').hidden);assert(d.querySelector('#selectionPanel').hidden);
 assert.equal(d.querySelectorAll('#oppHand .legalTarget').length,count);
 for(let i=0;i<Math.min(2,count);i++){d.querySelectorAll('#oppHand .legalTarget')[i].click();paint();}
 assert.equal(d.querySelectorAll('#oppHand [data-inspect-title]').length,0);
 click('resolve-peek-selection','#deckActions');assert(d.querySelector('#decisionPanel').hidden);
 assert.equal(d.querySelectorAll('#oppHand [data-inspect-title]').length,Math.min(2,count));
 click('acknowledge-peek','#deckActions');assert.equal(d.querySelectorAll('#oppHand [data-inspect-title]').length,0);
 }assert.equal(g.attack.resolutionIndex,-1);assert.equal(g.attack.pendingPeekIndex,null);assert.equal(g.attack.pendingPeekAcknowledgementIndex,null);}
console.log('PASS UI: scouting 0/1/2/5 cards; choice, reveal, acknowledge and resume');
// Short discard label and exactly two deck buttons.
{t.startGame('com','A');w.DuelEngine.prepareInitialHand();const g=t.get();g.state='standby';g.standbyKey='A';t.choice().standbyCard=g.A.mainHand[0].cid;paint();assert.equal(d.querySelector('#deckActions [data-action="discard-standby"]').textContent,'捨てる');assert.equal(d.querySelector('#deckActions').children.length,2);const n=d.querySelector('#deckActions').children.length;ui.sync();assert.equal(d.querySelector('#deckActions').children.length,n);}
// Battle banner waits for both standby completions and confirmation of the human's seven tactics.
for(const chosenBeforeStandby of [false,true]){
 const g=scenario();g.state='standby';g.standbyKey='B';g.A.mainHand=[];g.B.mainHand=[];g.A.standbyComplete=true;g.B.standbyComplete=false;g.humanTacticsReady=false;
 g.A.tacticDeck=Array.from({length:7},()=>t.card('tactic',{kind:'buff1'}));g.humanTacticSelection=new w.Set(g.A.tacticDeck.map(x=>x.cid));
 let seen=0;const listen=()=>{seen++;assert(g.A.standbyComplete&&g.B.standbyComplete&&g.humanTacticsReady);};w.addEventListener('duel:battle-phase',listen);
 if(chosenBeforeStandby){t.completeHumanTacticSelection();assert.equal(seen,0);}
 t.finishStandby();assert.equal(seen,chosenBeforeStandby?1:0);
 if(!chosenBeforeStandby){assert.equal(g.state,'awaitTacticSelection');t.completeHumanTacticSelection();assert.equal(seen,1);}
 assert.equal(g.state,'turnDraw');t.beginTurn(g.B);assert.equal(seen,1);w.removeEventListener('duel:battle-phase',listen);
}
console.log('PASS UI: battle banner waits for tactic confirmation in both selection orders');
// Battle choices use the existing hand/board or the visual retreat panel.
for(const [mode,actorKey] of [['com','A']])for(const kind of ['revive','reviveFromRetreat','recycle','strategyShift','buff1','debuff1','levelDown','redirect','namedShift','splitAttack','supportDefense','removePower1','lockZone']){
 const g=scenario();g.mode=mode;g.responseActorKey=actorKey;g.state='response';const p=g[actorKey],op=g[actorKey==='A'?'B':'A'];
 if(kind==='supportDefense'||kind==='splitAttack'){g.attack.defenderKey=actorKey;g.attack.attackerKey=actorKey==='A'?'B':'A';g.attack.targetUid=p.battleArea[0].uid;}
 if(kind==='splitAttack')g.attack.attackerUids=g[g.attack.attackerKey].battleArea.map(x=>x.uid);
 const c=t.card('tactic',{kind,chain:false,pendingPlacement:true,zoneSlot:0,targetName:p.battleArea[0].name});
 p.tempPlayed=[c];p.retreat=[character(9001,1,0,'retreat unit'),t.card('tactic',{kind:'buff1',chain:false})];p.tacticHand=[t.card('tactic',{kind:'debuff1',chain:false})];p.tacticDrawPool=[t.card('tactic',{kind:'buff1'})];
 t.choice().responseCard=c.cid;t.choice().responseZoneSlot=0;paint();assert(d.querySelector('#decisionPanel').hidden,kind);
 if(['revive','reviveFromRetreat','recycle'].includes(kind)){
   assert(!d.querySelector('#selectionPanel').hidden,kind);const pick=d.querySelector('#selectionPanel button');assert(pick);pick.click();paint();
   if(kind==='recycle'){assert(t.choice().effect.size===1);click('resolve-response-multi','#deckActions');}
   else {assert.equal(t.choice().responseTargetUid,9001);const slot=d.querySelector('.legalTarget[aria-label*="番枠にLv1"]');assert(slot);slot.click();paint();}
 }else if(kind==='strategyShift'){
   assert(d.querySelector('#selectionPanel').hidden);const hand=d.querySelector((actorKey==='A'?'#ownHand':'#oppHand')+' .legalTarget');assert(hand);hand.click();paint();assert.equal(t.choice().effect.size,1);click('resolve-response-multi','#deckActions');
 }else{
   assert(d.querySelector('#selectionPanel').hidden);const nodes=[...d.querySelectorAll('.slot.legalTarget')].filter(x=>x._proxyControlButton);assert(nodes.length,kind);nodes[0].click();paint();
   if(kind==='supportDefense'){const second=[...d.querySelectorAll('.slot.legalTarget')].find(x=>x._proxyControlButton?.dataset.action==='choose-support-recipient');assert(second);second.click();paint();click('confirm-support','#deckActions');}
   else if(kind!=='lockZone')click('confirm-response-target','#deckActions');
 }
 assert.equal(g.attack.chainHistory.at(-1).kind,kind);assert(d.querySelector('#decisionPanel').hidden,kind);
}
console.log('PASS UI: battle targets, hand selection and retreat visuals for both players');
// Every trap/tactic effect, with independent expected state changes.
t.bulk(true);
let targeted=0;function effect(kind,setup,verify,payload={},actor='B'){const g=scenario();setup?.(g);const e=entry(kind,actor,payload);if(kind==='namedShift')e.targetName='unit2001';t.applyQueuedEffect(e);verify(g);targeted++;}
effect('buff1',null,g=>assert.equal(g.attack.mods[2001],1),{targetUid:2001});
effect('debuff1',null,g=>assert.equal(g.attack.mods[1001],-1),{targetUid:1001});
effect('namedShift',null,g=>assert.equal(g.attack.mods[2001],2),{targetUid:2001});
effect('namedShift',null,g=>assert.equal(g.attack.mods[2001],-2),{targetUid:2001},'A');
effect('levelDown',null,g=>assert.equal(g.A.battleArea[0].level,1),{targetUid:1001});
effect('buffAll1',null,g=>assert.equal(g.attack.mods[2001],1));
effect('debuffAll1',null,g=>assert.equal(g.attack.mods[1001],-1));
effect('redirect',null,g=>assert.equal(g.attack.targetUid,2002),{targetUid:2002});
for(const kind of ['revive','reviveFromRetreat'])effect(kind,g=>{g.B.retreat=[character(3000,3,4)];},g=>{assert.equal(g.B.retreat.length,0);assert.equal(g.B.battleArea.at(-1).level,1);assert.equal(g.B.battleArea.at(-1).battleSlot,4);},{targetUid:3000,battleSlot:4});
effect('peek2',null,g=>assert.equal(g.B.tacticHand.length,0),{ids:[],revealedLabels:['x']});
effect('drawTactic2',g=>g.B.tacticDrawPool=[t.card('tactic',{}),t.card('tactic',{}),t.card('tactic',{})],g=>{assert.equal(g.B.tacticHand.length,2);assert.equal(g.B.tacticDrawPool.length,1);});
effect('recycle',g=>g.B.retreat=[{cid:9000,type:'tactic',kind:'buff1'}],g=>{assert.equal(g.B.retreat.length,0);assert.equal(g.B.tacticHand[0].cid,9000);},{ids:[9000]});
effect('strategyShift',g=>{g.B.tacticHand=[{cid:9000,type:'tactic'}];g.B.tacticDrawPool=[{cid:9001,type:'tactic'},{cid:9002,type:'tactic'}];},g=>{assert.deepEqual(Array.from(g.B.tacticHand,x=>x.cid),[9001,9002]);assert.equal(g.B.tacticDrawPool[0].cid,9000);},{ids:[9000]});
effect('negateTrap',g=>g.attack.chainHistory=[{src:'trap',actorKey:'A',status:'pending'}],g=>assert(g.attack.chainHistory[0].negated),{targetIndex:0});
effect('splitAttack',g=>g.attack.attackerUids=[1001,1002,1003],g=>{assert.equal(g.attack.attackerUids.length,2);assert.equal(g.A.battleArea.length,3);},{targetUid:1002});
effect('supportDefense',null,g=>{assert.equal(g.attack.mods[2002],-1);assert.equal(g.attack.mods[2001],1);},{targetUid:2002,recipientUid:2001});
effect('lastStand',g=>g.attack.attackerUids=[1001,1002],g=>assert.equal(g.attack.mods[2001],2));
effect('removePower1',g=>{g.attack.mods[1002]=-1;},g=>assert.equal(g.A.exclusion[0].uid,1002),{targetUid:1002});
effect('removePower1',null,g=>assert.equal(g.A.exclusion.length,0),{targetUid:1002});
effect('lockZone',null,g=>assert.equal(g.A.pendingLockedSlotIndexes[0],4),{lockSlot:4});
effect('skipAttack',g=>{g.B.battleArea.pop();},g=>assert(g.A.skipNextAttack));
effect('skipAttack',null,g=>assert.equal(g.A.skipNextAttack,false));
effect('forceEnd',null,g=>assert.equal(g.attack.attackerUids.length,1));
// Unusable cards and payload bypasses must be rejected, not consumed.
for(const kind of ['revive','recycle','peek2','drawTactic2','strategyShift','negateTrap','splitAttack','lastStand']){const g=scenario(),c=t.card('tactic',{kind,chain:false});g.B.tacticHand=[c];assert.equal(t.responseCanActivate({src:'tactic',card:c}),false,kind);assert.equal(t.consumeResponse({src:'tactic',card:c},{empty:true,zoneSlot:0}),false,kind);assert.equal(g.B.tacticHand.length,1);targeted++;}
// Last free tactic slot remains usable after placing a targeted card.
{const g=scenario(),c=t.card('tactic',{kind:'buff1',chain:false});g.B.tempPlayed=[Object.assign(c,{zoneSlot:4,pendingPlacement:true})];g.B.trapZone=Array.from({length:4},(_,i)=>t.card('trap',{kind:'levelDown',zoneSlot:i}));assert(t.consumeResponse({src:'tactic',card:c},{targetUid:2001,zoneSlot:4}));assert.equal(g.attack.chainHistory.length,1);targeted++;}
// All seven expansion effects through the same placement path a human uses.
for(const kind of ['growth','rapidGrowth','summon','summonShuffleDraw','draw2discard2','draw1','defensePrep']){
 const g=scenario(),p=g.A;g.state='standby';g.standbyKey='A';const c=t.card('exp',{kind});
 p.mainHand=[c,t.card('character',{name:'spare1'}),t.card('character',{name:'spare2'})];
 p.mainDeck=[t.card('trap',{kind:'levelDown'}),...['new1','new2','new3'].map(name=>t.card('character',{name})),t.card('exp',{kind:'draw1'})];
 t.activateExpansion(p,c,0);
 if(kind==='growth'||kind==='rapidGrowth')t.useExpansionTarget(p,c,1002);
 if(kind==='summon')t.specialSummon(p,c,p.mainDeck.find(x=>x.type==='character').cid,4);
 if(kind==='summonShuffleDraw'){
  const chosen=p.mainDeck.filter(x=>x.type==='character').map(x=>x.cid);t.choice().reinforcement.ids=chosen;t.revealReinforcement(p);
  assert.equal(t.choice().reinforcement.stage,'reveal');t.choice().reinforcement.stage='choose';t.chooseReinforcement(1);
  assert.equal(t.choice().reinforcement.stage,'slot');t.specialSummon(p,c,chosen[1],4);
 }
 if(kind==='draw2discard2'){t.choice().discard=new w.Set(p.mainHand.map(x=>x.cid));t.resolveDrawTwo(p,c);}
 if(kind==='defensePrep')t.resolveDefensePrep(p,c,p.mainDeck[0].cid);
 assert(!p.tempPlayed.length);assert(p.retreat.some(x=>x.cid===c.cid));
 if(kind==='growth')assert.equal(p.battleArea[1].level,2);
 if(kind==='rapidGrowth')assert.equal(p.battleArea[1].level,3);
 if(kind==='summon'||kind==='summonShuffleDraw')assert.equal(p.battleArea.length,4);
 if(kind==='summonShuffleDraw')assert.equal(p.mainHand.length,2,'reinforcement no longer draws');
 if(kind==='draw1')assert.equal(p.mainHand.length,3);
 if(kind==='draw2discard2')assert.equal(p.mainHand.length,2);
 if(kind==='defensePrep')assert.equal(p.trapZone.length,1);
 targeted++;
}
// Reinforcement fails when fewer than three distinct names remain.
{const g=scenario(),p=g.A;g.state='standby';g.standbyKey='A';const c=t.card('exp',{kind:'summonShuffleDraw'});p.mainHand=[c];p.mainDeck=[t.card('character',{name:'x'}),t.card('character',{name:'x'}),t.card('character',{name:'y'})];t.activateExpansion(p,c,0);assert(p.retreat.includes(c));assert(!t.choice().reinforcement);targeted++;}
// Both sides of the human/COM selection: visual fronts first, then indistinguishable backs.
t.bulk(false);
for(const owner of ['A','B']){const g=scenario(),p=g[owner];g.mode='com';g.state='standby';g.standbyKey=owner;const c=t.card('exp',{kind:'summonShuffleDraw'});p.mainHand=[c];p.mainDeck=['x','y','z'].map(name=>t.card('character',{name}));t.activateExpansion(p,c,0);if(owner==='B'){t.comStandbyStep();assert.equal(t.choice().reinforcement.stage,'reveal');paint();assert.equal(d.querySelectorAll('#selectionPanel .selectionCard').length,3);assert.equal(d.querySelector('#deckActions [data-action="hide-reinforcement"]').textContent,'確認した');click('hide-reinforcement','#deckActions');}else {const cards=p.mainDeck;for(const x of cards){paint();d.querySelector('#selectionPanel [data-cid="'+x.cid+'"]').click();}paint();click('confirm-reinforcement','#deckActions');t.comStandbyStep();paint();}assert.equal(t.choice().reinforcement.stage,'choose');assert.equal(d.querySelectorAll('#selectionPanel .reinforcementBack').length,3);if(owner==='B'){d.querySelector('#selectionPanel .reinforcementBack').click();paint();assert.equal(t.choice().reinforcement.stage,'slot');}else{assert(t.comActionPending());t.comStandbyStep();}assert.equal(t.choice().reinforcement.stage,'slot');targeted++;}
t.bulk(true);
// Independent combat oracle for single and combined attacks, including temporary modifiers.
{const g=scenario();g.B.battleArea[0].level=0;g.attack.mods[2001]=1;t.bulk(false);t.render();const slot=d.querySelector('#oppBattle .slot[data-uid="2001"]');assert.equal(slot.dataset.basePower,'0');assert.equal(slot.dataset.tempMod,'1');assert.equal(slot.querySelector('.powerValue').textContent,'Lv. 1');assert(slot.querySelector('.powerBase').textContent.includes('元Lv. 0'));t.bulk(true);}
{const g=scenario();g.attack.mods[2001]=0;t.bulk(false);t.render();let slot=d.querySelector('#oppBattle .slot[data-uid="2001"]');assert.equal(slot.dataset.tempActive,'true');assert(slot.querySelector('.powerBase').textContent.includes('一時±0'));g.attack.mods[2001]=-1;t.render();slot=d.querySelector('#oppBattle .slot[data-uid="2001"]');assert(slot.querySelector('.powerBase').textContent.includes('一時-1'));t.bulk(true);}
for(const weakened of [false,true]){
 const g=scenario();g.state='resolving';g.A.battleArea=[character(1001,1,0),character(1002,2,1)];g.B.battleArea=[character(2001,2,0)];
 g.attack.attackerUids=[1001,1002];g.attack.allAttackerUids=[1001,1002];
 if(weakened){g.attack.mods[1001]=-1;g.attack.mods[1002]=1;}
 let resultText='';const onResult=event=>{if(event.detail.kind==='result')resultText=event.detail.text;};w.addEventListener('duel:visual',onResult);
 t.resolveAttack();w.removeEventListener('duel:visual',onResult);
 assert.equal(g.B.battleArea.length,0,'defending Lv2 retreats after combined attack');
 assert(g.A.battleArea.some(x=>x.uid===1001),'temporary Lv0 returns to base Lv1 after the battle');
 assert(g.A.battleArea.some(x=>x.uid===1002),'attacking Lv2 survives');
 if(weakened)assert(!resultText.includes('元Lvが永続的に0'));
}
{const g=scenario();g.state='resolving';g.A.battleArea=[character(1001,1,0),character(1002,3,1)];g.B.battleArea=[character(2001,2,0)];g.attack.attackerUids=[1001,1002];g.attack.allAttackerUids=[1001,1002];g.attack.mods[1001]=-1;g.A.battleArea[0].level=0;t.resolveAttack();assert(!g.A.battleArea.some(x=>x.uid===1001),'permanent base Lv0 retreats after result');}
// Contract: permanent and temporary changes are independent; a temporary boost cannot save a base Lv0.
{const g=scenario();g.state='resolving';g.A.battleArea=[character(1001,0,0),character(1002,3,1)];g.B.battleArea=[character(2001,2,0)];g.attack.attackerUids=[1001,1002];g.attack.allAttackerUids=[1001,1002];g.attack.mods[1001]=2;t.resolveAttack();assert(!g.A.battleArea.some(x=>x.uid===1001),'base Lv0 retreats even if temporary effective power is 2');}
// Contract: fracture checks effective Lv at its own resolution, including temporary changes.
{const g=scenario();g.state='resolving';g.A.battleArea=[character(1001,1,0)];g.attack.chainHistory=[entry('removePower1','B',{targetUid:1001}),entry('debuff1','B',{targetUid:1001})];g.attack.resolutionIndex=1;t.resolveNextEffect();assert.equal(g.attack.mods[1001],-1);t.resolveNextEffect();assert.equal(g.A.exclusion[0]?.uid,1001);assert.equal(g.A.retreat.length,0);}
{const g=scenario();g.state='resolving';g.A.battleArea=[character(1001,1,0)];g.attack.chainHistory=[entry('debuff1','B',{targetUid:1001}),entry('removePower1','B',{targetUid:1001})];g.attack.resolutionIndex=1;t.resolveNextEffect();assert.equal(g.A.exclusion.length,0,'fracture cannot look ahead to a later effect');t.resolveNextEffect();assert.equal(g.attack.mods[1001],-1);}
// Contract: the turn draw threshold is three cards, and a skipped attack lasts for exactly one turn.
for(const initial of [3,4]){const g=scenario();g.state='turnDraw';g.turnKey='A';g.A.tacticHand=Array.from({length:initial},()=>t.card('tactic',{kind:'buff1'}));g.A.tacticDrawPool=[t.card('tactic',{kind:'debuff1'})];t.resolveTurnDraw();assert.equal(g.A.tacticHand.length,initial+(initial<=3?1:0));assert.equal(g.state,'attackDeclare');}
{const g=scenario();g.state='turnDraw';g.turnKey='A';g.A.skipNextAttack=true;g.A.tacticDrawPool=[];g.B.tacticHand=[t.card('tactic',{kind:'buff1'})];t.resolveTurnDraw();assert.equal(g.A.skipNextAttack,false);assert.equal(g.turnKey,'B');}
let battles=0;
for(const n of [1,2,3])for(let a=1;a<=3;a++)for(let b=1;b<=3;b++)for(const mod of [-1,0,1]){const g=scenario();g.state='resolving';g.A.battleArea=Array.from({length:n},(_,i)=>character(1001+i,a,i));g.B.battleArea=[character(2001,b,0),character(2010,3,4)];g.attack.attackerUids=g.A.battleArea.map(x=>x.uid);g.attack.allAttackerUids=g.attack.attackerUids.slice();g.attack.mods[1001]=mod;const sum=n*a+mod;const equality=sum===b;t.resolveAttack();if(equality&&n>1){assert.equal(g.state,'tieChoice');t.resolveTieVictim(1001);}if(sum>b)assert(!g.B.battleArea.some(x=>x.uid===2001));if(sum<b)assert(!g.A.battleArea.some(x=>x.uid>=1001&&x.uid<1001+n));if(equality){assert.equal(g.B.battleArea.find(x=>x.uid===2001)?.level||0,b-1);if(n===1)assert.equal(g.A.battleArea.find(x=>x.uid===1001)?.level||0,a-1,`single tie a=${a}, b=${b}, mod=${mod}`);}assert.equal(g.attack,null);battles++;}
// Reverse resolution, negation, delayed cleanup and locked slots.
{const g=scenario();g.state='resolving';g.attack.chainHistory=[Object.assign(entry('levelDown','A',{targetUid:2001}),{src:'trap'}),entry('negateTrap','B',{targetIndex:0})];g.attack.resolutionIndex=1;t.resolveNextEffect();assert(g.attack.chainHistory[0].negated);assert.equal(g.attack.resolutionIndex,0);t.resolveNextEffect();assert.equal(g.B.battleArea[0].level,2);assert.equal(g.attack.resolutionIndex,-1);targeted++;}
{const g=scenario();g.state='resolving';g.B.battleArea[0].level=1;g.attack.chainHistory=[entry('buff1','B',{targetUid:2001}),entry('debuff1','A',{targetUid:2001})];g.attack.resolutionIndex=1;t.resolveNextEffect();assert(g.B.battleArea.some(x=>x.uid===2001),'zero power must not retreat mid-chain');t.resolveNextEffect();assert.equal(g.attack.mods[2001],0);targeted++;}
{const g=scenario();g.state='resolving';const used=t.card('tactic',{kind:'buff1',zoneSlot:0});g.A.tempPlayed=[used];g.attack.chainHistory=[entry('lockZone','B',{lockSlot:0})];g.attack.resolutionIndex=0;t.resolveNextEffect();assert.equal(g.A.tempPlayed.length,1,'activated card remains until battle result');assert(!g.A.retreat.some(x=>x.cid===used.cid));assert(g.A.pendingLockedSlotIndexes.includes(0));t.finishAttack();assert.equal(g.A.tempPlayed.length,0);assert(g.A.retreat.some(x=>x.cid===used.cid));assert(g.A.lockedSlotIndexes.includes(0));targeted++;}
for(const handSize of [0,3,4,7]){const g=scenario();g.state='turnDraw';g.turnKey='A';g.A.tacticHand=Array.from({length:handSize},()=>t.card('tactic',{}));g.A.tacticDrawPool=[t.card('tactic',{})];t.resolveTurnDraw();assert.equal(g.A.tacticHand.length,handSize+(handSize<=3?1:0));assert.equal(g.state,'attackDeclare');targeted++;}
{const g=scenario();g.state='turnDraw';g.turnKey='A';g.A.skipNextAttack=true;g.B.tacticDrawPool=[t.card('tactic',{})];t.resolveTurnDraw();assert.equal(g.turnKey,'B');assert.equal(g.A.skipNextAttack,false);targeted++;}
for(const count of [1,2,3]){const g=scenario();g.state='attackDeclare';g.turnKey='A';g.A.attackPassCount=count-1;g.A.tacticHand=Array.from({length:4},()=>t.card('tactic',{}));t.attackPass();if(count===1)assert.equal(g.turnKey,'B');else{assert.equal(g.penalty.count,count-1);t.choice().penalty=new w.Set(g.A.tacticHand.slice(0,count-1).map(x=>x.cid));t.resolvePenalty();assert.equal(g.A.exclusion.length,count-1);}assert.equal(g.A.attackPassCount,count);targeted++;}
{const g=scenario();g.attack=null;g.state='attackDeclare';g.turnKey='A';t.choice().attackers=new w.Set([1001,1002,1003]);t.choice().targetUid=2002;t.declareAttack();assert.equal(g.attack,null,'multi attack above target +1 rejected');t.choice().attackers=new w.Set([1001]);t.declareAttack();assert(g.attack,'single attacker has no multi attack cap');targeted++;}
console.log(`PASS targeted: ${targeted} card/legality cases, ${battles} combat cases`);
// 500 seeded COM games. Human side is automated by a legal-choice driver;
// COM uses its actual production decision policy. Rendering is omitted in this batch only.
function invariant(g,seed,step){for(const key of ['A','B']){const p=g[key],zones=['mainDeck','mainHand','tacticDeck','tacticDrawPool','tacticHand','battleArea','trapZone','tempPlayed','retreat','exclusion'];const all=zones.flatMap(z=>p[z]);assert.equal(all.length,60,`conservation ${seed}/${step}/${key}`);assert.equal(all.filter(x=>x.type==='tactic').length,20);const ids=all.filter(x=>x.cid!=null).map(x=>x.cid);assert.equal(new Set(ids).size,ids.length,'duplicate card');assert(p.battleArea.length<=5);assert.equal(new Set(p.battleArea.map(x=>x.battleSlot)).size,p.battleArea.length);assert(p.trapZone.length+p.tempPlayed.length+p.lockedSlotIndexes.length<=5);assert.equal(new Set(p.trapZone.concat(p.tempPlayed).map(x=>x.zoneSlot)).size,p.trapZone.length+p.tempPlayed.length);if(g.state==='turnDraw')for(const c of p.battleArea)assert(c.level>0&&c.level<=5);}}
let totalSteps=0,maxSteps=0,scouts=0;
for(let seed=1;seed<=500;seed++){let rng=seed;w.Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);t.reset();t.startGame('com',seed%2?'A':'B');let step=0;
 for(;step<2000;step++){const g=t.get();if(['gameOver','matchOver'].includes(g.state))break;
  if(g.state==='awaitTacticSelection'){t.autoSelectOpeningTactics();t.completeHumanTacticSelection();}
  else if(g.state==='resolving'&&(g.attack.pendingPeekIndex!=null||g.attack.pendingPeekAcknowledgementIndex!=null)){const atk=g.attack,idx=atk.pendingPeekIndex??atk.pendingPeekAcknowledgementIndex;if(atk.chainHistory[idx].actorKey==='A'){if(atk.pendingPeekIndex!=null){t.choice().effect=new w.Set(g.B.tacticHand.slice(0,2).map(x=>x.cid));t.resolvePeekSelection();scouts++;}else t.acknowledgePeek();}else t.runComStep();}
  else if(['response','chain'].includes(g.state)&&g.responseActorKey==='A'){const cards=g.A.trapZone.concat(g.A.tacticHand).filter(c=>!!c.chain===(g.state==='chain')&&(c.type!=='trap'||!g.attack.usedTraps.has(c.cid)));const plans=cards.map(c=>t.comResponsePlan({src:c.type==='trap'?'trap':'tactic',card:c})).filter(Boolean);if(plans.length&&w.Math.random()>.15){const plan=plans[Math.floor(w.Math.random()*plans.length)];t.clearChoice();t.choice().responseCard=plan.info.card.cid;t.handoff(true);if(t.consumeResponse(plan.info,plan.payload))t.finishResponsePlay(plan.info.card.kind);else t.runComStep();t.handoff(false);}else t.runComStep();}
  else if(g.state==='attackDeclare'&&g.turnKey==='A'&&w.Math.random()<.12)t.attackPass();else t.runComStep();
  invariant(t.get(),seed,step);
 }
 assert(step<2000,`stalled game seed ${seed}, state ${t.get().state}`);totalSteps+=step;maxSteps=Math.max(maxSteps,step);
 if(seed%100===0)console.log(`PASS ${seed}/500 games`);
}
// COM spectators: both sides advance automatically through reinforcement choices and resolution.
for(let seed=1;seed<=100;seed++){let rng=seed+9000;w.Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);t.reset();t.startGame('auto',seed%2?'A':'B');let step=0;for(;step<2000;step++){const g=t.get();if(['gameOver','matchOver'].includes(g.state))break;t.runComStep();invariant(t.get(),'auto'+seed,step);}assert(step<2000,`auto mode stalled seed ${seed}, ${t.get().state}`);}console.log('PASS 100/100 COM spectator games');
const report={games:500,totalSteps,maxSteps,humanScoutSelections:scouts,targetedCardCases:targeted,combatCases:battles,effectCoverage:w.effectCoverage};
console.log(JSON.stringify(report,null,2));dom.window.close();
