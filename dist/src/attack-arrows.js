export function renderAttackArrows(labels,slots,project,width,height){
 const attackers=[...document.querySelectorAll('#ownBattle .attackAttacker,#oppBattle .attackAttacker')],target=document.querySelector('#ownBattle .attackTarget,#oppBattle .attackTarget');
 const dest=slots.find(slot=>slot.userData.node===target);if(!dest||!attackers.length)return;
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('class','attackArrowOverlay');svg.setAttribute('viewBox',`0 0 ${Math.max(1,width)} ${Math.max(1,height)}`);
 const tip=project(dest.position.x,.51,dest.position.z-Math.sign(dest.position.z)*.60),middleY=project(0,.43,0)[1];
 const edge=project(dest.position.x+.16,.51,dest.position.z),center=project(dest.position.x,.51,dest.position.z),halfWidth=Math.max(4,Math.min(9,Math.abs(edge[0]-center[0])));
 const direction=Math.sign(tip[1]-middleY)||1,baseY=tip[1]-direction*Math.sqrt(3)*halfWidth;
 const starts=attackers.map(node=>slots.find(slot=>slot.userData.node===node)).filter(slot=>slot&&slot!==dest).map(slot=>project(slot.position.x,.51,slot.position.z-Math.sign(slot.position.z)*.67));
 if(!starts.length)return;
 function line(points){const path=document.createElementNS(ns,'path');path.setAttribute('class','attackArrowLine');path.setAttribute('d',points.map((p,i)=>(i?'L':'M')+' '+p[0]+' '+p[1]).join(' '));svg.append(path);}
 for(const start of starts){line([start,[start[0],middleY]]);const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',start[0]);dot.setAttribute('cy',start[1]);dot.setAttribute('r','2.5');dot.setAttribute('fill','#fff');svg.append(dot);}
 const xs=starts.map(p=>p[0]).concat(tip[0]),left=Math.min(...xs),right=Math.max(...xs);
 if(right-left>1)line([[left,middleY],[right,middleY]]);
 line([[tip[0],middleY],[tip[0],baseY]]);
 const head=document.createElementNS(ns,'polygon');head.setAttribute('points',`${tip[0]-halfWidth},${baseY} ${tip[0]+halfWidth},${baseY} ${tip[0]},${tip[1]}`);head.setAttribute('fill','#fff');head.setAttribute('class','attackArrowHead');svg.append(head);labels.prepend(svg);
}
