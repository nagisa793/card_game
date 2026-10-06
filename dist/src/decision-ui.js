export function createDecisionUI(stage,controls){
 const panel=document.createElement('section');panel.id='decisionPanel';panel.className='decisionPanel';panel.hidden=true;
 const header=document.createElement('div');header.className='decisionPanelHeader';header.innerHTML='<strong>選択</strong>';
 const toggle=document.createElement('button');toggle.type='button';toggle.className='decisionPeekButton';header.append(toggle);
 const body=document.createElement('div');body.id='decisionBody';body.className='decisionBody';panel.append(header,body);stage.append(panel);
 const deck=document.createElement('nav');deck.id='deckActions';deck.setAttribute('aria-label','決定・キャンセル・パス');stage.append(deck);
 let peek=false,arena=null,lastControlsRoot=null;
 const confirmations=new Set(['discard-standby','toggle-auto','skip-tactic-draw','confirm-exp-target','resolve-draw1','use-exp-empty','next-game','confirm-opening-tactics','confirm-reinforcement','hide-reinforcement','finish-standby','declare-attack','confirm-response-target','confirm-support','resolve-draw2','resolve-response-multi','resolve-penalty','resolve-next-effect','resolve-battle-result','acknowledge-peek','resolve-peek-selection','draw-tactic','confirm-mulligan','play-response-simple','resolve-defense-prep-empty']);
 function show(){panel.classList.toggle('peeked',peek);body.hidden=peek;toggle.textContent=peek?'操作を開く':'盤面を見る';}
 toggle.addEventListener('click',()=>{peek=!peek;show();});
 function position(){
  const r=stage.getBoundingClientRect(),layout=arena?.getControlLayout?.();
  const top=layout?layout.characterBottom-r.top+12:r.height*.79;
  panel.style.setProperty('--decision-x',`${r.left+r.width*.5}px`);panel.style.setProperty('--decision-y',`${r.top+top}px`);
  panel.style.setProperty('--decision-width',`${Math.min(460,r.width*.55)}px`);panel.style.setProperty('--decision-height',`${Math.max(70,r.height-top-125)}px`);
  const view=window.DuelEngine.view(),side=view?.mode==='com'?'own':view?.actor==='B'?'opp':'own';
  const screenDecks=['MainDeck','TacticDeck'].map(name=>layout?.piles?.[side+name]).filter(Boolean).sort((a,b)=>a.y-b.y);
  for(const button of deck.children){const target=button.dataset.action==='toggle-auto'?layout?.piles?.ownMainDeck:screenDecks[button.dataset.deck==='MainDeck'?0:1];
   button.style.left=`${target?target.x-r.left:r.width*.8}px`;button.style.top=`${target?target.y-r.top:r.height*(button.dataset.deck==='MainDeck'?.65:.82)}px`;
   const diameter=target?.diameter||64;button.style.width=button.style.height=`${diameter}px`;
   button.style.fontSize=`${Math.max(10,Math.min(20,diameter*.19))}px`;
  }
 }
 function sync(){
  if(lastControlsRoot===controls.firstElementChild){position();return;}
  lastControlsRoot=controls.firstElementChild;
  deck.replaceChildren();
  const buttons=[...controls.querySelectorAll('button[data-action]')];
  const cancel=buttons.find(b=>b.dataset.action==='reset-support')||buttons.find(b=>b.dataset.action==='cancel-selection');
  const pass=buttons.find(b=>['response-pass','attack-pass'].includes(b.dataset.action));
  const end=buttons.find(b=>b.dataset.action==='end-chain');
  function move(button,which,label,kind){if(!button)return;const description=button.textContent;button.setAttribute('aria-label',description);button.title=description;button.textContent=label.replace('キャンセル','キャン\nセル').replace('自動で選ぶ','自動で\n選ぶ').replace('攻撃宣言へ','攻撃\n宣言へ').replace('停止／再開','停止／\n再開');button.classList.add('deckOrb',kind);button.dataset.deck=which;if(kind==='deckConfirm')button.dataset.handoff='true';deck.append(button);}
  const shortLabels={'discard-standby':'捨てる','auto-opening-tactics':'自動で選ぶ','confirm-reinforcement':'公開','hide-reinforcement':'裏向き','skip-tactic-draw':'攻撃宣言へ','draw-tactic':'ドロー','finish-standby':'終了','resolve-next-effect':'次へ','resolve-battle-result':'結果へ','acknowledge-peek':'確認','next-game':'次の試合','toggle-auto':'停止／再開'};
  const primary=buttons.find(b=>confirmations.has(b.dataset.action))||(!cancel?end:null);
  const automatic=buttons.find(b=>b.dataset.action==='auto-opening-tactics');
  move(primary,'MainDeck',shortLabels[primary?.dataset.action]||'決定','deckConfirm');
  const secondary=automatic||cancel||pass;
  move(secondary,'TacticDeck',automatic?'自動で選ぶ':cancel?(cancel.dataset.action==='reset-support'?'選び直す':'キャンセル'):pass?'PASS':'決定',pass&&!cancel?'deckPass':automatic?'deckConfirm':'deckCancel');
  // Exactly one action per deck. A selected card replaces passing with cancellation.
  for(const button of [cancel,pass,end,automatic])if(button&&button!==secondary&&button!==primary)button.hidden=true;
  const current=controls.querySelector('.activeDecision');
  const battle=['turnDraw','attackDeclare','response','chain','resolving','tieChoice','penalty'].includes(window.DuelEngine.view()?.state);
  const needsPanel=!battle&&current&&([...current.querySelectorAll('button')].some(b=>!b.hidden)||current.querySelector('.revealedCard'));
  body.replaceChildren();panel.hidden=!needsPanel;
  if(needsPanel){body.append(current);show();}
  position();
 }
 window.addEventListener('resize',position);
 return {sync,position,open(){peek=false;show();},setArena(value){arena=value;position();}};
}
