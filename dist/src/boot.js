import('./main.js?v=79').catch(error=>{
 console.error('3D startup failed',error);
 const box=document.getElementById('arenaNotice');
 const noWebGL=/WebGL2 context unavailable|Error creating WebGL context/i.test(String(error));
 box.hidden=false;
 box.replaceChildren();
 const text=document.createElement('p');
 text.textContent=noWebGL
  ? '3D描画を開始できませんでした。ブラウザの描画機能が一時的に使えない可能性があります。再試行してください。'
  : '3Dフィールドを起動できませんでした。再読み込みして再試行してください。';
 const retry=document.createElement('button');
 retry.type='button';
 retry.textContent='3D表示を再試行';
 retry.onclick=()=>location.reload();
 const details=document.createElement('details');
 const summary=document.createElement('summary');
 summary.textContent='エラーの詳細';
 const reason=document.createElement('p');
 reason.textContent=String(error?.message||error);
 details.append(summary,reason);
 box.append(text,retry,details);
 document.getElementById('welcome').hidden=true;
});
