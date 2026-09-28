import {renderAttackArrows as drawAttackArrows} from './attack-arrows.js?v=54';
import {renderBoardTargets,SLOT_WIDTH,SLOT_DEPTH} from './board-targets.js?v=2';
import * as T from 'three';
import {RoundedBoxGeometry} from '../vendor/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from '../vendor/addons/environments/RoomEnvironment.js';
import {palette,cardTexture} from './materials.js?v=32';

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
  T.DefaultLoadingManager.onLoad=()=>{this.renderer.shadowMap.needsUpdate=true;this.captureStaticBackground();this.invalidate();};this.mat=palette();this.fixed=new T.Group();this.scene.add(this.fixed);this.cards=new Map();this.rings=[];this.crystals=[];this.slots=[];this.piles=[];this.ray=new T.Raycaster();this.pointer=new T.Vector2();this.pointerEvent=null;this.pointerInside=false;this.lastRender=0;this.needs=true;this.animatingUntil=0;this.motion=true;this.disposed=false;
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
  const m=this.mat;
  // A wider ruin surrounds the actual twenty playable slots, filling the side wings on desktop.
  this.box(0,-1.72,0,32,.27,23,m.soil,.12);
  for(let x=-15.5;x<15.5;x+=1.08)for(let z=-10.9;z<11;z+=1.08){
   if(Math.abs(x)<8.3&&Math.abs(z)<8.2)continue;
   const shade=(Math.sin(x*13.11+z*27.7)+Math.cos(x*19.3-z*5.1))*.5;
   const p=this.box(x+.52,-1.52+shade*.035,z+.50,1.01,.16,1.01,shade>.25?m.stone:shade<-.3?m.slate:m.dark,.018,false);
   p.rotation.y=shade*.025;
  }
  this.box(0,-.85,0,15.8,.9,15.6,m.dark,.2);this.box(0,-.31,0,15.3,.25,15.1,m.bronze,.12);this.box(0,-.09,0,14.9,.26,14.7,m.stone,.1);
  // Surface: individually jointed stone pavers. Both player halves share the same geometry.
  for(let x=-7;x<7;x+=.94)for(let z=-6.95;z<7;z+=1.05){let n=Math.sin(x*91+z*83)*.5+.5;this.box(x+.42,.085+n*.018,z+.47,.90,.14,1.0,z<0?m.slate:m.stone,.035);}
  for(const x of [-7.22,7.22]){this.box(x,.17,0,.14,.18,14.5,m.gold);this.box(x*.975,.13,0,.035,.08,14.4,m.bronze);}
  for(const z of [-7.24,7.24])this.box(0,.17,z,14.5,.18,.13,m.gold);
  this.box(0,.17,0,14.4,.16,.14,m.gold);this.box(0,.18,-.14,14.2,.13,.035,m.edge);this.box(0,.18,.14,14.2,.13,.035,m.edge);
  // Recessed octagonal tile pedestals, twenty playable slots.
  for(const [id,z] of [['oppTactic',-4.1],['oppBattle',-1.55],['ownBattle',1.55],['ownTactic',4.1]]){
   for(let i=0;i<5;i++){
    const x=(i-2)*1.73,enemy=z<0;
    this.box(x,.20,z,1.61,.15,2.22,m.edge,.065);this.box(x,.29,z,1.53,.14,2.14,enemy?m.slate:m.stone,.07);
    this.ring(x,.374,z,.60,.012,m.bronze);let tile=this.cyl(x,.355,z,.56,.59,.025,enemy?m.slate:m.stone,8);tile.rotation.y=Math.PI/8;
    this.ring(x,.377,z,.34,.009,m.gold);
    for(const dx of [-.70,.70])for(const dz of [-.97,.97])this.box(x+dx,.40,z+dz,.10,.07,.12,m.gold,.016);
    const hit=new T.Mesh(new T.PlaneGeometry(SLOT_WIDTH,SLOT_DEPTH),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.rotation.x=-Math.PI/2;hit.position.set(x,.43,z);hit.userData={id,index:i,kind:'slot'};this.scene.add(hit);this.slots.push(hit);
   }
  }
  // Deck plinths and two different repository portals per player.
  for(const side of ['own','opp'])for(const [kind,z] of [['MainDeck',side==='own'?1.55:-1.55],['TacticDeck',side==='own'?4.1:-4.1]]){
   const x=side==='own'?5.6:-5.6;
   this.box(x,.22,z,1.5,.4,2.15,m.dark,.1);this.box(x,.46,z,1.34,.09,2.0,m.gold,.03);
   for(let k=0;k<6;k++)this.box(x,.53+k*.028,z,1.2,.026,1.8,k%2?m.edge:m.stone,.005);
   const top=new T.Mesh(new T.PlaneGeometry(1.2,1.8),new T.MeshStandardMaterial({map:cardTexture('back',''),roughness:.43}));top.rotation.x=-Math.PI/2;top.position.set(x,.715,z);this.scene.add(top);
  }
  for(const z of [-4.1,-1.55,1.55,4.1]){
   const x=z<0?5.6:-5.6;
   const mm=Math.abs(z)>3?m.violet:m.aqua;
   this.cyl(x,.27,z,.76,.88,.4,m.dark,12);this.cyl(x,.49,z,.65,.70,.09,m.gold,16);this.cyl(x,.546,z,.54,.54,.022,m.edge,48);this.ring(x,.57,z,.57,.037,mm);
   for(let i=0;i<12;i++){let a=i*Math.PI/6;const mark=this.box(x+Math.sin(a)*.67,.56,z+Math.cos(a)*.67,.033,.028,.12,m.gold,.006);mark.rotation.y=a;}
  }
  for(const side of ['own','opp'])for(const [suffix,z,w,d] of [['MainDeck',1.55,1.4,2.1],['TacticDeck',4.1,1.4,2.1],['Exclusion',1.55,1.4,1.4],['Retreat',4.1,1.4,1.4]]){
   const isDeck=suffix==='MainDeck'||suffix==='TacticDeck';
   const x=(side==='own')==isDeck?5.6:-5.6;
   const hit=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hit.rotation.x=-Math.PI/2;hit.position.set(x,.78,(side==='own'?z:-z));hit.userData.pile={side,suffix};this.scene.add(hit);this.piles.push(hit);
  }
  // Architecture: buttresses, fluted pillars, segmented cornices, and luminous obelisks.
  for(const x of [-6.65,6.65])for(const z of [-6.3,6.3]){
   this.box(x,.37,z,1.25,.56,1.25,m.dark,.1,false);this.box(x,.70,z,1.07,.12,1.07,m.gold,.03,false);
   this.cyl(x,1.22,z,.36,.43,.93,m.stone,16,false);
   for(let j=0;j<12;j++){let a=j*Math.PI/6;this.cyl(x+Math.cos(a)*.37,1.24,z+Math.sin(a)*.37,.045,.045,.81,m.gold,6,false);}
   this.cyl(x,1.79,z,.57,.50,.2,m.stone,12,false);this.cyl(x,1.91,z,.50,.50,.07,m.gold,16,false);
   const crystal=new T.Mesh(new T.OctahedronGeometry(.41),new T.MeshPhysicalMaterial({color:z<0?0xc2b6ef:0x7fe5d1,metalness:.25,roughness:.11,emissive:z<0?0x66518c:0x27786a,emissiveIntensity:.65,clearcoat:1}));crystal.position.set(x,2.53,z);crystal.scale.set(.68,1.6,.68);crystal.castShadow=false;this.scene.add(crystal);this.crystals.push(crystal);
   const hoop=this.ring(x,2.25,z,.43,.025,m.gold,this.scene);hoop.rotation.z=.35;this.rings.push(hoop);
  }
  for(const side of [-1,1]){
   for(let i=0;i<11;i++){let x=-5.4+i*1.08;this.box(x,.58,side*7.12,1.02,.62,.48,m.dark,.035,false);this.box(x,.94,side*7.12,1.1,.12,.57,m.stone,.035,false);}
   // Stair treads cut into the center of the near and far edges.
   for(let j=0;j<4;j++)this.box(0,-.1-j*.20,side*(7.5+j*.35),3.1+j*.42,.20,.7,m.slate,.025);
  }
  // Floating bedrock, deliberately irregular silhouettes outside the playable surface.
  for(let i=0;i<46;i++){
   const a=i*Math.PI*2/46,x=Math.sin(a)*7.25,z=Math.cos(a)*7.35;
   const rock=new T.Mesh(new T.DodecahedronGeometry(.65+(i%5)*.11,0),m.dark);rock.position.set(x,-.96-(i%3)*.13,z);rock.scale.set(1,.9+(i%4)*.2,1);rock.rotation.set(i*.37,i*.7,i*.23);rock.castShadow=false;rock.receiveShadow=false;this.fixed.add(rock);
  }
  // Tall circular monuments, layered bronze inlays, stairs and luminous wells.
  for(const side of [-1,1])for(const z of [-4.4,4.4]){
   const x=side*9.65,glow=z<0?m.violet:m.aqua;
   this.box(x,-.91,z,3.2,1.1,3.4,m.dark,.13,false);this.box(x,-.30,z,2.85,.18,3.0,m.gold,.06,false);
   for(let k=0;k<3;k++)this.box(x,-.12+k*.19,z,2.6-k*.24,.18,2.78-k*.23,k===1?m.bronze:m.stone,.035,false);
   this.cyl(x,.38,z,1.03,1.08,.20,m.dark,12,false);this.cyl(x,.52,z,.91,.94,.12,m.gold,16,false);
   this.cyl(x,.61,z,.75,.75,.025,glow,48,false);this.cyl(x,.64,z,.57,.57,.028,m.edge,48,false);
   for(let a=0;a<12;a++){const angle=a*Math.PI/6;const pin=this.box(x+Math.sin(angle)*.72,.68,z+Math.cos(angle)*.72,.045,.025,.17,m.gold,.007,false);pin.rotation.y=angle;}
   for(const zz of [-1,1]){
    this.box(x+side*1.1,.10,z+zz*1.27,.32,.8,.42,m.stone,.025,false);
    this.cyl(x+side*1.1,.63,z+zz*1.27,.20,.23,.30,m.bronze,8,false);
   }
  }
  for(const side of [-1,1]){
   const x=side*12.3;
   this.box(x,-.95,0,3.1,.8,6.7,m.dark,.17,false);
   for(const z of [-2.8,0,2.8]){
    this.box(x,-.39,z,2.4,.2,2.4,m.bronze,.06,false);
    this.cyl(x,.04,z,.75,.86,.67,m.stone,12,false);
    for(let level=0;level<5;level++)this.cyl(x,.48+level*.32,z,.38-level*.025,.42-level*.025,.29,m.stone,10,false);
    this.cyl(x,2.17,z,.52,.38,.18,m.gold,12,false);
    const crown=new T.Mesh(new T.OctahedronGeometry(.39),new T.MeshPhysicalMaterial({color:side<0?0x84d9e5:0xe7bc88,emissive:side<0?0x2d8b9d:0x986a42,emissiveIntensity:.8,metalness:.3,roughness:.22}));crown.position.set(x,2.64,z);crown.castShadow=false;this.scene.add(crown);this.crystals.push(crown);
   }
  }
  // Broken masonry and moss soften the otherwise regular play surface.
  let decorativeSeed=71239;const random=()=>{decorativeSeed=(1664525*decorativeSeed+1013904223)>>>0;return decorativeSeed/4294967296;};
  for(let i=0;i<105;i++){
   let side=i%2?-1:1,x=side*(7.8+random()*7.1),z=(random()-.5)*20.2;
   if(Math.abs(x)>8.4&&Math.abs(x)<11.2&&Math.abs(Math.abs(z)-4.4)<1.9)continue;
   const rock=new T.Mesh(new T.DodecahedronGeometry(.13+random()*.42,0),i%5===0?m.leaf:i%3===0?m.stone:m.dark);
   rock.position.set(x,-1.27,z);rock.rotation.set(random()*1.3,random()*3,random()*1.3);rock.scale.set(1,.25+random()*.55,1);rock.castShadow=false;rock.receiveShadow=false;this.fixed.add(rock);
  }
  // Small clustered ground cover, instanced to keep foliage draw calls low.
  let seed=391;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const foliage=new T.InstancedMesh(new T.IcosahedronGeometry(.13,0),m.leaf,400),dummy=new T.Object3D();
  for(let i=0;i<400;i++){
   const side=i%2?-1:1,x=side*(6.92+rand()*.24),z=-6.7+rand()*13.4;
   dummy.position.set(x,.27+rand()*.1,z);dummy.rotation.set(rand()*3,rand()*6,rand()*3);dummy.scale.set(.5+rand(),.4+rand()*.5,.6+rand());dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);foliage.setColorAt(i,new T.Color().setHSL(.23+rand()*.09,.23+rand()*.12,.21+rand()*.11));
  }
  foliage.receiveShadow=false;this.scene.add(foliage);
 }
 mergeStatic(){
  const groups=new Map();this.fixed.updateMatrixWorld(true);
  for(const mesh of [...this.fixed.children]){if(!mesh.isMesh)continue;let geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);if(geo.index){const expanded=geo.toNonIndexed();geo.dispose();geo=expanded;}const key=mesh.material.uuid+':'+(mesh.castShadow?'shadow':'plain');if(!groups.has(key))groups.set(key,{mat:mesh.material,geos:[],shadow:mesh.castShadow});groups.get(key).geos.push(geo);mesh.geometry.dispose();}
  this.fixed.clear();for(const {mat,geos,shadow} of groups.values()){const geo=mergeGeometries(geos,false);for(const g of geos)g.dispose();if(geo){const mesh=new T.Mesh(geo,mat);mesh.castShadow=shadow;mesh.receiveShadow=shadow;this.fixed.add(mesh);}}
 }
 makeParticles(){const a=new Float32Array(60*3);for(let i=0;i<60;i++){a[i*3]=(Math.sin(i*82.7))*8;a[i*3+1]=.7+(i%13)*.18;a[i*3+2]=(Math.cos(i*41.3))*7;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(a,3));this.particles=new T.Points(g,new T.PointsMaterial({size:.026,color:0xddebc6,transparent:true,opacity:.5,depthWrite:false}));this.scene.add(this.particles);}
 resize(){const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);const aspect=r.width/r.height,span=Math.max(15.2,(aspect<.85?26:19)/aspect);this.camera.left=-span*aspect/2;this.camera.right=span*aspect/2;this.camera.top=span/2;this.camera.bottom=-span/2;this.camera.updateProjectionMatrix();
  // Pin information panels beyond the full stone battlefield slab, not just
  // beyond the card slots. The columns and circular portals remain in the wings.
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
  if(!this.staticBackground)this.staticBackground=new T.WebGLRenderTarget(size.x,size.y,{depthBuffer:true,stencilBuffer:false,generateMipmaps:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:T.UnsignedByteType});
  else this.staticBackground.setSize(size.x,size.y);
  this.renderer.setRenderTarget(this.staticBackground);this.renderer.clear(true,true,true);this.renderer.render(this.scene,this.camera);
  this.renderer.setRenderTarget(null);this.scene.background=this.staticBackground.texture;
  for(const node of this.staticNodes)node.visible=false;
  for(const node of this.staticNodes)node.traverse(child=>{if(child.geometry)child.geometry.dispose();});
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
   const badge=document.createElement('span');badge.className='arenaLevelBadge'+(node.classList.contains('attackAttacker')||node.classList.contains('attackTarget')?' isSideways':'');badge.textContent=level.replace(/^Lv\.?\s*/, 'Lv. ');
   badge.style.left=((p.x+1)*w/2)+'px';badge.style.top=((1-p.y)*h/2)+'px';this.labels.append(badge);
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
