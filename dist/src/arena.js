import {renderAttackArrows as drawAttackArrows} from './attack-arrows.js?v=54';
import {renderBoardTargets,SLOT_WIDTH,SLOT_DEPTH} from './board-targets.js?v=2';
import * as T from 'three';
import {RoundedBoxGeometry} from '../vendor/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from '../vendor/addons/environments/RoomEnvironment.js';
import {palette,cardTexture,waitForCardBack} from './materials.js?v=97';

export class Arena {
 constructor(canvas,labels){
  this.labels=labels;this.frame=0;this.renderCount=0;this.loop=this.loop.bind(this);this.scene=new T.Scene();this.scene.background=null;this.scene.fog=new T.FogExp2(0x11242a,.026);this.staticBackground=null;this.staticNodes=null;this.backgroundReadyPromise=new Promise(resolve=>{this.resolveBackgroundReady=resolve;});
  // Request the least restrictive context first. Retrying Three.js with different
  // attributes on the same canvas cannot recover a failed browser context.
  let gl=null;
  try{gl=canvas.getContext('webgl2',{antialias:false,alpha:true,powerPreference:'default',failIfMajorPerformanceCaveat:false});}catch(error){console.warn('WebGL2 with preferred attributes failed',error);}
  if(!gl){try{gl=canvas.getContext('webgl2');}catch(error){console.warn('WebGL2 with browser defaults failed',error);}}
  if(!gl){
   const fresh=canvas.cloneNode(false);
   canvas.replaceWith(fresh);canvas=fresh;
   try{gl=canvas.getContext('webgl2');}catch(error){console.warn('WebGL2 on a fresh canvas failed',error);}
  }
  if(!gl)throw new Error('WebGL2 context unavailable');
  this.canvas=canvas;
  this.renderer=new T.WebGLRenderer({canvas,context:gl,antialias:false,alpha:true,powerPreference:'default'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.48;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
  this.camera=new T.OrthographicCamera(-10,10,8,-8,.1,100);this.camera.position.set(0,20,13);this.camera.lookAt(0,0,0);
  const pm=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environment=pm.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.37;room.dispose();pm.dispose();
  this.scene.add(new T.HemisphereLight(0xc9f7ff,0x38402d,2.1));
  const sun=new T.DirectionalLight(0xffe6ae,3.8);sun.position.set(-7,13,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:40});sun.shadow.bias=-.0006;sun.shadow.normalBias=.025;this.scene.add(sun);this.sun=sun;
  const rim=new T.DirectionalLight(0x87c7e2,2);rim.position.set(5,5,-10);this.scene.add(rim);
  T.DefaultLoadingManager.onLoad=async()=>{await waitForCardBack();this.renderer.shadowMap.needsUpdate=true;this.captureStaticBackground();this.invalidate();};this.mat=palette();this.fixed=new T.Group();this.scene.add(this.fixed);this.cards=new Map();this.rings=[];this.crystals=[];this.slots=[];this.piles=[];this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.pointerEvent=null;this.pointerInside=false;this.lastRender=0;this.needs=true;this.animatingUntil=0;this.motion=true;this.disposed=false;
  this.build();this.turnTint=new T.Mesh(new T.PlaneGeometry(14.3,6.9),new T.MeshBasicMaterial({color:0xd5dfdf,transparent:true,opacity:.085,depthWrite:false}));this.turnTint.rotation.x=-Math.PI/2;this.turnTint.position.y=.18;this.scene.add(this.turnTint);this.mergeStatic();this.resize();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);
  canvas.addEventListener('pointermove',e=>this.pick(e,false));canvas.addEventListener('pointerleave',()=>{this.pointerInside=false;this.pointerEvent=null;this.hover=null;this.hoverPile=null;this.hoverSlot=null;this.onCardHover?.(null);this.invalidate(250);canvas.style.cursor='default';});canvas.addEventListener('click',e=>this.pick(e,true));
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.paused=true;this.onLost?.();});canvas.addEventListener('webglcontextrestored',()=>{this.paused=false;this.renderer.shadowMap.needsUpdate=true;this.captureStaticBackground();this.invalidate();this.onRestored?.();});
  this.invalidate();
 }
 box(x,y,z,w,h,d,material,r=.035,shadow=true){const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,h*.4,w*.15,d*.15)),material);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=shadow;this.fixed.add(m);return m;}
 cyl(x,y,z,rt,rb,h,mat,n=24,shadow=true){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,n),mat);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=shadow;this.fixed.add(m);return m;}
 ring(x,y,z,r,t,mat,group=this.fixed){const m=new T.Mesh(new T.TorusGeometry(r,t,6,64),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);m.castShadow=false;group.add(m);return m;}
 build(){
  this.buildTargets();
  // This photograph-like render is the complete fixed scene. It is placed in
  // camera space so its artwork and the unchanged world-space hit zones align.
  const image=new T.TextureLoader().load(new URL('../assets/arena-photoreal-v97.webp',import.meta.url).href);
  image.colorSpace=T.SRGBColorSpace;image.anisotropy=this.renderer.capabilities.getMaxAnisotropy();
  const direction=this.camera.getWorldDirection(new T.Vector3());
  // Compensate for the WebGL background pass so the displayed scene keeps the
  // restrained brightness of the original artwork. This affects no cards/HUD.
  const backdrop=new T.Mesh(new T.PlaneGeometry(24.32,15.2),new T.MeshBasicMaterial({map:image,color:0xd1d1d1,toneMapped:false,fog:false,depthWrite:true}));
  backdrop.position.copy(this.camera.position).addScaledVector(direction,60);
  backdrop.quaternion.copy(this.camera.quaternion);backdrop.frustumCulled=false;this.fixed.add(backdrop);
  const surround=new T.Mesh(new T.PlaneGeometry(40,26),new T.MeshBasicMaterial({color:0x142423,toneMapped:false,fog:false,depthWrite:true}));
  surround.position.copy(this.camera.position).addScaledVector(direction,61);
  surround.quaternion.copy(this.camera.quaternion);surround.frustumCulled=false;this.fixed.add(surround);
 }
 buildTargets(){
  for(const [id,z] of [['oppTactic',-4.1],['oppBattle',-1.55],['ownBattle',1.55],['ownTactic',4.1]]){
   for(let i=0;i<5;i++){
    const x=(i-2)*1.73;
    const hit=new T.Mesh(new T.PlaneGeometry(SLOT_WIDTH,SLOT_DEPTH),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
    hit.rotation.x=-Math.PI/2;hit.position.set(x,.43,z);hit.userData={id,index:i,kind:'slot'};this.scene.add(hit);this.slots.push(hit);
   }
  }
  for(const side of ['own','opp'])for(const [suffix,z,w,d] of [['MainDeck',1.55,1.4,2.1],['TacticDeck',4.1,1.4,2.1],['Exclusion',1.55,1.4,1.4],['Retreat',4.1,1.4,1.4]]){
   const isDeck=suffix==='MainDeck'||suffix==='TacticDeck';
   const x=(side==='own')===isDeck?5.6:-5.6;
   const hit=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
   hit.rotation.x=-Math.PI/2;hit.position.set(x,.78,side==='own'?z:-z);hit.userData.pile={side,suffix};this.scene.add(hit);this.piles.push(hit);
  }
 }
 mergeStatic(){
  const groups=new Map();this.fixed.updateMatrixWorld(true);
  for(const mesh of [...this.fixed.children]){if(!mesh.isMesh)continue;let geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);if(geo.index){const expanded=geo.toNonIndexed();geo.dispose();geo=expanded;}const key=mesh.material.uuid+':'+(mesh.castShadow?'shadow':'plain');if(!groups.has(key))groups.set(key,{mat:mesh.material,geos:[],shadow:mesh.castShadow});groups.get(key).geos.push(geo);mesh.geometry.dispose();}
  this.fixed.clear();for(const {mat,geos,shadow} of groups.values()){const geo=mergeGeometries(geos,false);for(const g of geos)g.dispose();if(geo){const mesh=new T.Mesh(geo,mat);mesh.castShadow=shadow;mesh.receiveShadow=shadow;this.fixed.add(mesh);}}
 }
 makeParticles(){const a=new Float32Array(60*3);for(let i=0;i<60;i++){a[i*3]=(Math.sin(i*82.7))*8;a[i*3+1]=.7+(i%13)*.18;a[i*3+2]=(Math.cos(i*41.3))*7;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(a,3));this.particles=new T.Points(g,new T.PointsMaterial({size:.026,color:0xddebc6,transparent:true,opacity:.5,depthWrite:false}));this.scene.add(this.particles);}
 resize(){const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);const aspect=r.width/r.height,span=Math.max(15.2,(aspect<.85?26:19)/aspect);this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();
  // Pin information panels beyond the pictured stone battlefield slab.
  const stage=this.canvas.closest('.stage');
  if(stage){const stageRect=stage.getBoundingClientRect(),canvasRect=this.canvas.getBoundingClientRect();
   const leftEdge=new T.Vector3(-7.45,0,0).project(this.camera),rightEdge=new T.Vector3(7.45,0,0).project(this.camera);
   const canvasOffset=canvasRect.left-stageRect.left;
   stage.style.setProperty('--field-left-edge',`${canvasOffset+(leftEdge.x+1)*canvasRect.width/2}px`);
   stage.style.setProperty('--field-right-edge',`${canvasOffset+(rightEdge.x+1)*canvasRect.width/2}px`);
  }
  this.projectLabels();if(this.staticBackground)this.captureStaticBackground();this.invalidate();}
 captureStaticBackground(){
  const cards=[...this.cards.values()],wasTint=this.turnTint?.visible;
  if(!this.staticNodes)this.staticNodes=this.scene.children.filter(node=>!node.isLight&&node!==this.turnTint&&!this.slots.includes(node)&&!this.piles.includes(node)&&!cards.includes(node));
  this.scene.background=null;
  for(const node of this.staticNodes)node.visible=true;
  for(const card of cards)card.visible=false;
  if(this.turnTint)this.turnTint.visible=false;
  const size=this.renderer.getDrawingBufferSize(new T.Vector2());
  // Mark the cached photograph as sRGB so Three.js does not apply the scene's
  // exposure/tone mapping a second time when displaying it as the background.
  if(!this.staticBackground)this.staticBackground=new T.WebGLRenderTarget(size.x,size.y,{depthBuffer:true,stencilBuffer:false,generateMipmaps:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:T.UnsignedByteType,colorSpace:T.SRGBColorSpace});
  else this.staticBackground.setSize(size.x,size.y);
  this.renderer.setRenderTarget(this.staticBackground);this.renderer.clear(true,true,true);this.renderer.render(this.scene,this.camera);
  this.renderer.setRenderTarget(null);this.scene.background=this.staticBackground.texture;
  for(const node of this.staticNodes)node.visible=false;
  // The cached background is recaptured on resize or quality changes. Keep its
  // source geometry alive so later captures show the artwork as well.
  for(const card of cards)card.visible=true;
  if(this.turnTint)this.turnTint.visible=wasTint;
  this.renderer.shadowMap.needsUpdate=false;
  if(this.resolveBackgroundReady){this.resolveBackgroundReady();this.resolveBackgroundReady=null;}
 }
 quality(value){const high=value==='high',low=value==='low';this.renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,high?1.5:1.25));this.renderer.shadowMap.enabled=!low;this.scene.environmentIntensity=low?.22:.37;this.low=low;this.resize();}
 makeCard(node){
  const type=(node.dataset.faceDown==='true'?'back':node.dataset.inspectType||'back'),title=(node.dataset.faceDown==='true'?'伏せカード':node.dataset.inspectTitle||'伏せカード'),effect=(node.dataset.faceDown==='true'?'':node.dataset.inspectEffect||'');
  const group=new T.Group(),cardW=type==='back'?1.22:1.32,cardH=type==='back'?1.83:1.88,faceW=type==='back'?1.2:1.29,faceH=type==='back'?1.8:1.806;const edge=new T.Mesh(new RoundedBoxGeometry(cardW,.055,cardH,1,.015),type==='character'?this.mat.gold:this.mat.edge);edge.castShadow=false;group.add(edge);
  const topMaterial=type==='character'?new T.MeshBasicMaterial({map:cardTexture(type,title,effect),toneMapped:false,transparent:type!=='back',alphaTest:.08}):new T.MeshStandardMaterial({map:cardTexture(type,title,effect),roughness:.43,metalness:.08,transparent:type!=='back',alphaTest:.08});
  if(topMaterial.map)topMaterial.map.anisotropy=this.renderer.capabilities.getMaxAnisotropy();
  const top=new T.Mesh(new T.PlaneGeometry(faceW,faceH),topMaterial);top.rotation.x=-Math.PI/2;top.position.y=.034;group.add(top);group.userData.signature=type+'|'+title+'|'+effect;
  const frame=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.43,.02,2.0)),new T.LineBasicMaterial({color:0x8af6e4,transparent:true,opacity:.9}));frame.position.y=.06;frame.visible=false;group.add(frame);group.userData.frame=frame;group.userData.top=top;
  group.userData.node=node;this.scene.add(group);return group;
 }
 sync(){
  this.turnTint.visible=!!document.querySelector('.half.attackingSide');this.turnTint.position.z=document.getElementById('ownHalf').classList.contains('attackingSide')?3.55:-3.55;
  const seen=new Set();
  for(const slot of this.slots){const node=document.getElementById(slot.userData.id)?.children[slot.userData.index];slot.userData.node=node||null;
   const key=slot.userData.id+':'+slot.userData.index;seen.add(key);let item=this.cards.get(key);
   if(!node||node.classList.contains('empty')||node.classList.contains('locked')){if(item){this.removeCard(item);this.cards.delete(key);}continue;}
   const signature=((node.dataset.faceDown==='true'?'back':node.dataset.inspectType||'back'))+'|'+((node.dataset.faceDown==='true'?'伏せカード':node.dataset.inspectTitle||'伏せカード'))+'|'+((node.dataset.faceDown==='true'?'':node.dataset.inspectEffect||''));
   if(!item||item.userData.signature!==signature){if(item)this.removeCard(item);item=this.makeCard(node);item.position.set(slot.position.x,.49,slot.position.z);this.cards.set(key,item);}
   item.userData.node=node;item.userData.targetY=.49;
   // Attack orientation is a discrete game state: turn the card exactly 90° immediately.
   item.rotation.y=(node.classList.contains('attackAttacker')||node.classList.contains('attackTarget'))?Math.PI/2:0;
   const selected=node.classList.contains('choiceTarget')||node.classList.contains('controlTargetPreview'),attacker=node.classList.contains('attackAttacker'),target=node.classList.contains('attackTarget');
   const frame=item.userData.frame;frame.visible=selected||attacker||target||(node.classList.contains('legalTarget')&&node._proxyControlButton?.dataset.action!=='choose-response-card');item.userData.baseFrameVisible=frame.visible;frame.material.color.set(selected?0x88ffb9:attacker?0xfa9391:target?0xf3d18f:0x85d8d2);
  }
  this.projectLabels();this.rebindHoverAfterDomUpdate();this.invalidate(320);
 }
 removeCard(group){this.scene.remove(group);group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==this.mat.edge&&o.material!==this.mat.gold)o.material.dispose();});}
 syncLabels(){this.labels.replaceChildren();}
 projectLabels(){
  if(!this.labels)return;
  this.labels.replaceChildren();
  const w=this.labels.clientWidth,h=this.labels.clientHeight;
  renderBoardTargets(this.labels,this.slots,(x,y,z)=>{const p=new T.Vector3(x,y,z).project(this.camera);return [(p.x+1)*w/2,(1-p.y)*h/2];},w,h);
  this.renderAttackArrows(w,h);
  for(const slot of this.slots){
   const node=slot.userData.node;if(!node?.classList.contains('char'))continue;
   const level=node.querySelector('.powerValue')?.textContent||'Lv. 1';
   const p=new T.Vector3(slot.position.x,.51,slot.position.z).project(this.camera);
   if(p.z< -1||p.z>1)continue;
   const base=Number(node.dataset.basePower),mod=Number(node.dataset.tempMod);
   const badge=document.createElement('span');badge.className='arenaLevelBadge'+(node.classList.contains('attackAttacker')||node.classList.contains('attackTarget')?' isSideways':'')+(base===0?' baseZero':'');
   const current=document.createElement('span');current.className='arenaCurrentPower';current.textContent=level.replace(/^Lv\.?\s*/, 'Lv. ');badge.append(current);
   if(node.dataset.tempActive==='true'){
    const detail=document.createElement('span');detail.className='arenaBasePower';
    detail.textContent='元Lv.'+base+' / 一時'+(mod>0?'+':mod===0?'±':'')+mod;
    const centerX=(p.x+1)*w/2;
    const nearest=this.slots.filter(peer=>peer!==slot&&peer.userData.id===slot.userData.id).reduce((gap,peer)=>{
     const projected=new T.Vector3(peer.position.x,.51,peer.position.z).project(this.camera);
     return Math.min(gap,Math.abs((projected.x+1)*w/2-centerX));
    },Infinity);
    const available=Math.max(30,Math.floor(nearest-8));
    detail.style.maxWidth=available+'px';badge.append(detail);
   }
   badge.style.left=((p.x+1)*w/2)+'px';badge.style.top=((1-p.y)*h/2)+'px';this.labels.append(badge);
   const detail=badge.querySelector('.arenaBasePower');
   if(detail&&detail.scrollWidth>detail.clientWidth){
    const currentSize=parseFloat(getComputedStyle(detail).fontSize);
    detail.style.fontSize=Math.max(8,currentSize*detail.clientWidth/detail.scrollWidth)+'px';
   }
  }
 }
 renderAttackArrows(w,h){drawAttackArrows(this.labels,this.slots,(x,y,z)=>{const p=new T.Vector3(x,y,z).project(this.camera);return [(p.x+1)*w/2,(1-p.y)*h/2];},w,h);}
 getControlLayout(){
  const r=this.canvas.getBoundingClientRect(),project=(x,y,z)=>{const p=new T.Vector3(x,y,z).project(this.camera);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};},piles={};
  for(const hit of this.piles){const {side,suffix}=hit.userData.pile,center=project(hit.position.x,.78,hit.position.z),a=project(hit.position.x-.60,.78,hit.position.z),b=project(hit.position.x+.60,.78,hit.position.z);piles[side+suffix]={...center,diameter:Math.abs(b.x-a.x)};}
  return {piles,characterBottom:project(0,.40,1.55+1.11).y};
 }
 refreshPointerHover(){
  if(!this.pointerInside||!this.pointerEvent||this.paused)return {node:null,pile:null};
  const r=this.canvas.getBoundingClientRect();this.pointer.set((this.pointerEvent.clientX-r.left)/r.width*2-1,-(this.pointerEvent.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);
  const cards=[...this.cards.values()];const hits=this.ray.intersectObjects([...cards,...this.slots,...this.piles],true);let node=null,pile=null;
  for(const hit of hits){let o=hit.object;while(o&&!o.userData.node&&!o.userData.pile)o=o.parent;if(o?.userData.node){node=o.userData.node;break;}if(o?.userData.pile){pile=o.userData.pile;break;}}
  const slot=node&&this.slots.find(candidate=>candidate.userData.node===node);this.hoverSlot=slot?{id:slot.userData.id,index:slot.userData.index}:null;
  if(node!==this.hover){this.onCardHover?.(node);this.invalidate(250);}
  this.hover=node;this.hoverPile=pile;this.canvas.style.cursor=pile||node?.classList.contains('legalTarget')?'pointer':'default';return {node,pile};
 }
 rebindHoverAfterDomUpdate(){
  if(!this.pointerInside||!this.hoverSlot){this.refreshPointerHover();return;}
  const {id,index}=this.hoverSlot,slot=this.slots.find(x=>x.userData.id===id&&x.userData.index===index),node=document.getElementById(id)?.children[index];
  if(!slot||!node||node.classList.contains('empty')||node.classList.contains('locked')){this.hover=null;this.hoverSlot=null;this.onCardHover?.(null);this.invalidate(250);return;}
  slot.userData.node=node;const item=this.cards.get(id+':'+index);if(item)item.userData.node=node;
  if(this.hover!==node){this.hover=node;this.onCardHover?.(node);}this.invalidate(250);
 }
 pick(e,click){if(this.paused)return;this.pointerEvent={clientX:e.clientX,clientY:e.clientY};this.pointerInside=true;const {node,pile}=this.refreshPointerHover();
  if(node&&click){this.onCardSelect?.(node);window.DuelEngine.inspect(node);}
  if(pile&&click){window.dispatchEvent(new CustomEvent('duel:pile-select',{detail:pile}));const names={MainDeck:'メインデッキ',TacticDeck:'戦術デッキ',Exclusion:'除外エリア',Retreat:'撤退エリア'};const count=document.querySelector('#'+pile.side+pile.suffix+' .pileCount')?.textContent||'0枚';document.getElementById('inspectorCard').className='inspectorCard';document.getElementById('inspectorName').textContent=(pile.side==='own'?'自分':'相手')+'の'+names[pile.suffix];document.getElementById('inspectorEffect').textContent='カード '+count;}
  if(click&&node?.classList.contains('legalTarget')){node.click();this.needs=true;}
 }
 invalidate(duration=0){this.needs=true;this.animatingUntil=Math.max(this.animatingUntil,performance.now()+duration);if(!this.frame&&!this.paused&&!document.hidden)this.frame=requestAnimationFrame(this.loop);}
 loop(t){
  this.frame=0;if(this.paused||document.hidden||!this.staticBackground)return;
  const off=document.body.classList.contains('motionOff')||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interval=this.low?50:33;
  if(t-this.lastRender<interval){this.frame=requestAnimationFrame(this.loop);return;}
  this.lastRender=t;
  for(const item of this.cards.values()){
   item.position.y+=(item.userData.targetY-item.position.y)*(off?1:.22);item.userData.frame.visible=item.userData.baseFrameVisible;
  }
  this.renderer.render(this.scene,this.camera);this.renderCount++;this.needs=false;
  if(t<this.animatingUntil)this.frame=requestAnimationFrame(this.loop);
 }
}
