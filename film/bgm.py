# 動画用の BGM を作る（サイトの BGM と同じ都節・箏の撥弦＋低い持続音＋ときどき尺八風の息の音）。
# Blender 同梱の python（numpy あり）で動かす：python3.11 film/bgm.py 出力.wav 秒数 種
import sys, wave, numpy as np

out, dur, seed = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])
rng = np.random.default_rng(seed)
SR = 44100
N = int(SR * (dur + 3))
mix = np.zeros((N, 2))
BASE = 146.83
IN = [0, 1, 5, 7, 8]
deg = lambda i: BASE * 2 ** ((12 * (i // 5) + IN[i % 5]) / 12)


def pan(sig, p):
    return np.stack([sig * np.cos((p + 1) * np.pi / 4), sig * np.sin((p + 1) * np.pi / 4)], 1)


def koto(f, t, vel):
    # Karplus-Strong：弦をはじいた音
    n = int(SR * 3.2)
    period = int(SR / f)
    buf = rng.uniform(-1, 1, period) * vel
    y = np.zeros(n)
    y[:period] = buf
    for i in range(period, n):
        y[i] = 0.996 * 0.5 * (y[i - period] + y[i - period + 1 if i - period + 1 < i else i - period])
    env = np.exp(-np.arange(n) / (SR * 1.4))
    y *= env
    s = int(t * SR)
    if s + n > N:
        n = N - s; y = y[:n]
    mix[s:s + n] += pan(y, rng.uniform(-0.5, 0.5))


def breath(f, t, d, vel):
    # 尺八風：ゆっくり立ち上がる正弦＋息のノイズ
    n = int(SR * d)
    tt = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5 * tt) * np.clip(tt / d * 2, 0, 1)
    tone = np.sin(2 * np.pi * f * np.cumsum(vib) / SR) + 0.25 * np.sin(4 * np.pi * f * np.cumsum(vib) / SR)
    noise = rng.normal(0, 1, n)
    noise = np.convolve(noise, np.ones(30) / 30, "same")
    env = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.6
    y = (tone * 0.8 + noise * 0.35) * env * vel
    s = int(t * SR)
    if s + n > N:
        n = N - s; y = y[:n]
    mix[s:s + n] += pan(y, 0.2)


# 低い持続音（D と A）
tt = np.arange(N) / SR
drone = (np.sin(2 * np.pi * 73.42 * tt) + 0.5 * np.sin(2 * np.pi * 110 * tt)) * 0.035 * (1 + 0.3 * np.sin(2 * np.pi * 0.05 * tt))
mix += pan(drone, 0)

t = 1.0
while t < dur - 2:
    # ひとまとまりのフレーズ：3〜6音、間をたっぷり
    i = int(rng.integers(5, 11))
    for k in range(int(rng.integers(3, 7))):
        koto(deg(i), t, 0.32 if k else 0.4)
        if rng.random() < 0.2:
            koto(deg(max(0, i - 5)), t + 0.02, 0.2)
        t += float(rng.choice([0.45, 0.6, 0.9, 1.2]))
        i = max(3, min(13, i + int(rng.choice([-2, -1, -1, 1, 2]))))
    if rng.random() < 0.35:
        breath(deg(int(rng.choice([10, 12, 13]))), t + 0.5, float(rng.uniform(3, 5)), 0.09)
    t += float(rng.uniform(2.5, 4.5))

# 簡単な残響（遅延を重ねる）
rev = mix.copy()
for d, g in ((0.031, 0.35), (0.053, 0.3), (0.089, 0.25), (0.137, 0.2), (0.211, 0.15)):
    k = int(d * SR)
    rev[k:] += mix[:-k] * g
mix = rev[: int(SR * dur)]
fade = int(SR * 3)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix[: int(SR * 1.5)] *= np.linspace(0, 1, int(SR * 1.5))[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 0.7
pcm = (mix * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("bgm", out, dur)
