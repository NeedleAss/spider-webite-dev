#!/usr/bin/env python3
"""Original restrained ambient score. Mathematical oscillators only, no samples."""
import numpy as np,wave
from pathlib import Path
RATE=48000;DURATION=112
track=np.zeros((RATE*DURATION,2),dtype=np.float32)
def tone(start,duration,note,gain,pan=0,soft=True):
 n=int(duration*RATE);t=np.arange(n,dtype=np.float32)/RATE;f=440*2**((note-69)/12)
 env=np.minimum(1,t/(1.8 if soft else .025))*np.minimum(1,(duration-t)/(2.5 if soft else .45))
 if not soft:env*=np.exp(-t*1.7)
 sound=(np.sin(2*np.pi*f*t)+.18*np.sin(2*np.pi*f*2*t)+.06*np.sin(2*np.pi*f*3*t))*env*gain
 at=int(start*RATE);length=min(n,len(track)-at)
 track[at:at+length,0]+=sound[:length]*np.sqrt((1-pan)/2);track[at:at+length,1]+=sound[:length]*np.sqrt((1+pan)/2)
# Open voicings; deliberately leave space for the presenter.
chords=[[48,55,62,67],[45,52,60,64],[41,48,55,60],[43,50,57,62]]
for i,start in enumerate(range(0,108,12)):
 for j,note in enumerate(chords[i%4]):tone(start,16,note,.020,(-.6+j*.4))
for start in np.arange(38,55,.75):tone(float(start),1.5,[72,79,74,67][int((start-38)/.75)%4],.014,pan=.25,soft=False)
for start,note in [(6,79),(18,74),(28,72),(38,79),(56,84),(64,79),(70,76),(77,67),(83,79),(89,84),(96,76),(106,72)]:tone(start,3.5,note,.022,pan=-.2,soft=False)
fade=np.minimum(1,np.arange(len(track))/RATE/3)*np.minimum(1,(len(track)-np.arange(len(track)))/RATE/5)
track*=fade[:,None];peak=float(np.max(np.abs(track)));track*=.23/max(peak,.001)
out=Path(__file__).resolve().parents[1]/'build/v7-production/score.wav';out.parent.mkdir(exist_ok=True)
with wave.open(str(out),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes((track*32767).astype('<i2').tobytes())
print(out,peak)
