const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let activated=false;
class FakeAudio{
 constructor(url=''){this.src=url;this.paused=true;this.currentTime=0;this.volume=1;this.handlers={};this.playCalls=0;}
 addEventListener(name,handler){this.handlers[name]=handler;}
 pause(){this.paused=true;}
 play(){this.playCalls++;if(!activated)return Promise.reject(new Error('user activation required'));this.paused=false;return Promise.resolve();}
}
const controls=new Map(['bgmToggle','seToggle','bgmVolume','seVolume'].map(id=>[id,{checked:true,value:'70',addEventListener(){}}]));
const document={hidden:false,getElementById:id=>controls.get(id),addEventListener(){}};
const window={AudioContext:null,webkitAudioContext:null,addEventListener(){},dispatchEvent(){},DuelEngine:{view:()=>({mode:'com',state:'coinToss',battlePhaseAnnounced:false})}};
const source=fs.readFileSync(path.resolve(__dirname,'../dist/src/audio.js'),'utf8').replaceAll('export ','').replaceAll('import.meta.url',"'https://test.invalid/src/audio.js'")+'\nthis.DuelAudio=DuelAudio;';
const context={window,document,Audio:FakeAudio,URL,localStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>1234},CustomEvent:class{}};
vm.runInNewContext(source,context);
(async()=>{
 const sound=new context.DuelAudio();
 activated=true;sound.startIntro();activated=false;
 await Promise.resolve();await Promise.resolve();
 assert.equal(sound.musicPlayers.standby.paused,false,'GAME START music starts inside the user gesture');
 const calls=sound.musicPlayers.standby.playCalls;
 sound.resetForGame(window.DuelEngine.view());
 assert.equal(sound.musicPlayers.standby.paused,false,'the game-start reset must preserve intro music');
 assert.equal(sound.musicPlayers.standby.playCalls,calls,'reset must not restart the track');
 sound.start();
 assert.equal(sound.musicPlayers.standby.paused,false);
 sound.musicPlayers.standby.pause();
 sound.syncPhase(window.DuelEngine.view());
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 activated=true;sound.resumeMusic();activated=false;
 await Promise.resolve();
 assert.equal(sound.musicPlayers.standby.paused,false,'a user gesture retries an interrupted track');
 console.log('PASS startup BGM: gesture start, no game-start interruption, interrupted track retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
