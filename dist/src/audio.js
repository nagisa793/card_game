// Streaming phase BGM loops; lightweight Web Audio sound effects.
const AC=window.AudioContext||window.webkitAudioContext;
const SETTING_KEY='duelArenaAudio';

export function classifyLog(message){
 if(!message)return null;
 if(/がマッチ勝利|の勝ち|【完全同点】/.test(message))return 'win';
 if(/【決着】/.test(message))return 'result';
 if(/◆結果ステップ/.test(message))return 'result';
 if(/【攻撃宣言】/.test(message))return 'attack';
 if(/【効果処理】/.test(message))return 'resolve';
 if(/攻防連鎖を確定/.test(message))return 'chain';
 if(/攻防ステップをパス|攻撃宣言パス/.test(message))return 'pass';
 if(/【攻防】/.test(message))return null;
 if(/7枚.*ドロー|枚ドロー|1枚ドロー/.test(message))return 'draw';
 if(/特殊召喚|召喚/.test(message))return null;
 if(/伏せた/.test(message))return null;
 if(/Lv0|撤退|除外/.test(message))return 'retreat';
 if(/ターンチェンジ|スタンバイフェイズ/.test(message))return 'turn';
 return null;
}

export class DuelAudio{
 constructor(){
  let saved={};try{saved=JSON.parse(localStorage.getItem(SETTING_KEY)||'{}')||{};}catch(e){}
  this.musicEnabled=saved.music!==false;this.seEnabled=saved.se!==false;
  this.musicVolume=saved.bgmLevelVersion===2&&Number.isFinite(saved.musicVolume)?Math.max(0,Math.min(100,saved.musicVolume)):70;
  if(saved.bgmLevelVersion!==2){try{localStorage.setItem(SETTING_KEY,JSON.stringify({...saved,musicVolume:this.musicVolume,bgmLevelVersion:2}));}catch(e){}}
  this.seVolume=Number.isFinite(saved.seVolume)?Math.max(0,Math.min(100,saved.seVolume)):38;
  this.musicPhase=null;
  this.musicTracks=Object.fromEntries(['standby','battle'].map(phase=>{
   return [phase,{url:new URL(`../assets/audio/${phase}-user-loop.m4a`,import.meta.url).href,streaming:true,buffer:null,loading:null,failed:false}];
  }));
  this.musicPlayers=Object.fromEntries(Object.entries(this.musicTracks).map(([phase,track])=>{
   const player=new Audio();player.loop=true;player.preload='auto';player.src=track.url;
   return [phase,player];
  }));
  this.music=this.musicPlayers.standby;
  this.effectSamples=Object.fromEntries(Object.entries({drawSet:'draw-set-user.m4a',handTurn:'hand-turn-user.m4a',cardEvent:'summon-activate-retreat-resolve-user.mp3',chain:'chain-user.mp3',choice:'select-pass-attack-confirm-user.mp3',levelUp:'level-up-user.m4a',levelDown:'level-down-user.m4a',win:'victory-user.wav',result:'battle-result-user.mp3'}).map(([kind,file])=>{
   const url=new URL(`../assets/audio/${file}`,import.meta.url).href;
   return [kind,Array.from({length:3},()=>{const player=new Audio(url);player.preload='auto';return player;})];
  }));
  this.ctx=null;this.musicSource=null;this.musicSourceGain=null;this.musicSourcePhase=null;this.musicGain=null;
  this.active=false;this.paused=false;this.victoryHold=false;this.victoryToken=0;this.quietUntil=0;this.last={};
  this.music.addEventListener('error',()=>{
   const track=this.musicTracks[this.musicPhase];
   if(track && track.url.endsWith('.ogg')){
    track.url=new URL(`../assets/audio/${this.musicPhase}-8bit-v1.mp3`,import.meta.url).href;
    this.music.src=track.url;this.resumeMusic();
   }
  });
  this.bindControls();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pauseMusic();else this.resumeMusic();});
  window.addEventListener('pagehide',()=>this.pauseMusic());
 }
 bindControls(){
  const musicToggle=document.getElementById('bgmToggle'),seToggle=document.getElementById('seToggle');
  const bgmVolume=document.getElementById('bgmVolume'),seVolume=document.getElementById('seVolume');
  musicToggle.checked=this.musicEnabled;seToggle.checked=this.seEnabled;
  bgmVolume.value=String(this.musicVolume);seVolume.value=String(this.seVolume);
  const sync=()=>{
   this.musicEnabled=musicToggle.checked;this.seEnabled=seToggle.checked;
   this.musicVolume=Number(bgmVolume.value);this.seVolume=Number(seVolume.value);
   this.setMusicVolume();this.resumeMusic();
   try{localStorage.setItem(SETTING_KEY,JSON.stringify({music:this.musicEnabled,se:this.seEnabled,musicVolume:this.musicVolume,seVolume:this.seVolume,bgmLevelVersion:2}));}catch(e){}
  };
  for(const control of [musicToggle,seToggle,bgmVolume,seVolume])control.addEventListener('input',()=>{this.unlock();sync();});
 }
 unlock(){
  if(!AC)return;
  if(!this.ctx){this.ctx=new AC();this.musicGain=this.ctx.createGain();this.musicGain.connect(this.ctx.destination);}
  if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
 }
 start(){this.unlock();this.active=true;this.syncPhase(window.DuelEngine?.view());this.resumeMusic();this.play('turn');}
 stop(){this.active=false;this.pauseMusic();}
 resetForGame(view){
  this.victoryToken++;this.victoryHold=false;
  this.pauseMusic();
  for(const player of this.effectSamples.win)player.pause();
  this.quietUntil=0;this.last.win=0;
  for(const player of Object.values(this.musicPlayers))player.currentTime=0;
  this.musicPhase=null;
  this.syncPhase(view);
 }
 syncPhase(view){
  if(!view)return;
  const wasPaused=this.paused;
  this.paused=view.mode==='auto'&&!!view.autoPaused;
  if(this.paused){this.pauseMusic();}
  const phase=!view.battlePhaseAnnounced&&['coinToss','standby','mulliganConfirm','awaitTacticSelection'].includes(view.state)?'standby':'battle';
  if(phase===this.musicPhase){if(wasPaused&&!this.paused)this.resumeMusic();return;}
  this.musicPhase=phase;
  if(this.active&&!this.paused)this.resumeMusic();
 }
 pauseMusic(){
  if(this.musicSource){this.musicSource.stop();this.musicSource.disconnect();this.musicSource=null;this.musicSourceGain=null;this.musicSourcePhase=null;}
  for(const player of Object.values(this.musicPlayers))player.pause();
 }
 setMusicVolume(){
  const volume=this.musicEnabled?(this.musicVolume/100)*(performance.now()<this.quietUntil ? .57 : 1):0;
  for(const player of Object.values(this.musicPlayers))player.volume=volume;if(this.musicGain)this.musicGain.gain.value=volume;
 }
 loadMusic(phase){
  const track=this.musicTracks[phase];
  if(!track||track.streaming||track.buffer||track.loading||track.failed||!this.ctx)return;
  const decode=url=>fetch(url).then(response=>{
   if(!response.ok)throw Error('Music load failed');return response.arrayBuffer();
  }).then(data=>this.ctx.decodeAudioData(data));
  track.loading=decode(track.url).catch(error=>{
   if(!track.url.endsWith('.ogg'))throw error;
   track.url=new URL(`../assets/audio/${phase}-8bit-v1.mp3`,import.meta.url).href;
   return decode(track.url);
  }).then(buffer=>{track.buffer=buffer;track.loading=null;this.resumeMusic();})
   .catch(()=>{track.loading=null;track.failed=true;});
 }
 resumeMusic(){
  this.setMusicVolume();
  if(!this.active||this.paused||this.victoryHold||!this.musicEnabled||document.hidden){this.pauseMusic();return;}
  if(!this.musicPhase)return;
  const track=this.musicTracks[this.musicPhase];
  if(track.streaming){
   const phase=this.musicPhase,player=this.musicPlayers[phase];
   this.music=player;
   // The previous phase keeps playing while the preloaded track starts.
   const finishSwitch=()=>{
    if(this.musicPhase!==phase||!this.active||this.paused||!this.musicEnabled||document.hidden){
     player.pause();
     return;
    }
    for(const other of Object.values(this.musicPlayers))if(other!==player)other.pause();
   };
   if(player.paused)player.play().then(finishSwitch).catch(()=>{});
   else finishSwitch();
   return;
  }
  if(!this.ctx){
   if(this.music.src!==track.url)this.music.src=track.url;
   if(this.music.paused)this.music.play().catch(()=>{});
   return;
  }
  this.music.pause();
  if(!track.buffer){this.loadMusic(this.musicPhase);return;}
  if(this.musicSource&&this.musicSourcePhase===this.musicPhase)return;
  const at=this.ctx.currentTime;
  if(this.musicSource){
   this.musicSourceGain.gain.cancelScheduledValues(at);
   this.musicSourceGain.gain.setValueAtTime(this.musicSourceGain.gain.value,at);
   this.musicSourceGain.gain.linearRampToValueAtTime(0,at+.14);
   this.musicSource.stop(at+.16);
  }
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
  source.buffer=track.buffer;source.loop=true;source.loopStart=0;source.loopEnd=96;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(1,at+.14);
  source.connect(gain).connect(this.musicGain);source.start(at);
  this.musicSource=source;this.musicSourceGain=gain;this.musicSourcePhase=this.musicPhase;
  this.loadMusic(this.musicPhase==='standby'?'battle':'standby');
 }
 tone(frequency,delay,duration,volume=.18,type='sine',slide=0){
  if(!this.ctx)return;
  const at=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(frequency,at);
  if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(30,frequency*slide),at+duration);
  gain.gain.setValueAtTime(.0001,at);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*this.seVolume/100),at+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  osc.connect(gain).connect(this.ctx.destination);osc.start(at);osc.stop(at+duration+.02);
 }
 metal(frequency,delay,duration,volume=.12){
  if(!this.ctx)return;
  const at=this.ctx.currentTime+delay,partials=[[1,.58],[2.71,.24],[4.13,.11]];
  for(const [ratio,level] of partials){
   const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(frequency*ratio,at);
   gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*level*this.seVolume/100),at+.004);
   gain.gain.exponentialRampToValueAtTime(.0001,at+duration*(ratio===1?1:.55));osc.connect(gain).connect(this.ctx.destination);osc.start(at);osc.stop(at+duration+.015);
  }
 }
 noise(delay,duration,volume=.18){
  if(!this.ctx)return;
  const size=Math.ceil(this.ctx.sampleRate*duration),buffer=this.ctx.createBuffer(1,size,this.ctx.sampleRate);
  const channel=buffer.getChannelData(0);for(let i=0;i<size;i++)channel[i]=(Math.random()*2-1)*(1-i/size);
  const at=this.ctx.currentTime+delay,source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();
  source.buffer=buffer;filter.type='highpass';filter.frequency.value=520;
  gain.gain.setValueAtTime(volume*this.seVolume/100,at);
  gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  source.connect(filter).connect(gain).connect(this.ctx.destination);source.start(at);source.stop(at+duration);
 }
 playSample(kind,onEnd){
  const players=this.effectSamples[kind];
  if(!players)return;
  const player=players.find(item=>item.paused||item.ended)||players[0];
  player.pause();player.currentTime=0;
  player.volume=this.seVolume/100;
  if(onEnd){
   let finished=false;
   const done=()=>{if(finished)return;finished=true;player.removeEventListener('ended',done);onEnd();};
   player.addEventListener('ended',done);
   player.play().catch(done);
  }else player.play().catch(()=>{});
 }
 play(kind){
  const now=performance.now();
  if(kind==='win'){
   if(this.last.win!=null&&now-this.last.win<1000)return;
   this.last.win=now;this.victoryHold=true;this.pauseMusic();
   window.dispatchEvent(new CustomEvent('duel:victory-se-start'));
   const token=++this.victoryToken;
   const done=()=>{if(token===this.victoryToken)window.dispatchEvent(new CustomEvent('duel:victory-se-end'));};
   if(this.active&&this.seEnabled&&this.seVolume)this.playSample('win',done);
   else done();
   return;
  }
  if(!this.active||!this.seEnabled||!this.seVolume)return;
  if(['select','confirm'].includes(kind)&&now-(this.last[kind]||0)<110)return;
  this.last[kind]=now;
  if(kind==='draw'||kind==='set'){this.playSample('drawSet');return;}
  if(kind==='hand'||kind==='turn'){this.playSample('handTurn');return;}
  if(['summon','exp','trap','tactic','retreat','resolve'].includes(kind)){this.playSample('cardEvent');return;}
  if(kind==='chain'){this.playSample('chain');return;}
  if(['select','confirm','pass','attack'].includes(kind)){this.playSample('choice');return;}
  if(kind==='levelUp'||kind==='levelDown'){this.playSample(kind);return;}
  if(kind==='result'){this.playSample('result');return;}
  if(!this.ctx)this.unlock();
  if(!this.ctx)return;
  if(this.ctx.state==='suspended'){this.ctx.resume().then(()=>{if(this.ctx.state==='running')this.play(kind);}).catch(()=>{});return;}
  if(this.ctx.state!=='running')return;
  switch(kind){
  }
 }
 onLog(message){const kind=classifyLog(message);if(kind)this.play(kind);}
 onAction(action){
  if(/^(toggle-opening-tactic|choose-standby|toggle-attacker|choose-target|choose-response-card|choose-response-slot|choose-response-target|choose-revive-target|toggle-effect-card|toggle-effect-char|toggle-penalty)$/.test(action))this.play('select');
  if(/^(confirm-opening-tactics|confirm-exp-target|confirm-response-target|resolve-peek-selection|acknowledge-peek)$/.test(action))this.play('confirm');
  if(/^(play-response-target|play-response-target-slot|play-response-index|play-response-simple|play-response-empty|play-lock-zone|resolve-response-multi)$/.test(action))this.play('confirm');
 }
}
