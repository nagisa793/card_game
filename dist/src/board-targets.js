// Use the same footprint as each background pedestal for both outline and input.
export const SLOT_WIDTH=1.61,SLOT_DEPTH=2.22,SLOT_TOP=.40;
export function renderBoardTargets(labels,slots,project,width,height){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('class','boardTargetOverlay');svg.setAttribute('viewBox',`0 0 ${Math.max(1,width)} ${Math.max(1,height)}`);
 for(const slot of slots){
  const node=slot.userData.node;if(!node)continue;
  const legal=node.classList.contains('legalTarget')&&node._proxyControlButton?.dataset.action!=='choose-response-card',selected=node.classList.contains('choiceTarget');
  const minus=node.classList.contains('supportMinus'),plus=node.classList.contains('supportPlus');
  if(!legal&&!selected&&!minus&&!plus)continue;
  const x=slot.position.x,z=slot.position.z,polygon=document.createElementNS(ns,'polygon');
  const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz])=>project(x+sx*SLOT_WIDTH/2,SLOT_TOP,z+sz*SLOT_DEPTH/2));
  polygon.setAttribute('points',points.map(p=>p.slice(0,2).join(',')).join(' '));
  polygon.setAttribute('class',minus?'boardSupportMinus':plus?'boardSupportPlus':selected?'boardSelectedSlot':'boardLegalSlot');
  if(legal){
   polygon.setAttribute('role','button');polygon.setAttribute('tabindex','0');polygon.setAttribute('aria-label',node.getAttribute('aria-label')||'この枠を選択');
   const activate=event=>{event.preventDefault();event.stopPropagation();const current=document.getElementById(slot.userData.id)?.children[slot.userData.index];if(current?.classList.contains('legalTarget'))current.click();};
   polygon.addEventListener('click',activate);polygon.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')activate(event);});
  }
  svg.append(polygon);
 }
 if(svg.childElementCount)labels.append(svg);
}
