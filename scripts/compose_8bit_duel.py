"""Original four-channel 8-bit standby and battle themes for DUEL ARENA.

Channels are strictly monophonic: pulse lead, pulse counterpoint, triangle bass,
and one NES-style noise/percussion channel. No sample instruments are used.
Both 96-second pieces resolve to their opening harmony and loop at the sample boundary.
"""
from pathlib import Path
import subprocess
import numpy as np

RATE=22050
DURATION=96
OUT=Path(__file__).resolve().parents[1]/'dist/assets/audio'
NOTES={'C':0,'C#':1,'D':2,'Eb':3,'E':4,'F':5,'F#':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11}

def midi(name):
 if isinstance(name,int):return name
 return 12*(int(name[-1])+1)+NOTES[name[:-1]]

def event(ch,beat,pitch,duration=1,amp=1,kind=None):
 assert ch in range(4)
 EVENTS[ch].append((float(beat),pitch,float(duration),float(amp),kind))

def harmonies():
 return [
  ('D2',['D4','F4','A4'],'D3'),('Bb1',['Bb3','D4','F4'],'Bb2'),
  ('F2',['F4','A4','C5'],'F3'),('C2',['C4','E4','G4'],'C3'),
  ('G1',['G3','Bb3','D4'],'G2'),('D2',['D4','F4','A4'],'D3'),
  ('Bb1',['Bb3','D4','F4'],'Bb2'),('A1',['A3','C#4','E4'],'A2')]

STANDBY_LEAD=[
 [('D5',0,1.5),('F5',2,.5),('E5',3,.5)],
 [('D5',0,1),('C5',1,1),('Bb4',2,1),('D5',3,.75)],
 [('C5',0,1),('F5',1,1),('A5',2,1),('G5',3,.7)],
 [('E5',0,1),('G5',1,1),('E5',2,1),('C5',3,.75)],
 [('Bb4',0,1),('D5',1,1),('G5',2,1),('F5',3,.8)],
 [('A5',0,1.5),('F5',2,.5),('D5',3,.75)],
 [('F5',0,1),('D5',1,1),('F5',2,.7),('Bb5',3,.75)],
 [('A5',0,1),('G5',1,1),('E5',2,1),('C#5',3,.75)]]
BATTLE_LEAD=[
 ['D5','F5','A5','D6','C6','A5','F5','A5'],
 ['Bb5','A5','F5','D5','F5','A5','Bb5','F5'],
 ['A5','C6','A5','F5','E5','F5','A5','C6'],
 ['G5','E5','G5','C6','G5','E5','D5','E5'],
 ['G5','Bb5','D6','C6','Bb5','G5','F5','G5'],
 ['A5','F5','D5','F5','A5','C6','A5','F5'],
 ['Bb5','D6','Bb5','F5','D5','F5','Bb5','D6'],
 ['A5','C#6','E6','C#6','A5','G5','E5','C#6']]
BATTLE_ANSWER=[
 ['D6','C6','A5','F5','G5','A5','F5','D5'],
 ['F5','D5','Bb4','D5','F5','Bb5','A5','F5'],
 ['C6','A5','F5','A5','C6','A5','G5','F5'],
 ['G5','C6','E6','D6','C6','G5','E5','G5'],
 ['D6','Bb5','G5','F5','G5','Bb5','D6','Bb5'],
 ['F5','A5','D6','C6','A5','F5','E5','F5'],
 ['D6','F6','D6','Bb5','F5','D5','F5','Bb5'],
 ['E6','C#6','A5','C#6','E6','D6','C#6','A5']]

def compose(phase):
 global EVENTS
 EVENTS=[[],[],[],[]]
 standby=phase=='standby';tempo=100 if standby else 160
 bars=40 if standby else 64
 assert round(bars*4*60/tempo)==DURATION
 for bar in range(bars):
  position=bar%8;root,tones,bass_high=harmonies()[position];start=bar*4
  section=bar//8
  if standby:
   # Four heavy steps followed by a tightening double stroke: ドッドッドッドッドドドド.
   pulses=[0,1,2,3,3.5,3.75]
   for j,beat in enumerate(pulses):
    event(3,start+beat,'kick' if j<4 else 'tom',.20 if j<4 else .13,
          (.46+bar/55)*(1.10 if beat==0 else .86))
   if section>=2:
    for beat in (1.5,2.5):event(3,start+beat,'hat',.13,.14+section*.035)
   if position==7:
    for k in range(8):event(3,start+2+k*.25,'snare' if k%2 else 'hat',.18,.22+k*.032)
   for beat in (0,1,2,3,3.5,3.75):
    note=root if beat<3 else bass_high
    event(2,start+beat,note,.79 if beat<3 else .22,
          (.45+section*.105)*(1.18 if beat==0 else .90))
   # The lead initially hints at a motif, then moves into an insistent full phrase.
   melody=STANDBY_LEAD[position]
   for idx,(note,beat,length) in enumerate(melody):
    if section==0 and idx>1:continue
    event(0,start+beat,note,length*.84,.35+section*.075)
   if section>=1:
    steps=(0,1.5,2.5,3.5) if section<3 else tuple(np.arange(0,4,.5))
    for idx,beat in enumerate(steps):
     pitch=tones[(idx+(bar//4)%3)%3]
     event(1,start+beat,pitch,.32 if section>=3 else .63,.22+section*.052)
   else:
    event(1,start,tones[0],3.7,.22)
   if section==4 and bar>=34:
    event(0,start+3.5,'C#6' if position==7 else 'A5',.35,.50)
  else:
   # 160 BPM, full four-voice downbeat immediately on entry.
   groove=[(0,'kick',.88),(.5,'hat',.18),(1,'snare',.54),(1.5,'hat',.22),
           (2,'kick',.72),(2.5,'hat',.20),(3,'snare',.58),(3.5,'hat',.23)]
   if section in (3,5,7):groove[5]=(2.5,'kick',.45)
   if position==7:groove[-1]=(3.5,'snare',.55)
   for beat,kind,strength in groove:event(3,start+beat,kind,.18 if kind!='hat' else .10,strength)
   if position==7:
    for i in range(4):event(3,start+3+i*.25,'snare' if i%2 else 'hat',.16,.31+i*.055)
   bass=[root,bass_high,root,bass_high,root,bass_high,root,bass_high]
   for i,note in enumerate(bass):
    if section==4 and i in (1,5):continue
    event(2,start+i*.5,note,.38 if i%2 else .47,.52+(section in (3,6,7))*.08)
   motif=BATTLE_ANSWER[position] if section in (2,3,6) else BATTLE_LEAD[position]
   for i,note in enumerate(motif):
    if section==4 and i in (1,3):continue
    if section==7 and i in (3,7) and midi(note)<84:note=midi(note)+12
    event(0,start+i*.5,note,.44 if i<7 else .43,.55 if section==4 else .65)
   # The second pulse plays alternating chord tones, answer stabs and high tension runs.
   for i in range(8):
    pitch=midi(tones[(i+section//2)%3])+(12 if (section>=3 and i%4==3) else 0)
    if section==4 and i%2==1:continue
    event(1,start+i*.5,pitch,.43 if i%2==0 else .31,.29 if section==4 else .38)
   if position==0 and section>0:
    event(1,start,midi(tones[0])+12,.96,.51)
 # Since each channel is monophonic, truncate any note at the next onset in its channel.
 samples=np.zeros((4,int(RATE*DURATION)),dtype=np.float32)
 beat_seconds=60/tempo
 random=np.random.default_rng(13245 if standby else 68461)
 for ch,notes in enumerate(EVENTS):
  notes=sorted(notes,key=lambda x:x[0]);last=-1
  for i,(beat,pitch,duration,amp,kind) in enumerate(notes):
   begin=int(round(beat*beat_seconds*RATE))
   if begin==last:continue
   next_at=int(round(notes[i+1][0]*beat_seconds*RATE)) if i+1<len(notes) else len(samples[ch])
   count=min(int(round(duration*beat_seconds*RATE)),next_at-begin,len(samples[ch])-begin)
   if count<=3:continue
   last=begin;t=np.arange(count,dtype=np.float32)/RATE
   if ch<=2:
    freq=440*2**((midi(pitch)-69)/12)
    if ch==2:
     # True triangle bass with mildly stepped amplitude, no sub-oscillator.
     phase=np.mod(t*freq,1)
     wave=(4*np.abs(phase-.5)-1)*.92
    else:
     duty=.25 if ch==0 else .125
     phase=np.mod(t*freq,1)
     wave=np.where(phase<duty,1.,-1.).astype(np.float32)
     # A brief duty sweep marks accents without adding a fifth voice.
     if ch==0 and count>RATE//10:
      sweep=np.minimum(count,int(.04*RATE))
      wave[:sweep]=np.where(phase[:sweep]<.125,1.,-1.)
    decay=np.exp(-t*(1.3 if standby else 1.7))
   else:
    white=random.choice(np.array([-1.,1.],dtype=np.float32),size=count)
    if kind=='kick':
     # Short low register noise thud with a raised attack.
     low=np.convolve(white,np.ones(43,dtype=np.float32)/43,mode='same')
     wave=low*3.4;decay=np.exp(-t*30)
    elif kind=='tom':
     low=np.convolve(white,np.ones(21,dtype=np.float32)/21,mode='same')
     wave=low*2.0;decay=np.exp(-t*33)
    elif kind=='snare':
     wave=white*.9;decay=np.exp(-t*20)
    else:
     wave=white*.55;decay=np.exp(-t*43)
   fade=min(count//2,max(1,int(RATE*.003)))
   envelope=decay.astype(np.float32) if hasattr(decay,'astype') else np.ones(count,dtype=np.float32)*decay
   envelope[:fade]*=np.linspace(0,1,fade,dtype=np.float32)
   envelope[-fade:]*=np.linspace(1,0,fade,dtype=np.float32)
   samples[ch,begin:begin+count]=wave*envelope*amp
 # Slight stereo separation of two pulse registers; still four simultaneous channels.
 output=np.empty((samples.shape[1],2),dtype=np.float32)
 output[:,0]=samples[0]*.42+samples[1]*.24+samples[2]*.31+samples[3]*.27
 output[:,1]=samples[0]*.30+samples[1]*.37+samples[2]*.31+samples[3]*.27
 output=np.tanh(output*1.32)
 output*=.86/max(.001,np.max(np.abs(output)))
 # Short fades suppress codec ringing and keep the first/last samples silent.
 fade=min(len(output)//2,int(RATE*.018))
 output[:fade]*=np.linspace(0,1,fade,dtype=np.float32)[:,None]
 output[-fade:]*=np.linspace(1,0,fade,dtype=np.float32)[:,None]
 return output,EVENTS

OUT.mkdir(parents=True,exist_ok=True)
for phase in ('standby','battle'):
 audio,events=compose(phase)
 for ext,codec in (('ogg','libvorbis'),('mp3','libmp3lame')):
  cmd=['ffmpeg','-y','-v','error','-f','f32le','-ar',str(RATE),'-ac','2','-i','pipe:0','-c:a',codec]
  cmd+=['-q:a','4'] if ext=='ogg' else ['-b:a','160k']
  subprocess.run(cmd+[str(OUT/f'{phase}-8bit-v1.{ext}')],input=audio.astype('<f4').tobytes(),check=True)
 print(phase,'96.00 seconds, four channels,',sum(map(len,events)),'notes/hits',
       'RMS',round(float(np.sqrt(np.mean(audio*audio))),3))
