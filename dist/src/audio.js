// Original four-channel 8-bit standby and battle themes, looped with Web Audio.
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
  this.musicVolume=Number.isFinite(saved.musicVolume)?Math.max(0,Math.min(100,saved.musicVolume)):22;
  this.seVolume=Number.isFinite(saved.seVolume)?Math.max(0,Math.min(100,saved.seVolume)):38;
  this.musicPhase=null;
  this.musicTracks=Object.fromEntries(['standby','battle'].map(phase=>{
   const extension=new Audio().canPlayType('audio/ogg; codecs="vorbis"')?'ogg':'mp3';
   return [phase,{url:new URL(`../assets/audio/${phase}-8bit-v1.${extension}`,import.meta.url).href,buffer:null,loading:null,failed:false}];
  }));
  this.music=new Audio();this.music.loop=true;this.music.preload='none';
  this.ctx=null;this.musicSource=null;this.musicSourceGain=null;this.musicSourcePhase=null;this.musicGain=null;
  this.active=false;this.quietUntil=0;this.last={};
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
   try{localStorage.setItem(SETTING_KEY,JSON.stringify({music:this.musicEnabled,se:this.seEnabled,musicVolume:this.musicVolume,seVolume:this.seVolume}));}catch(e){}
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
 syncPhase(view){
  if(!view)return;
  const phase=['coinToss','standby','mulliganConfirm','awaitTacticSelection'].includes(view.state)?'standby':'battle';
  if(phase===this.musicPhase)return;
  this.musicPhase=phase;
  if(this.active)this.resumeMusic();
 }
 pauseMusic(){
  if(this.musicSource){this.musicSource.stop();this.musicSource.disconnect();this.musicSource=null;this.musicSourceGain=null;this.musicSourcePhase=null;}
  this.music.pause();
 }
 setMusicVolume(){
  const volume=this.musicEnabled?Math.min(.42,(this.musicVolume/100)*.72)*.5*(performance.now()<this.quietUntil ? .57 : 1):0;
  this.music.volume=volume;if(this.musicGain)this.musicGain.gain.value=volume;
 }
 loadMusic(phase){
  const track=this.musicTracks[phase];
  if(!track||track.buffer||track.loading||track.failed||!this.ctx)return;
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
  if(!this.active||!this.musicEnabled||document.hidden){this.pauseMusic();return;}
  if(!this.musicPhase)return;
  const track=this.musicTracks[this.musicPhase];
  if(!this.ctx){
   if(this.music.src!==track.url)this.music.src=track.url;
   if(this.music.paused)this.music.play().catch(()=>{});
   return;
  }
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
 play(kind){
  if(!this.active||!this.seEnabled||!this.seVolume)return;
  if(!this.ctx)this.unlock();
  if(!this.ctx)return;
  if(this.ctx.state==='suspended'){this.ctx.resume().then(()=>{if(this.ctx.state==='running')this.play(kind);}).catch(()=>{});return;}
  if(this.ctx.state!=='running')return;
  const now=performance.now();if(['select','confirm'].includes(kind)&&now-(this.last[kind]||0)<110)return;this.last[kind]=now;
  switch(kind){
   case 'select':this.noise(0,.025,.025);this.metal(920,0,.095,.085);break;
   case 'confirm':this.metal(455,0,.15,.14);this.metal(820,.045,.12,.075);break;
   case 'draw':this.noise(0,.075,.065);this.metal(610,.035,.15,.12);break;
   case 'summon':this.noise(0,.20,.11);this.metal(118,.025,.34,.27);this.metal(355,.095,.24,.14);break;
   case 'set':this.noise(0,.045,.045);this.metal(205,0,.16,.18);break;
   case 'exp':this.metal(365,0,.19,.15);this.metal(735,.075,.22,.095);break;
   case 'trap':this.noise(0,.09,.08);this.metal(225,0,.29,.24);this.metal(690,.045,.20,.12);break;
   case 'tactic':this.metal(430,0,.18,.15);this.metal(880,.055,.21,.09);this.noise(.02,.055,.035);break;
   case 'attack':this.noise(0,.18,.15);this.metal(102,.025,.32,.30);this.metal(302,.04,.22,.16);break;
   case 'chain':this.metal(575,0,.14,.15);this.metal(755,.055,.15,.11);this.metal(945,.12,.19,.085);break;
   case 'resolve':this.noise(0,.085,.05);this.metal(420,.01,.24,.14);this.metal(285,.09,.29,.11);break;
   case 'levelUp':this.metal(520,0,.17,.13);this.metal(790,.075,.23,.14);break;
   case 'levelDown':this.metal(690,0,.18,.13);this.metal(360,.075,.25,.14);break;
   case 'retreat':this.noise(.035,.15,.07);this.metal(175,0,.34,.20);this.metal(248,.08,.25,.10);break;
   case 'pass':this.metal(390,0,.16,.10);break;
   case 'turn':this.metal(310,0,.23,.11);this.metal(465,.13,.29,.10);break;
   case 'result':this.noise(0,.22,.15);this.metal(125,0,.39,.23);this.metal(248,.08,.30,.10);break;
   case 'win':
    this.quietUntil=performance.now()+1700;this.setMusicVolume();setTimeout(()=>this.setMusicVolume(),1700);
    [196,294,392,587].forEach((freq,i)=>this.metal(freq,i*.16,.48,.18));break;
  }
 }
 onLog(message){const kind=classifyLog(message);if(kind)this.play(kind);}
 onAction(action){
  if(/^(toggle-opening-tactic|choose-standby|toggle-attacker|choose-target|choose-response-card|choose-response-slot|choose-response-target|choose-revive-target|toggle-effect-card|toggle-effect-char|toggle-penalty)$/.test(action))this.play('select');
  if(/^(confirm-opening-tactics|confirm-exp-target|confirm-response-target|resolve-peek-selection|acknowledge-peek)$/.test(action))this.play('confirm');
  if(/^(play-response-target|play-response-target-slot|play-response-index|play-response-simple|play-response-empty|play-lock-zone|resolve-response-multi)$/.test(action))this.play('confirm');
 }
}
