import {Arena} from './arena.js?v=76';
import {SoftwareArena} from './software-arena.js?v=76';
import {cardTexture,cardFaceReady} from './materials.js?v=79';
import {DuelAudio} from './audio.js?v=77';
import {createDecisionUI} from './decision-ui.js?v=79';
const $=id=>document.getElementById(id);
function fitVisibleScreen(){
 const height=window.visualViewport?.height||window.innerHeight;
 document.body.style.setProperty('--visible-height',`${Math.floor(height)}px`);
}
fitVisibleScreen();window.addEventListener('resize',fitVisibleScreen);
window.visualViewport?.addEventListener('resize',fitVisibleScreen);
const sound=new DuelAudio();
window.addEventListener('duel:game-start',()=>sound.resetForGame(window.DuelEngine.view()));
window.addEventListener('duel:render',()=>sound.syncPhase(window.DuelEngine.view()));
window.addEventListener('duel:log',event=>sound.onLog(event.detail.text));
window.addEventListener('duel:action',event=>sound.onAction(event.detail.action));
window.addEventListener('duel:response-card',event=>sound.play(event.detail.src==='trap'?'trap':'tactic'));
window.addEventListener('duel:card-sound',event=>sound.play(event.detail.kind));
document.addEventListener('pointerdown',()=>sound.unlock(),{capture:true,passive:true});
const stage=$('battleStage'),rail=$('activeFlowRail'),inspector=$('cardInspector'),side=document.querySelector('.sideColumn'),history=$('chainHistoryShell');
history.prepend(rail);const chainHeading=document.createElement('strong');chainHeading.className='chainPanelHeading';chainHeading.textContent='攻防連鎖';history.prepend(chainHeading);stage.prepend(history);stage.append(side,$('historyArea'),$('ownSelectedTacticPreview'));
// The engine keeps this inspector current during resolution; the visible preview uses its text.
side.prepend(inspector);
const dock=document.createElement('nav');dock.className='boardDock';dock.setAttribute('aria-label','盤面メニュー');
const controlsToggle=document.createElement('button'),historyToggle=document.createElement('button');
controlsToggle.type=historyToggle.type='button';controlsToggle.textContent='操作';historyToggle.textContent='履歴';
controlsToggle.setAttribute('aria-controls','controls');historyToggle.setAttribute('aria-controls','historyArea');
const chainToggle=$('chainToggleBtn');
chainToggle.type='button';
dock.append(controlsToggle,historyToggle,chainToggle);stage.append(dock);
function switchDrawer(name){
 const isOpen=stage.dataset.drawer===name;stage.dataset.drawer=isOpen?'':name;
 controlsToggle.setAttribute('aria-expanded',String(!isOpen&&name==='controls'));
 historyToggle.setAttribute('aria-expanded',String(!isOpen&&name==='history'));
}
controlsToggle.addEventListener('click',()=>switchDrawer('controls'));
historyToggle.addEventListener('click',()=>switchDrawer('history'));
stage.dataset.drawer='';controlsToggle.setAttribute('aria-expanded','false');historyToggle.setAttribute('aria-expanded','false');
const decisions=createDecisionUI(stage,$('controls'));
window.addEventListener('duel:action',event=>{
 if(['choose-standby','choose-response-card'].includes(event.detail.action))decisions.open();
 if(event.detail.action==='next-game'){pinnedCard=null;hoveredCard=null;showCardPreview();}
});
const cardPreview=document.createElement('div');cardPreview.id='boardCardPreview';cardPreview.setAttribute('aria-live','polite');cardPreview.hidden=true;
const previewImage=document.createElement('img');previewImage.alt='';
const previewText=document.createElement('div');previewText.className='boardCardText';
const previewName=document.createElement('strong'),previewEffect=document.createElement('p');
previewText.append(previewName,previewEffect);cardPreview.append(previewImage,previewText);stage.append(cardPreview);
const pilePanel=document.createElement('aside');pilePanel.id='pilePanel';pilePanel.hidden=true;
const pileTitle=document.createElement('strong'),pileContent=document.createElement('div');pileContent.className='handRow pileCardGrid';pilePanel.append(pileTitle,pileContent);stage.append(pilePanel);
let openPile=null;
function refreshPile(){if(!openPile)return;const content=window.DuelEngine.pileContents(openPile.side,openPile.suffix);if(!content){pilePanel.hidden=true;openPile=null;return;}pileTitle.textContent=content.title;pileContent.innerHTML=content.html;pilePanel.hidden=false;updateHandCardArt();}
window.addEventListener('duel:pile-select',event=>{if(!['Retreat','Exclusion'].includes(event.detail.suffix))return;openPile=event.detail;refreshPile();});
document.addEventListener('click',event=>{if(!event.target.closest?.('#pilePanel')){openPile=null;pilePanel.hidden=true;}},true);
let hoveredCard=null,pinnedCard=null,previewSignature='';
let selectedHandCid=null;
let hoveredHandNode=null,lastPointer=null;
function raiseSelectedHand(){
 for(const card of document.querySelectorAll('.handRow .card.handRaised'))card.classList.remove('handRaised');
 if(selectedHandCid!=null){
  const selected=document.querySelector(`.handRow .card[data-cid="${Number(selectedHandCid)}"]`);
  if(selected)selected.classList.add('handRaised');else selectedHandCid=null;
 }
}
function cardFromNode(node){
 if(!node || node.dataset.hiddenCard==='true' || !node.dataset.inspectTitle)return null;
 const type=node.dataset.inspectType,title=node.dataset.inspectTitle;
 return ['character','exp','trap','tactic'].includes(type)?{type,title,effect:node.dataset.inspectEffect||''}:null;
}
function showCardPreview(){
 const card=hoveredCard||pinnedCard;
 if(!card){cardPreview.hidden=true;previewSignature='';return;}
 const signature=card.type+'|'+card.title+'|'+card.effect;
 if(signature!==previewSignature){previewSignature=signature;previewImage.src=artwork(card.type,card.title,card.effect);previewImage.alt=card.title+'のカード';previewName.textContent=card.title;previewEffect.textContent=card.effect||'効果なし';}
 cardPreview.hidden=false;
}
function hoverCard(node){hoveredCard=cardFromNode(node);showCardPreview();}
function selectCard(node){const selected=cardFromNode(node);pinnedCard=selected;if(!selected)hoveredCard=null;showCardPreview();}
document.addEventListener('pointerover',event=>{const node=event.target.closest?.('[data-inspect-title]');if(node)hoverCard(node);});
document.addEventListener('pointerout',event=>{const node=event.target.closest?.('[data-inspect-title]');if(node && !(event.relatedTarget&&node.contains(event.relatedTarget)))hoverCard(null);});
function refreshHandPointer(){
 let node=null;
 if(lastPointer&&(lastPointer.pointerType==='mouse'||lastPointer.isDown)){
  node=document.elementFromPoint(lastPointer.clientX,lastPointer.clientY)?.closest?.('.handRow .card[data-cid]')||null;
  if(node?.dataset.hiddenCard==='true')node=null;
 }
 if(node!==hoveredHandNode){const previousCid=hoveredHandNode?.dataset.cid;hoveredHandNode?.classList.remove('pointerHover');hoveredHandNode=node;hoveredHandNode?.classList.add('pointerHover');if(node&&node.dataset.cid!==previousCid&&lastPointer?.pointerType==='mouse')sound.play('hand');}
 if(node)hoverCard(node);
 if(selectedHandCid!=null&&(!node||Number(node.dataset.cid)!==selectedHandCid)){selectedHandCid=null;raiseSelectedHand();}
}
document.addEventListener('pointermove',event=>{lastPointer={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType,isDown:lastPointer?.isDown||false};refreshHandPointer();},{passive:true});
document.addEventListener('pointerdown',event=>{document.body.classList.toggle('touchInput',event.pointerType!=='mouse');lastPointer={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType,isDown:true};if(event.pointerType!=='mouse'&&event.target.closest?.('.handRow .card[data-cid]:not([data-hidden-card="true"])'))sound.play('hand');refreshHandPointer();},{passive:true});
document.addEventListener('pointerup',event=>{if(lastPointer){lastPointer={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType,isDown:false};refreshHandPointer();}},{passive:true});
window.addEventListener('blur',()=>{lastPointer=null;hoveredHandNode?.classList.remove('pointerHover');hoveredHandNode=null;selectedHandCid=null;raiseSelectedHand();hoverCard(null);});
document.addEventListener('click',event=>{
 const node=event.target.closest?.('[data-inspect-title]');if(node)selectCard(node);else{hoveredCard=null;pinnedCard=null;showCardPreview();}
 const handCard=event.target.closest?.('.handRow .card[data-cid]');
 if(handCard && handCard.dataset.hiddenCard!=='true'){selectedHandCid=document.body.classList.contains('touchInput')?null:Number(handCard.dataset.cid);raiseSelectedHand();}
},true);
document.addEventListener('pointerover',event=>{
 if(event.pointerType==='mouse'&&event.target.closest?.('.handRow .card')&&selectedHandCid!=null){selectedHandCid=null;raiseSelectedHand();}
});
let arena=null,queued=false;
function warn(message){$('arenaNotice').hidden=false;$('arenaNotice').textContent=message;}
await document.fonts.load('14px DuelSans');
try{
 arena=new Arena($('sceneCanvas'),$('worldLabels'));window.DuelArena=arena;
 arena.onCardHover=hoverCard;arena.onCardSelect=selectCard;
 arena.onLost=()=>warn('3D描画を復旧しています。操作欄は引き続き使えます。');
 arena.onRestored=()=>{$('arenaNotice').hidden=true;arena.sync();};
}catch(e){
 console.warn('GPU renderer unavailable; using the same 3D board with software drawing',e);
 const previous=$('sceneCanvas'),fresh=previous.cloneNode(false);previous.replaceWith(fresh);
 arena=new SoftwareArena(fresh,$('worldLabels'));window.DuelArena=arena;
 arena.onCardHover=hoverCard;arena.onCardSelect=selectCard;
}
const imageCache=new Map();
function artwork(type,title,effect=''){const key=type+'|'+title+'|'+effect;if(!imageCache.has(key))imageCache.set(key,cardTexture(type,title,effect).image.toDataURL('image/webp',.95));return imageCache.get(key);}
let inspectSignature='';
let lastDecisionState=null;
const PHASE_DISPLAY_MS=2000;
let previousGameState=null,battlePhaseSequence=0;
let previousLevels=new Map();
function syncLevelSounds(){
 const next=new Map();let raised=false,lowered=false;
 for(const slot of document.querySelectorAll('#ownBattle .slot.char[data-uid],#oppBattle .slot.char[data-uid]')){
  const id=slot.dataset.player+':'+slot.dataset.uid;
  const level=Number(slot.querySelector('.powerValue')?.textContent.replace(/[^\d-]/g,''));
  if(!Number.isFinite(level))continue;
  if(previousLevels.has(id)){raised ||= level>previousLevels.get(id);lowered ||= level<previousLevels.get(id);}
  next.set(id,level);
 }
 previousLevels=next;
 if(raised)sound.play('levelUp');
 if(lowered)sound.play('levelDown');
}
function updateInspector(){
 if(!arena)return;const type=inspector.querySelector('.inspectorCard').className.match(/inspect-(\w+)/)?.[1]||'back';const title=$('inspectorName').textContent;
 const signature=type+'|'+title+'|'+$('inspectorEffect').textContent;if(signature===inspectSignature)return;inspectSignature=signature;
 const effect=$('inspectorEffect').textContent;
 const img=artwork(type,title,effect);$('inspectorCard').style.setProperty('background-image',`url("${img}")`,'important');

}
new MutationObserver(updateInspector).observe($('inspectorName'),{childList:true,subtree:true,characterData:true});
window.addEventListener('duel:art-loaded',()=>{imageCache.clear();inspectSignature='';previewSignature='';showCardPreview();updateHandCardArt();updateInspector();schedule();});
function installHandImage(card,url,flag){
 let img=card.querySelector(':scope > .printedCardFace');
 if(!img){img=document.createElement('img');img.className='printedCardFace';img.alt='';img.draggable=false;card.append(img);}
 if(img.getAttribute('src')!==url){img.onload=()=>{card.dataset[flag]='true';};img.src=url;}
 if(img.complete&&img.naturalWidth)card.dataset[flag]='true';
}
function updateHandCardArt(){
 for(const card of document.querySelectorAll('.card[data-inspect-title]')){
  const {inspectType:type,inspectTitle:title,inspectEffect:effect=''}=card.dataset;
  if(!['character','exp','trap','tactic'].includes(type)||!cardFaceReady(type,title))continue;
  installHandImage(card,artwork(type,title,effect),'cardVisual');
 }
 if(cardFaceReady('back'))for(const card of document.querySelectorAll('.cardBack,.pileSlot.deck'))installHandImage(card,artwork('back',''),'sharedBack');
}

function update(){
 queued=false;const view=window.DuelEngine.view();$('welcome').hidden=!arena||!!view;

 previousGameState=view?.state||null;
 if((view?.state||null)!==lastDecisionState){lastDecisionState=view?.state||null;decisions.open();}
 const preview=$('ownSelectedTacticPreview'),previewBtn=$('tacticPreviewBtn');previewBtn.hidden=preview.hidden;
 if(preview.hidden){preview.classList.remove('open');previewBtn.setAttribute('aria-expanded','false');}
 $('battleStage').dataset.mode=view?.mode||'welcome';
 for(const mode of ['com','auto']){const b=mode==='com'?$('comStartBtn'):$('autoStartBtn');b.classList.toggle('activeMode',view?.mode===mode);}
 $('scoreText').textContent=view?`${view.scoreA} — ${view.scoreB}`:'—';
 for(const item of document.querySelectorAll('#chainPanel .activeChainItem')){
  item.style.setProperty('--chain-art',`url("${artwork(item.dataset.artType||'tactic',item.dataset.artTitle||'',item.dataset.artEffect||'')}")`);
 }
 decisions.setArena(arena);decisions.sync();refreshPile();updateHandCardArt();syncLevelSounds();arena?.sync();refreshHandPointer();raiseSelectedHand();updateInspector();
 if(!hoveredCard&&!pinnedCard&&(!view||$('inspectorName').textContent==='盤面を確認中'))cardPreview.hidden=true;
}
function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
window.addEventListener('duel:render',schedule);
const previewBtn=$('tacticPreviewBtn'),preview=$('ownSelectedTacticPreview');
previewBtn.addEventListener('click',()=>{const expanded=preview.classList.toggle('open');previewBtn.setAttribute('aria-expanded',String(expanded));});
$('closeTacticPreviewBtn').addEventListener('click',()=>{preview.classList.remove('open');previewBtn.setAttribute('aria-expanded','false');previewBtn.focus();});
// Reattach a pointer to freshly rendered cards before the browser paints a frame.
for(const id of ['ownHand','oppHand','ownSelectedTacticHand'])new MutationObserver(refreshHandPointer).observe($(id),{childList:true});
for(const id of ['ownBattle','oppBattle'])new MutationObserver(()=>{arena?.rebindHoverAfterDomUpdate();schedule();}).observe($(id),{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
const startOverlay=$('gameStartOverlay'),startTitle=$('gameStartTitle'),startOrder=$('gameStartOrder'),startLoading=$('gameStartLoading');
function showBattlePhase(){
 sound.syncPhase({...window.DuelEngine.view(),battlePhaseAnnounced:true});
 const token=++battlePhaseSequence;startTitle.textContent='BATTLE PHASE';startTitle.hidden=false;startOrder.hidden=true;startLoading.hidden=true;
 startOverlay.hidden=false;startOverlay.classList.remove('boardReveal');startOverlay.classList.add('phaseReveal','battlePhaseReveal');
 setTimeout(()=>{if(token!==battlePhaseSequence)return;startOverlay.hidden=true;startOverlay.classList.remove('phaseReveal','battlePhaseReveal');},PHASE_DISPLAY_MS);
}
document.body.append(startOverlay);
window.addEventListener('duel:battle-phase',showBattlePhase);
let startingGame=false;
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function waitForInitialHandArt(timeoutMs=25000){
 return new Promise(resolve=>{
  let settled=false;
  const finish=ready=>{if(settled)return;settled=true;clearTimeout(timeout);clearInterval(poll);observer.disconnect();window.removeEventListener('duel:art-loaded',check);resolve(ready);};
  const check=()=>{
   const cards=[...document.querySelectorAll('#ownHand .card,#ownHand .cardBack,#oppHand .card,#oppHand .cardBack')];
   if(cards.length&&cards.every(card=>card.classList.contains('cardBack')?card.dataset.sharedBack==='true':card.dataset.cardVisual==='true'))finish(true);
  };
  const observer=new MutationObserver(check);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-card-visual','data-shared-back']});
  window.addEventListener('duel:art-loaded',check);
  const timeout=setTimeout(()=>finish(false),timeoutMs),poll=setInterval(check,80);
  check();
 });
}
let standbySequence=0;
window.addEventListener('duel:standby-transition',event=>{
 event.preventDefault();
 const token=++standbySequence,overlay=document.createElement('div');overlay.id='standbyTransitionOverlay';overlay.setAttribute('role','status');overlay.innerHTML='<span>STANDBY PHASE END</span>';stage.append(overlay);const transitionText=overlay.firstElementChild;
 (async()=>{
  await nextFrame();await nextFrame();
  const prepared=(async()=>{
   event.detail.prepare();await nextFrame();await nextFrame();update();
   while(!await waitForInitialHandArt(15000)){updateHandCardArt();await nextFrame();}
   await Promise.all([...document.querySelectorAll('#ownHand img,#oppHand img')].map(img=>img.decode?.()||Promise.resolve()));
   arena?.sync();await arena?.renderer?.compileAsync?.(arena.scene,arena.camera);arena?.invalidate();await nextFrame();await nextFrame();
  })();
  await wait(PHASE_DISPLAY_MS);transitionText.textContent='';await wait(1000);
  transitionText.textContent='TURN CHANGE';await wait(PHASE_DISPLAY_MS);transitionText.textContent='';await wait(1000);
  transitionText.textContent='STANDBY PHASE 2';await wait(PHASE_DISPLAY_MS);transitionText.textContent='';await prepared;
  if(token===standbySequence){overlay.remove();event.detail.done();}
 })().catch(error=>{console.error('Standby preparation failed',error);overlay.textContent='盤面を準備できませんでした。再読み込みしてください。';});
});
async function startWithIntro(mode){
 if(startingGame)return;
 const current=window.DuelEngine.view();
 if(current&&current.state!=='matchOver'&&!window.confirm('進行中の対戦を破棄して最初からやり直しますか？'))return;
 startingGame=true;
 const firstKey=Math.random()<0.5?'A':'B';
 const playerName=key=>mode==='com'?(key==='A'?'あなた':'COM'):`COM ${key}`;
 pinnedCard=null;hoveredCard=null;showCardPreview();
 startOverlay.hidden=false;startOverlay.classList.remove('boardReveal','phaseReveal');document.body.classList.add('gameStarting');
 startTitle.textContent='GAME START';startTitle.hidden=false;
 startOrder.textContent=`先攻：${playerName(firstKey)}　／　後攻：${playerName(firstKey==='A'?'B':'A')}`;startOrder.hidden=false;
 startLoading.textContent='盤面を準備中…';startLoading.hidden=false;
 const shownAt=performance.now();
 try{
  // Let the browser paint the black start screen before starting or waiting on rendering work.
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  window.DuelEngine.setStartupPending(true);
  window.DuelEngine.start(mode,firstKey);window.DuelEngine.prepareInitialHand();sound.start();
  const backgroundReady=(arena?.backgroundReadyPromise||Promise.resolve()).then(()=>{startLoading.textContent='手札の画像を準備中…';});
  const handReady=waitForInitialHandArt();
  const minimumStartTime=wait(Math.max(0,2000-(performance.now()-shownAt)));
  await Promise.all([backgroundReady,handReady,minimumStartTime]);
  // The engine renders the hand on this update. Keep it covered until that frame completes.
  await nextFrame();await nextFrame();
  startOverlay.classList.add('boardReveal');
  startTitle.hidden=true;startOrder.hidden=true;startLoading.hidden=true;
  await nextFrame();
  startOverlay.classList.remove('boardReveal');startOverlay.classList.add('phaseReveal');
  startTitle.textContent='STANDBY PHASE';startTitle.hidden=false;
  await wait(PHASE_DISPLAY_MS);
  startOverlay.hidden=true;startOverlay.classList.remove('phaseReveal');document.body.classList.remove('gameStarting');window.DuelEngine.setStartupPending(false);startingGame=false;
 }catch(error){
  console.error('Game start sequence failed',error);
  startOverlay.hidden=true;document.body.classList.remove('gameStarting');window.DuelEngine.setStartupPending(false);startingGame=false;
  warn('盤面の準備に失敗しました。ページを再読み込みしてください。');
 }
}
for(const b of [...document.querySelectorAll('[data-start-mode]'),$('comStartBtn'),$('autoStartBtn')]){
 b.addEventListener('pointerdown',()=>sound.unlock(),{capture:true});
 b.addEventListener('click',event=>{
  event.preventDefault();event.stopImmediatePropagation();
  const mode=b.dataset.startMode||(b.id==='autoStartBtn'?'auto':'com');
  startWithIntro(mode);
 },{capture:true});
}
const quality=$('graphicsQuality');try{quality.value=localStorage.getItem('duelGraphics')||'standard';}catch(e){quality.value='standard';}
quality.addEventListener('change',()=>{arena?.quality(quality.value);try{localStorage.setItem('duelGraphics',quality.value);}catch(e){}});arena?.quality(quality.value);
window.addEventListener('pagehide',()=>{if(arena){cancelAnimationFrame(arena.frame);arena.frame=0;}});
window.addEventListener('pageshow',e=>{if(e.persisted&&arena)arena.invalidate();});
update();

document.addEventListener('visibilitychange',()=>{if(!document.hidden)arena?.invalidate();});
