// Run with NODE_PATH pointing to an installed jsdom package. No test API ships in dist.
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{runScripts:'outside-only',url:'https://test.invalid'}),w=dom.window,d=w.document;
w.requestAnimationFrame=()=>0;w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
const api=['newPlayer','card','choice','clearChoice','render','runComStep','startGame','comResponsePlan','consumeResponse','finishResponsePlay','resolveNextEffect','resolvePeekSelection','acknowledgePeek','beginResolution','applyQueuedEffect','declareAttack','resolveAttack','resolveTieVictim','attackPass','resolvePenalty','resolveTurnDraw','completeHumanTacticSelection','autoSelectOpeningTactics','activateExpansion','useExpansionTarget','specialSummon','searchCharacterToHand','resolveDrawTwo','resolveDefensePrep','responseCanActivate','validResponsePayload','finishStandby','comActionPending','captureSnapshot','openTacticSlotIndexes','beginTurn'];
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
function entry(kind,actorKey='B',payload={}){return {kind,actorKey,payload,src:'tactic',status:'pending',player:actorKey,card:kind};}
// Negate Trap selects the pending opponent trap directly on the board.
for(const [mode,actorKey] of [['com','A'],['manual','A'],['manual','B']]){
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
console.log('PASS UI: direct Negate Trap target selection, COM and both manual sides');
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
// Battle banner occurs once, at second standby completion, before draw/attack declaration.
{const g=scenario();g.state='standby';g.standbyKey='B';g.A.mainHand=[];g.B.mainHand=[];g.A.standbyComplete=true;g.B.standbyComplete=false;g.humanTacticsReady=false;let seen=0;const listen=()=>{seen++;assert.equal(g.state,'standby');};w.addEventListener('duel:battle-phase',listen);t.finishStandby();assert.equal(seen,1);assert.equal(g.state,'awaitTacticSelection');w.removeEventListener('duel:battle-phase',listen);}
console.log('PASS UI: two short deck controls and battle banner immediately after standby');
// Battle choices use the existing hand/board or the visual retreat panel.
for(const [mode,actorKey] of [['manual','A'],['manual','B'],['com','A']])for(const kind of ['revive','reviveFromRetreat','recycle','strategyShift','buff1','debuff1','levelDown','redirect','namedShift','splitAttack','supportDefense','removePower1','lockZone']){
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

w.close();
