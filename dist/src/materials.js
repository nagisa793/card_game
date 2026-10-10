import * as T from 'three';
import {characterArt} from './character-art.js?v=32';
export function palette(){
 return {gold:new T.MeshStandardMaterial({color:0xb5a274,metalness:.77,roughness:.34}),edge:new T.MeshStandardMaterial({color:0x1c252a,metalness:.5,roughness:.35})};
}

const FRONT={w:768,h:1076},BACK={w:768,h:1152};
const artSheets={
 exp:{file:'exp',cols:4,rows:2,kinds:['growth','rapidGrowth','summon','summonShuffleDraw','draw2discard2','draw1','defensePrep']},
 trap:{file:'trap',cols:4,rows:2,kinds:['levelDown','lockZone','reviveFromRetreat','removePower1','skipAttack','forceEnd','splitAttack']},
 tactic:{file:'tactic',cols:4,rows:4,kinds:['buff1','debuff1','redirect','revive','peek2','drawTactic2','buffAll1','debuffAll1','recycle','negateTrap','strategyShift','supportDefense','lastStand']}
};
const frameFiles={character:'character',tactic:'tactic',trap:'trap',exp:'exp',back:'back'};
const artImages=new Map(),frameImages=new Map(),frameLayers=new Map(),textureCache=new Map();let refreshPending=false;let resolveCardBackReady;const cardBackReady=new Promise(resolve=>{resolveCardBackReady=resolve;});
function queueTextureRefresh(){if(refreshPending)return;refreshPending=true;requestAnimationFrame(()=>{refreshPending=false;refreshTextures();});}
function loadImage(url,onload,onerror){const img=new Image();img.onload=()=>{onload(img);queueTextureRefresh();};img.onerror=()=>{onerror?.();queueTextureRefresh();};img.src=url;}
for(const [name,url] of Object.entries(characterArt))loadImage(url,img=>artImages.set(name,img));
for(const [name,file] of Object.entries({軍人A:'military-a',軍人B:'military-b'}))loadImage(new URL(`../assets/cards/${file}.webp`,import.meta.url).href,img=>artImages.set(name,img));
for(const sheet of Object.values(artSheets))loadImage(new URL(`../assets/illustrations/${sheet.file}.webp`,import.meta.url).href,img=>{
 (sheet.kinds||sheet.names).forEach((key,index)=>artImages.set(sheet.kinds?key:'named:'+key,{image:img,index,cols:sheet.cols,rows:sheet.rows}));
});
for(const [type,file] of Object.entries(frameFiles))loadImage(new URL(`../assets/card-frames/${file}.webp`,import.meta.url).href,img=>{frameLayers.delete(type);frameImages.set(type,img);if(type==='back'){for(const texture of textureCache.values())if(texture.image.cardType==='back'){paintCard(texture.image,'back','');texture.needsUpdate=true;}resolveCardBackReady(true);}},()=>{if(type==='back')resolveCardBackReady(false);});
const displayNames={growth:'進化Lv.1',rapidGrowth:'進化Lv.2',summon:'援軍',summonShuffleDraw:'援軍指名',draw2discard2:'手札入替',draw1:'手札交換',defensePrep:'地雷探知機',levelDown:'衰弱の刻印',lockZone:'侵された大地',reviveFromRetreat:'復活の狼煙',removePower1:'消えない裂傷',skipAttack:'被食者の復讐',forceEnd:'神の終止符',splitAttack:'引裂かれる想い',buff1:'士気高揚',debuff1:'威圧',redirect:'標的変更',revive:'戦線復帰',peek2:'偵察',drawTactic2:'作戦補給',buffAll1:'総力戦',debuffAll1:'一斉妨害',recycle:'作戦回収',negateTrap:'看破',strategyShift:'作戦転換',supportDefense:'援護防御',lastStand:'背水の陣'};
function rounded(g,x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r);}
function wrap(g,text,max){const out=[];let line='';for(const ch of text){if(g.measureText(line+ch).width>max&&line){out.push(line);line='';}line+=ch;}if(line)out.push(line);return out;}
function dimensions(type){return type==='back'?BACK:FRONT;}
function prepareFrame(type,w,h){
 const img=frameImages.get(type);if(!img)return null;const cached=frameLayers.get(type);if(cached)return cached;
 const layer=document.createElement('canvas');layer.width=w;layer.height=h;const g=layer.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,w,h);
 const pixels=g.getImageData(0,0,w,h),data=pixels.data,mask=document.createElement('canvas');mask.width=w;mask.height=h;const mg=mask.getContext('2d'),mp=mg.createImageData(w,h),md=mp.data;
 const x0=Math.floor(w*.145),x1=Math.ceil(w*.855),y0=Math.floor(h*.195),y1=Math.ceil(h*.795);
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*w+x)*4,r=data[i],gg=data[i+1],b=data[i+2];if(r>226&&gg>226&&b>226&&Math.max(r,gg,b)-Math.min(r,gg,b)<17){md[i]=255;md[i+1]=255;md[i+2]=255;md[i+3]=255;data[i+3]=0;}}
 g.putImageData(pixels,0,0);mg.putImageData(mp,0,0);const result={layer,mask};frameLayers.set(type,result);return result;
}
function characterLevel(effect){const m=String(effect||'').match(/(?:現在の攻撃力：|Lv\.?\s*)(-?\d+)/);return m?m[1]:'1';}
function fitArt(g,source,x,y,w,h){
 const img=source?.image||source;if(!img?.naturalWidth)return;
 let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
 if(source.image){sw=img.naturalWidth/source.cols;sh=img.naturalHeight/source.rows;sx=(source.index%source.cols)*sw;sy=Math.floor(source.index/source.cols)*sh;}
 const targetRatio=w/h,sourceRatio=sw/sh;
 if(sourceRatio>targetRatio){const crop=sh*targetRatio;sx+=(sw-crop)/2;sw=crop;}
 else{const crop=sw/targetRatio;sy+=(sh-crop)/2;sh=crop;}
 g.drawImage(img,sx,sy,sw,sh,x,y,w,h);
}
function paintCard(canvas,type,title,effect=''){
 const g=canvas.getContext('2d'),{w,h}=dimensions(type);g.clearRect(0,0,w,h);
 if(type==='back'){const img=frameImages.get('back');if(img){g.drawImage(img,0,0,w,h);return;}const grad=g.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#274b70');grad.addColorStop(.5,'#12283f');grad.addColorStop(1,'#091521');g.fillStyle=grad;g.fillRect(0,0,w,h);g.strokeStyle='#7795b2';g.lineWidth=14;g.strokeRect(8,8,w-16,h-16);g.strokeStyle='#48627e';g.lineWidth=3;g.strokeRect(27,27,w-54,h-54);g.globalAlpha=.34;for(let y=-h;y<h*2;y+=48){g.beginPath();g.moveTo(0,y);g.lineTo(w,y+w*.42);g.stroke();}g.globalAlpha=1;return;}
 const frame=prepareFrame(type,w,h);if(!frame){g.fillStyle='#182635';g.fillRect(0,0,w,h);return;}
 const x=w*.145,y=h*.195,iw=w*.71,ih=h*.60;const cardKind=Object.keys(displayNames).find(k=>displayNames[k]===title),named=title.match(/^(.*)専用戦術$/),art=type==='character'?artImages.get(title):named?artImages.get(named[1]):artImages.get(cardKind);
 if(art){fitArt(g,art,x,y,iw,ih);g.globalCompositeOperation='destination-in';g.drawImage(frame.mask,0,0);g.globalCompositeOperation='source-over';}
 g.drawImage(frame.layer,0,0);
 if(type==='character'){
  g.textAlign='center';g.textBaseline='middle';g.font='bold 30px DuelSans, sans-serif';g.lineWidth=5;g.strokeStyle='#071318';g.strokeText('Lv. '+characterLevel(effect),w/2,h*.91);g.fillStyle='#fff1cf';g.fillText('Lv. '+characterLevel(effect),w/2,h*.91);return;
 }
 if(title){g.textAlign='center';g.textBaseline='middle';g.font='bold 28px DuelSans, sans-serif';g.lineWidth=4;g.strokeStyle='#080d14';g.strokeText(title,w/2,h*.116,w*.72);g.fillStyle='#fff1cf';g.fillText(title,w/2,h*.116,w*.72);}
 const detail=effect||(named?`自分の${named[1]}+2／相手の${named[1]}-2`:'');if(detail){g.textAlign='left';g.textBaseline='top';g.font='bold 17px DuelSans, sans-serif';g.lineWidth=3;g.strokeStyle='#07101a';g.fillStyle='#fff4dc';g.shadowColor='#000';g.shadowBlur=4;wrap(g,detail,w*.72).slice(0,4).forEach((line,i)=>{const yy=h*.825+i*23;g.strokeText(line,w*.17,yy,w*.68);g.fillText(line,w*.17,yy,w*.68);});g.shadowBlur=0;}
}
function refreshTextures(){for(const texture of textureCache.values()){const canvas=texture.image,{w,h}=dimensions(canvas.cardType);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}paintCard(canvas,canvas.cardType,canvas.cardTitle,canvas.cardEffect);texture.needsUpdate=true;}window.dispatchEvent(new CustomEvent('duel:art-loaded'));}
export {textureCache};
export function waitForCardBack(){return cardBackReady;}
export function cardFaceReady(type,title=''){
 if(type==='back')return frameImages.has('back');
 if(!frameImages.has(type))return false;
 return type!=='character'||artImages.has(title);
}
export function cardTexture(type,title,effect=''){
 const key=type+'|'+title+'|'+effect;if(textureCache.has(key))return textureCache.get(key);
 const {w,h}=dimensions(type),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.cardType=type;canvas.cardTitle=title;canvas.cardEffect=effect;paintCard(canvas,type,title,effect);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;textureCache.set(key,texture);return texture;
}
