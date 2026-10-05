import {renderAttackArrows as drawAttackArrows} from './attack-arrows.js?v=54';
import {renderBoardTargets,SLOT_WIDTH,SLOT_DEPTH} from './board-targets.js?v=2';
import * as T from 'three';
import {Arena} from './arena.js?v=55';
import {palette,cardTexture} from './materials.js?v=33';

// The same 3D board geometry and camera, drawn by the browser's ordinary canvas
// when it cannot provide a WebGL context. This is a renderer, not another game.
export class SoftwareArena {
 constructor(canvas,labels){
  this.canvas=canvas;this.labels=labels;this.ctx=canvas.getContext('2d',{alpha:false});this.backgroundReadyPromise=new Promise(resolve=>{this.resolveBackgroundReady=resolve;});
  if(!this.ctx)throw new Error('Canvas drawing unavailable');
  this.camera=new T.OrthographicCamera(-10,10,8,-8,.1,100);
  this.camera.position.set(0,20,13);this.camera.lookAt(0,0,0);
  this.slots=[];this.piles=[];this.cards=new Map();this.shapes=[];
  this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.pointerEvent=null;this.pointerInside=false;this.renderCount=0;
  this.frame=0;this.motion=true;this.low=true;
  const builder=Object.create(Arena.prototype);
  builder.mat=palette();builder.scene={add(){}};builder.fixed={add(){}};
  builder.slots=this.slots;builder.piles=this.piles;builder.rings=[];builder.crystals=[];
  builder.box=(x,y,z,w,h,d,material)=>{this.shapes.push({kind:'box',x,y,z,w,h,d,material});return {rotation:{y:0}};};
  builder.cyl=(x,y,z,rt,rb,h,material,n=24)=>{this.shapes.push({kind:'cyl',x,y,z,w:rt*2,d:rb*2,h,material,n});return {rotation:{y:0}};};
  builder.ring=(x,y,z,r,t,material)=>{this.shapes.push({kind:'ring',x,y,z,r,t,material});return {rotation:{x:0,z:0}};};
  builder.build();
  for(const object of [...this.slots,...this.piles])object.updateMatrixWorld(true);
  this.colors=new Map(Object.entries({stone:'#bcb8a1',slate:'#778689',dark:'#3b484c',gold:'#c2a673',bronze:'#74684b',edge:'#202e32',soil:'#294138',leaf:'#4e7049',aqua:'#89e3e0',violet:'#b7a5e0'}).map(([k,v])=>[builder.mat[k],v]));
  this.shapes.sort((a,b)=>(a.kind==='ring'?a.y:a.y+a.h*.5)-(b.kind==='ring'?b.y:b.y+b.h*.5));
  this.images={};for(const name of ['limestone','slate']){
   const image=new Image();image.onload=()=>{this.images[name]=image;this.background=null;this.invalidate();};
   image.src=new URL(`../assets/${name}.jpg`,import.meta.url).href;
  }
  this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);
  canvas.addEventListener('pointermove',e=>this.pick(e,false));
  canvas.addEventListener('pointerleave',()=>{this.pointerInside=false;this.pointerEvent=null;this.hover=null;this.hoverPile=null;this.hoverSlot=null;this.onCardHover?.(null);canvas.style.cursor='default';this.invalidate();});
  canvas.addEventListener('click',e=>this.pick(e,true));
  window.addEventListener('duel:art-loaded',()=>this.invalidate());
 }
 project(x,y,z){const p=new T.Vector3(x,y,z).project(this.camera);return [(p.x+1)*this.width/2,(1-p.y)*this.height/2,p.z];}
 polygon(g,points,color){g.fillStyle=color;g.beginPath();g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);g.closePath();g.fill();}
 tint(hex,factor){const c=new T.Color(hex);c.multiplyScalar(factor);return `#${c.getHexString()}`;}
 box(g,s){
  const {x,y,z,w,h,d}=s,top=y+h/2,bottom=y-h/2,base=this.colors.get(s.material)||'#968c72';
  const corners=[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
  const p=corners.map(([xx,zz])=>this.project(xx,top,zz));
  const low=[this.project(x+w/2,bottom,z+d/2),this.project(x-w/2,bottom,z+d/2)];
  this.polygon(g,[p[3],p[2],low[0],low[1]],this.tint(base,.61));
  this.polygon(g,p,base);
  const image=s.material.map?.image;
  if(image?.complete&&image.naturalWidth&&w>.5&&d>.5){
   g.save();g.beginPath();g.moveTo(...p[0].slice(0,2));for(let i=1;i<4;i++)g.lineTo(...p[i].slice(0,2));g.closePath();g.clip();
   g.globalAlpha=.34;
   g.setTransform((p[1][0]-p[0][0])/image.width*this.scale,(p[1][1]-p[0][1])/image.width*this.scale,(p[3][0]-p[0][0])/image.height*this.scale,(p[3][1]-p[0][1])/image.height*this.scale,p[0][0]*this.scale,p[0][1]*this.scale);
   g.drawImage(image,0,0);g.restore();
  }
 }
 cyl(g,s){
  const {x,y,z,h}=s,r=s.w/2,base=this.colors.get(s.material)||'#968c72';
  const upper=[],lower=[];for(let i=0;i<=s.n;i++){
   const a=i*2*Math.PI/s.n;upper.push(this.project(x+Math.cos(a)*r,y+h/2,z+Math.sin(a)*r));
   lower.push(this.project(x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r));
  }
  for(let i=0;i<s.n;i++)if(Math.sin((i+.5)*2*Math.PI/s.n)>0)this.polygon(g,[upper[i],upper[i+1],lower[i+1],lower[i]],this.tint(base,.56+.2*Math.cos(i*2*Math.PI/s.n)));
  this.polygon(g,upper,base);
 }
 ring(g,s){const p=this.project(s.x,s.y,s.z),edge=this.project(s.x+s.r,s.y,s.z),front=this.project(s.x,s.y,s.z+s.r),base=this.colors.get(s.material)||'#d5bd87';g.strokeStyle=base;g.lineWidth=Math.max(1,s.t*this.width/17);g.beginPath();g.ellipse(p[0],p[1],Math.abs(edge[0]-p[0]),Math.abs(front[1]-p[1]),0,0,2*Math.PI);g.stroke();}
 renderBackground(){
  const layer=document.createElement('canvas');layer.width=this.canvas.width;layer.height=this.canvas.height;
  const g=layer.getContext('2d');g.scale(this.scale,this.scale);g.fillStyle='#182a2b';g.fillRect(0,0,this.width,this.height);
  for(const s of this.shapes){if(s.kind==='box')this.box(g,s);else if(s.kind==='cyl')this.cyl(g,s);else this.ring(g,s);}
  for(const [side,z] of [['own',1.55],['own',4.1],['opp',-1.55],['opp',-4.1]]){
   const x=side==='own'?5.6:-5.6;this.cardQuad(g,x,.76,z,'back','', '',false);
  }
  this.background=layer;
 }
 cardQuad(g,x,y,z,type,title,effect,sideways,outline){
  const texture=cardTexture(type,title,effect).image;
  const w=sideways?1.85:1.30,d=sideways?1.30:1.85;
  const p=[this.project(x-w/2,y,z-d/2),this.project(x+w/2,y,z-d/2),this.project(x+w/2,y,z+d/2),this.project(x-w/2,y,z+d/2)];
  this.polygon(g,p,outline||'#c9b484');
  const q=sideways?[p[3],p[0],p[1],p[2]]:p;
  g.save();g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<4;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.clip();
  g.setTransform((q[1][0]-q[0][0])/texture.width*this.scale,(q[1][1]-q[0][1])/texture.width*this.scale,(q[3][0]-q[0][0])/texture.height*this.scale,(q[3][1]-q[0][1])/texture.height*this.scale,q[0][0]*this.scale,q[0][1]*this.scale);
  g.drawImage(texture,0,0);g.restore();
 }
 resize(){
  const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;
  this.width=r.width;this.height=r.height;this.scale=Math.min(devicePixelRatio||1,1.25);
  this.canvas.width=Math.max(1,Math.round(r.width*this.scale));this.canvas.height=Math.max(1,Math.round(r.height*this.scale));
  const aspect=r.width/r.height,span=Math.max(15.2,(aspect<.85?26:19)/aspect);
  this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;
  this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  const stage=this.canvas.closest('.stage');if(stage){const sr=stage.getBoundingClientRect(),cr=this.canvas.getBoundingClientRect();const l=this.project(-7.45,0,0),rr=this.project(7.45,0,0);stage.style.setProperty('--field-left-edge',`${cr.left-sr.left+l[0]}px`);stage.style.setProperty('--field-right-edge',`${cr.left-sr.left+rr[0]}px`);}
  this.background=null;this.projectLabels();this.invalidate();
 }
 quality(value){this.low=value==='low';this.invalidate();}
 sync(){
  for(const slot of this.slots){const node=document.getElementById(slot.userData.id)?.children[slot.userData.index];slot.userData.node=node||null;}
  this.projectLabels();this.rebindHoverAfterDomUpdate();this.invalidate();
 }
 projectLabels(){
  if(!this.labels)return;this.labels.replaceChildren();renderBoardTargets(this.labels,this.slots,(x,y,z)=>this.project(x,y,z),this.width,this.height);this.renderAttackArrows();
  for(const slot of this.slots){const node=slot.userData.node;if(!node?.classList.contains('char'))continue;
   const p=this.project(slot.position.x,.51,slot.position.z),badge=document.createElement('span');
   badge.className='arenaLevelBadge'+(node.classList.contains('attackAttacker')||node.classList.contains('attackTarget')?' isSideways':'');
   const base=Number(node.dataset.basePower),mod=Number(node.dataset.tempMod);
   if(base===0)badge.classList.add('baseZero');
   const current=document.createElement('span');current.className='arenaCurrentPower';current.textContent=(node.querySelector('.powerValue')?.textContent||'Lv. 1').replace(/^Lv\.?\s*/,'Lv. ');badge.append(current);
   if(node.dataset.tempActive==='true'){const detail=document.createElement('span');detail.className='arenaBasePower';detail.textContent='元Lv. '+base+' ／ 一時'+(mod>0?'+':mod===0?'±':'')+mod;badge.append(detail);}
   badge.style.left=p[0]+'px';badge.style.top=p[1]+'px';this.labels.append(badge);
  }
 }
 renderAttackArrows(){drawAttackArrows(this.labels,this.slots,(x,y,z)=>this.project(x,y,z),this.width,this.height);}
 getControlLayout(){
  const r=this.canvas.getBoundingClientRect(),project=(x,y,z)=>{const p=new T.Vector3(x,y,z).project(this.camera);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},piles={};
  for(const hit of this.piles){const {side,suffix}=hit.userData.pile,center=project(hit.position.x,.78,hit.position.z),a=project(hit.position.x-.60,.78,hit.position.z),b=project(hit.position.x+.60,.78,hit.position.z);piles[side+suffix]={...center,diameter:Math.abs(b.x-a.x)};}
  return {piles,characterBottom:project(0,.40,1.55+1.11).y};
 }
 refreshPointerHover(){
  if(!this.pointerInside||!this.pointerEvent)return {node:null,pile:null};
  const r=this.canvas.getBoundingClientRect();this.pointer.set((this.pointerEvent.clientX-r.left)/r.width*2-1,-(this.pointerEvent.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);
  const hits=this.ray.intersectObjects([...this.slots,...this.piles],false);let node=null,pile=null;
  for(const hit of hits){if(hit.object.userData.node){node=hit.object.userData.node;break;}if(hit.object.userData.pile){pile=hit.object.userData.pile;break;}}
  const slot=node&&this.slots.find(candidate=>candidate.userData.node===node);this.hoverSlot=slot?{id:slot.userData.id,index:slot.userData.index}:null;
  if(node!==this.hover){this.onCardHover?.(node);this.invalidate();}
  this.hover=node;this.hoverPile=pile;this.canvas.style.cursor=pile||node?.classList.contains('legalTarget')?'pointer':'default';return {node,pile};
 }
 rebindHoverAfterDomUpdate(){
  if(!this.pointerInside||!this.hoverSlot){this.refreshPointerHover();return;}
  const {id,index}=this.hoverSlot,slot=this.slots.find(x=>x.userData.id===id&&x.userData.index===index),node=document.getElementById(id)?.children[index];
  if(!slot||!node||node.classList.contains('empty')||node.classList.contains('locked')){this.hover=null;this.hoverSlot=null;this.onCardHover?.(null);this.invalidate();return;}
  slot.userData.node=node;if(this.hover!==node){this.hover=node;this.onCardHover?.(node);}this.invalidate();
 }
 pick(e,click){
  this.pointerEvent={clientX:e.clientX,clientY:e.clientY};this.pointerInside=true;const {node,pile}=this.refreshPointerHover();
  if(node&&click){this.onCardSelect?.(node);window.DuelEngine.inspect(node);if(node.classList.contains('legalTarget'))node.click();}
  if(pile&&click){window.dispatchEvent(new CustomEvent('duel:pile-select',{detail:pile}));const names={MainDeck:'メインデッキ',TacticDeck:'戦術デッキ',Exclusion:'除外エリア',Retreat:'撤退エリア'};const count=document.querySelector('#'+pile.side+pile.suffix+' .pileCount')?.textContent||'0枚';document.getElementById('inspectorName').textContent=(pile.side==='own'?'自分':'相手')+'の'+names[pile.suffix];document.getElementById('inspectorEffect').textContent='カード '+count;}
 }
 invalidate(duration=0){this.animatingUntil=Math.max(this.animatingUntil||0,performance.now()+duration);if(!this.frame)this.frame=requestAnimationFrame(()=>this.loop());}
 loop(){this.frame=0;if(document.hidden)return;if(!this.background)this.renderBackground();const g=this.ctx;g.setTransform(1,0,0,1,0,0);g.drawImage(this.background,0,0);if(this.resolveBackgroundReady){this.resolveBackgroundReady();this.resolveBackgroundReady=null;}
  g.save();g.scale(this.scale,this.scale);
  const attack=document.querySelector('.half.attackingSide');if(attack){const own=document.getElementById('ownHalf').classList.contains('attackingSide'),z=own?3.55:-3.55,p=this.project(0,.45,z);g.fillStyle='#dde9e918';g.fillRect(p[0]-this.width*.24,p[1]-this.height*.19,this.width*.48,this.height*.38);}
  for(const slot of this.slots){const node=slot.userData.node;if(!node||node.classList.contains('empty')||node.classList.contains('locked'))continue;
   const type=(node.dataset.faceDown==='true'?'back':node.dataset.inspectType||'back'),title=(node.dataset.faceDown==='true'?'':node.dataset.inspectTitle||''),effect=(node.dataset.faceDown==='true'?'':node.dataset.inspectEffect||''),selected=node===this.hover||node.classList.contains('choiceTarget')||node.classList.contains('legalTarget'),sideways=node.classList.contains('attackAttacker')||node.classList.contains('attackTarget');
   this.cardQuad(g,slot.position.x,.50,slot.position.z,type,title,effect,sideways,selected?'#8cf1d3':'#c9b484');
  }
  g.restore();this.renderCount++;
  if(performance.now()<this.animatingUntil)this.invalidate();
 }
 diagnostics(){return {renderer:'software-3d',renderCount:this.renderCount,cards:this.slots.filter(x=>x.userData.node&&!x.userData.node.classList.contains('empty')).length,slots:this.slots.length,quality:'static-field'};}
}
