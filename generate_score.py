"""Render an original, loopable, synthesized orchestral game score.

No third-party samples or existing melody are used.
"""
import math
import subprocess
from pathlib import Path

import numpy as np

RATE = 24000
BPM = 100
BEAT = 60 / BPM
BARS = 16
SECONDS = BARS * 4 * BEAT
audio = np.zeros((int(SECONDS * RATE), 2), dtype=np.float32)
rng = np.random.default_rng(42621)


def note(beat, length, midi, voice, gain, pan=0):
    start = int(beat * BEAT * RATE)
    count = min(int((length * BEAT + .27) * RATE), len(audio) - start)
    if count < 1:
        return
    t = np.arange(count, dtype=np.float32) / RATE
    freq = 440 * 2 ** ((midi - 69) / 12)
    attack = {'string': .13, 'bass': .085, 'horn': .10, 'harp': .004}[voice]
    release = {'string': .19, 'bass': .17, 'horn': .22, 'harp': .28}[voice]
    sustain = length * BEAT
    env = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (sustain + release - t) / release))
    if voice == 'harp':
        env *= np.exp(-t * 2.25)
        partials = [(1, 1), (2, .36), (3, .19), (4, .08)]
    elif voice == 'horn':
        partials = [(1, .74), (2, .45), (3, .31), (4, .19), (5, .08), (6, .05)]
    elif voice == 'bass':
        partials = [(1, .8), (2, .43), (3, .23), (4, .17), (5, .1)]
    else:
        partials = [(j, 1 / (j ** 1.25)) for j in range(1, 11)]
    vibrato = .0020 * np.sin(2 * np.pi * 5.1 * t) if voice != 'harp' else 0
    phase = 2 * np.pi * freq * (t + vibrato * t)
    signal = np.zeros(count, dtype=np.float32)
    for harmonic, weight in partials:
        signal += weight * np.sin(phase * harmonic + harmonic * .18)
    signal *= env * gain / sum(weight for _, weight in partials)
    if voice in ('string', 'bass'):
        signal += .13 * gain * env * np.sin(phase * .995)
    left = math.sqrt((1 - pan) / 2)
    right = math.sqrt((1 + pan) / 2)
    audio[start:start + count, 0] += signal * left
    audio[start:start + count, 1] += signal * right


def drum(beat, kind='timpani', gain=.12):
    start = int(beat * BEAT * RATE)
    count = min(int((.9 if kind == 'timpani' else .48) * RATE), len(audio) - start)
    if count < 1:
        return
    t = np.arange(count, dtype=np.float32) / RATE
    noise = rng.standard_normal(count).astype(np.float32)
    if kind == 'timpani':
        pitch = 54 + 40 * np.exp(-t * 18)
        signal = np.sin(2 * np.pi * (54 * t + (40 / 18) * (1 - np.exp(-t * 18)))) * np.exp(-t * 5)
        signal += .13 * noise * np.exp(-t * 12)
    elif kind == 'snare':
        signal = (noise * .65 + np.sin(2 * np.pi * 175 * t) * .35) * np.exp(-t * 22)
    else:
        signal = (noise - np.convolve(noise, np.ones(33) / 33, mode='same')) * np.exp(-t * 7) * .2
    audio[start:start + count, 0] += signal * gain
    audio[start:start + count, 1] += signal * gain * .88


# An original 16-bar progression: D minor, B-flat, F, C, then a tonic return.
roots = [50, 46, 41, 48, 50, 46, 41, 48, 50, 46, 41, 48, 50, 46, 48, 50]
chord_intervals = [0, 3, 7]
motifs = [
    [(0, 69), (1, 72), (1.5, 74), (2, 76), (3, 74)],
    [(0, 77), (1, 74), (2, 72), (3, 69)],
    [(0, 72), (.75, 74), (1.5, 77), (2.5, 76), (3, 74)],
    [(0, 72), (1, 69), (2, 67), (3, 69)],
]
for bar, root in enumerate(roots):
    at = bar * 4
    for octave, volume in [(0, .105), (12, .071)]:
        for interval in chord_intervals:
            note(at, 3.95, root + interval + octave, 'string', volume, pan=-.38 if octave else .28)
    note(at, 3.8, root - 12, 'bass', .18, -.2)
    for beat in [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]:
        degree = chord_intervals[int(beat * 2 + bar) % 3]
        note(at + beat, .40, root + 24 + degree, 'harp', .095, .48)
    melody = motifs[bar % 4]
    for i, (offset, pitch) in enumerate(melody):
        end = melody[i + 1][0] if i + 1 < len(melody) else 4
        transposition = -2 if bar in (4, 5, 12) else 0
        note(at + offset, end - offset - .08, pitch + transposition, 'horn', .22 if bar >= 8 else .16, -.14)
    drum(at, gain=.14 if bar in (0, 4, 8, 12) else .08)
    if bar >= 4:
        drum(at + 2, 'snare', .09 if bar < 8 else .14)
    if bar in (0, 4, 8, 12):
        drum(at, 'cymbal', .22)

# Original short hall reflections; keep the ambience behind the controls.
dry = audio.copy()
for delay, decay, swap in [(.14, .18, False), (.31, .14, True), (.49, .095, False)]:
    offset = int(delay * RATE)
    audio[offset:] += dry[:-offset, ::-1 if swap else 1] * decay
audio = np.tanh(audio * 1.35) * .82
fade = min(int(.12 * RATE), len(audio) // 2)
audio[:fade] *= np.linspace(0, 1, fade)[:, None]
audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
pcm = (audio * 32767).astype('<i2').tobytes()
out = Path(__file__).parent / 'dist/assets/audio'
out.mkdir(parents=True, exist_ok=True)
for filename, codec in [('orchestral-duel.ogg', ['-c:a', 'libvorbis', '-q:a', '5']),
                        ('orchestral-duel.mp3', ['-c:a', 'libmp3lame', '-q:a', '3'])]:
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le',
                    '-ar', str(RATE), '-ac', '2', '-i', '-', *codec, str(out / filename)],
                   input=pcm, check=True)
print('Rendered', round(SECONDS, 2), 'seconds:', *(str(p) for p in out.iterdir()))
