# The shared film engine for the Qutai promo series (video/README.md): an episode file defines EP (its words,
# takes, cuts, the short cut and the voice-over) and calls film.main(EP). Episode 1 keeps its own edit_01.py.
# Only cuts, speed (marked), a short freeze frame and film graphics on top: the app's screen itself is never changed.
# Needs ffmpeg (libx264, libvpx-vp9, libopus) and Pillow.
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'out')
TMP = os.path.join(OUT, 'tmp')
SRC_W, SRC_H = 1206, 2622  # simulator recording (iPhone 17 Pro)

PARCH, INK, TEAL, TEAL_INK, GOLD = '#f2e7cf', '#2a2118', '#2287a5', '#186579', '#b8923e'
SERIF = '/System/Library/Fonts/Supplemental/Georgia.ttf'
SERIF_B = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
SANS = ('/System/Library/Fonts/Avenir Next.ttc', 2)      # Demi Bold
SANS_R = ('/System/Library/Fonts/Avenir Next.ttc', 5)    # Medium
EP = {}

def font(spec, size):
    return ImageFont.truetype(spec[0], size, index=spec[1]) if isinstance(spec, tuple) else ImageFont.truetype(spec, size)

# Words every episode shares (an episode's own words are merged over these).
COMMON = {
 'en': dict(fast='Sped up', next='Later',
            close1="Qutai: the AI assistant in your phone's browser.", close2='Open source · Coming to the App Store and Google Play',
            note1='', note2='Real screen recording; sped-up parts are marked.', note3=''),
}

# ---------------------------------------------------------------- layouts
def layout(kind):
    if kind == 'h':
        W, H = 1920, 1080
        ph = 960; s = ph / SRC_H; pw = round(SRC_W * s)
        return dict(W=W, H=H, s=s, pw=pw, ph=ph, x0=330, y0=60, k=0.62)
    W, H = 1080, 1920
    ph = 1540; s = ph / SRC_H; pw = round(SRC_W * s)
    return dict(W=W, H=H, s=s, pw=pw, ph=ph, x0=(W - pw) // 2, y0=150, k=1.0)

def mapr(L, r):
    x1, y1, x2, y2 = r; mx, my = L.get('mx', L['x0']), L.get('my', L['y0'])
    return (mx + x1 * L['s'], my + y1 * L['s'], mx + x2 * L['s'], my + y2 * L['s'])

def zoom_layout(L, z):
    # a magnified part of the screen (crop and scale only) in a framed box where the phone would be
    x1, y1, x2, y2 = z
    if L['W'] < L['H']: bw = 1000; cx, cy = L['W'] / 2, 150 + 1540 / 2
    else: bw = 640; cx, cy = L['x0'] + L['pw'] / 2, L['H'] / 2
    s = bw / (x2 - x1); bh = round((y2 - y1) * s); bw = round(bw)
    bx, by = round(cx - bw / 2), round(cy - bh / 2)
    return dict(L, s=s, x0=bx, y0=by, pw=bw, ph=bh, mx=bx - x1 * s, my=by - y1 * s, r=34 * L['k'])

def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= width or not cur: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def draw_icon(d, kind, x, y, sz, color, w):
    if kind == 'check':
        d.line([(x + sz * .12, y + sz * .52), (x + sz * .4, y + sz * .8), (x + sz * .9, y + sz * .2)], fill=color, width=w, joint='curve')
    else:  # a small chest: lid line and a lock
        d.rounded_rectangle([x + sz * .05, y + sz * .25, x + sz * .95, y + sz * .9], radius=sz * .12, outline=color, width=w)
        d.line([(x + sz * .05, y + sz * .5), (x + sz * .95, y + sz * .5)], fill=color, width=w)
        d.rectangle([x + sz * .42, y + sz * .42, x + sz * .58, y + sz * .62], fill=color)

def badge(d, L, label, icon, rect, above=False):
    # above: True (over the rect), False (under it), 'right' (beside it, for short lines with room on their right) or
    # 'outside' (on the parchment just above a magnified box, right-aligned, when nothing inside has room)
    k = L['k']; f = font(SANS, round(36 * k)); pad = 22 * k; isz = 36 * k
    tw = d.textlength(label, font=f); bw = tw + isz + pad * 2.6; bh = 70 * k
    x1, y1, x2, y2 = mapr(L, rect)
    if above == 'outside':
        bx = L['x0'] + L['pw'] - bw; by = L['y0'] - bh - 22 * k
    elif above == 'right':
        bx = min(x2 + 18 * k, L['W'] - bw - 8); by = (y1 + y2) / 2 - bh / 2
    else:
        bx = min(x2 - bw, L['x0'] + L['pw'] - bw - 8); by = y1 - bh - 18 * k if above else y2 + 18 * k  # clear of what it marks
        if by + bh > L['y0'] + L['ph'] - 20 * k and 'mx' not in L: by = y1 - bh - 18 * k  # a zoom box has room under it
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh / 2, fill=TEAL)
    draw_icon(d, icon, bx + pad, by + (bh - isz) / 2, isz, 'white', max(3, round(5 * k)))
    d.text((bx + pad * 1.6 + isz, by + bh / 2), label, font=f, fill='white', anchor='lm')

def phone_overlay(L, seg, lang, path, with_rects=True, with_badge=True):
    im = Image.new('RGBA', (L['W'], L['H']), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x0, y0, pw, ph, k = L['x0'], L['y0'], L['pw'], L['ph'], L['k']
    # the bezel: covers the recording's square corners, a thin gold line outside
    r_in, bz = L.get('r', 62 * k), 16 * k
    mask = Image.new('L', im.size, 0); md = ImageDraw.Draw(mask)
    md.rounded_rectangle([x0 - bz, y0 - bz, x0 + pw + bz, y0 + ph + bz], radius=r_in + bz, fill=255)
    md.rounded_rectangle([x0, y0, x0 + pw, y0 + ph], radius=r_in, fill=0)
    im.paste(Image.new('RGBA', im.size, '#1d1b19'), (0, 0), mask)
    d.rounded_rectangle([x0 - bz - 7 * k, y0 - bz - 7 * k, x0 + pw + bz + 7 * k, y0 + ph + bz + 7 * k],
                        radius=r_in + bz + 7 * k, outline=GOLD, width=max(2, round(3 * k)))
    W = EP['words'][lang]
    if L['W'] < L['H']:  # 9:16: series name on top, caption under the phone
        d.text((L['W'] / 2, 78), W['series'], font=font(SERIF, 40), fill=TEAL_INK, anchor='mm')
        if seg.get('cap'):
            f = font(SANS, 50); lines = wrap(d, W['cap'][seg['cap']], f, 960)
            top = 1810 - (len(lines) - 1) * 33
            for i, ln in enumerate(lines):
                d.text((L['W'] / 2, top + i * 66), ln, font=f, fill=INK, anchor='mm')
        if seg.get('speed'):
            f = font(SANS_R, 27); t = f"{W['fast']} ×{seg['speed']:g}"; tw = d.textlength(t, font=f)
            d.rounded_rectangle([L['W'] - 44 - tw - 36, 86, L['W'] - 44, 128], radius=21, fill=INK)
            d.text((L['W'] - 44 - 18 - tw, 107), t, font=f, fill=PARCH, anchor='lm')
    else:  # 16:9: series and caption in the right column
        cx = 1020
        d.text((cx, 330), W['series'], font=font(SERIF, 40), fill=TEAL_INK, anchor='lm')
        d.line([(cx, 372), (cx + 120, 372)], fill=GOLD, width=3)
        if seg.get('cap'):
            f = font(SERIF_B, 72); lines = wrap(d, W['cap'][seg['cap']], f, 800)
            for i, ln in enumerate(lines):
                d.text((cx, 470 + i * 92), ln, font=f, fill=INK, anchor='lm')
        if seg.get('speed'):
            f = font(SANS_R, 30); t = f"{W['fast']} ×{seg['speed']:g}"; tw = d.textlength(t, font=f)
            d.rounded_rectangle([cx, 820, cx + tw + 36, 872], radius=26, fill=INK)
            d.text((cx + 18, 846), t, font=f, fill=PARCH, anchor='lm')
    if with_rects:
        for r in seg.get('rects', []):
            x1, y1, x2, y2 = mapr(L, r); g = 8 * k
            d.rounded_rectangle([x1 - g, y1 - g, x2 + g, y2 + g], radius=18 * k, outline=TEAL, width=max(4, round(7 * k)))
    if with_badge and seg.get('badge'):
        key, icon, rect = seg['badge']; badge(d, L, W[key], icon, rect, seg.get('badge_above', False))
    im.save(path)

def parchment(L, path):
    im = Image.new('RGB', (L['W'], L['H']), PARCH)
    # a faint vignette so the page isn't flat
    v = Image.new('L', im.size, 0); vd = ImageDraw.Draw(v)
    vd.ellipse([-L['W'] * .3, -L['H'] * .2, L['W'] * 1.3, L['H'] * 1.2], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(L['W'] / 8))
    im = Image.composite(im, Image.new('RGB', im.size, '#e6d6b5'), v)
    im.save(path)

def card_overlay(L, kind, lang, path):
    W = EP['words'][lang]; im = Image.new('RGBA', (L['W'], L['H']), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    vert = L['W'] < L['H']
    if kind == 'open':
        # parchment fade at the bottom, the title on it
        g = Image.new('L', (1, L['H']), 0)
        for y in range(L['H']):
            t = max(0, (y - L['H'] * .55) / (L['H'] * .3)); g.putpixel((0, y), int(255 * min(1, t)))
        im.paste(Image.new('RGBA', im.size, PARCH), (0, 0), g.resize(im.size))
        size = 110 if vert else 96
        while d.textlength(W['title'], font=font(SERIF_B, size)) > L['W'] - 140: size -= 4
        f = font(SERIF_B, size)
        d.text((L['W'] / 2, L['H'] * (.86 if vert else .84)), W['title'], font=f, fill=INK, anchor='mm')
        d.line([(L['W'] / 2 - 70, L['H'] * (.86 if vert else .84) + 80), (L['W'] / 2 + 70, L['H'] * (.86 if vert else .84) + 80)], fill=GOLD, width=4)
    elif kind == 'next':
        f = font(SERIF, 88 if vert else 80)
        d.text((L['W'] / 2, L['H'] / 2), W['next'], font=f, fill=INK, anchor='mm')
        d.line([(L['W'] / 2 - 60, L['H'] / 2 + 80), (L['W'] / 2 + 60, L['H'] / 2 + 80)], fill=GOLD, width=4)
    else:  # close
        logo = Image.open(os.path.join(ROOT, 'assets', 'logo.png')).convert('RGBA')
        ls = 300 if vert else 240; logo = logo.resize((ls, ls), Image.LANCZOS)
        cy = L['H'] * (.36 if vert else .32)
        im.alpha_composite(logo, (int(L['W'] / 2 - ls / 2), int(cy - ls / 2)))
        f1 = font(SERIF_B, 64 if vert else 66); f2 = font(SANS_R, 36 if vert else 34); f3 = font(SANS_R, 27 if vert else 24)
        y = cy + ls / 2 + 90
        for ln in wrap(d, W['close1'], f1, L['W'] - 140):
            d.text((L['W'] / 2, y), ln, font=f1, fill=INK, anchor='mm'); y += 82
        d.line([(L['W'] / 2 - 60, y), (L['W'] / 2 + 60, y)], fill=GOLD, width=4); y += 60
        for ln in wrap(d, W['close2'], f2, L['W'] - 160):
            d.text((L['W'] / 2, y), ln, font=f2, fill=TEAL_INK, anchor='mm'); y += 52
        yb = L['H'] - (190 if vert else 120)
        for j, key in enumerate(('note1', 'note2', 'note3')):
            d.text((L['W'] / 2, yb + j * 40), W[key], font=f3, fill='#5a4c3a', anchor='mm')
    im.save(path)

# ---------------------------------------------------------------- rendering
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(' '.join(cmd)); print(r.stderr[-3000:]); sys.exit(1)

def seg_dur(seg):
    if 'card' in seg: return seg['dur']
    return (seg['b'] - seg['a']) / seg.get('speed', 1) + seg.get('freeze', 0)

def render_segment(L, seg, lang, i, tag):
    out = os.path.join(TMP, f'{tag}-{i:02d}.mp4'); dur = seg_dur(seg); bg = os.path.join(TMP, f'bg-{tag}.png')
    enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-an']
    if 'card' in seg:
        ov = os.path.join(TMP, f'{tag}-{i:02d}-card.png'); card_overlay(L, seg['card'], lang, ov)
        fade = f"fade=t=in:st=0:d=0.25,fade=t=out:st={dur - 0.25:.3f}:d=0.25" if seg['card'] != 'close' else "fade=t=in:st=0:d=0.3"
        if seg['card'] == 'open':
            art = os.path.join(ROOT, 'webpage', 'src', 'art', EP['art'])
            # the largest piece of the painting with the film's shape, centred (any painting size works)
            ar = L['W'] / L['H']
            crop = f"crop='min(iw,ih*{ar:.4f})':'min(ih,iw/{ar:.4f})'"
            frames = round(dur * 30)
            vf = (f"[1:v]{crop},scale={L['W'] * 2}:{L['H'] * 2},"
                  f"zoompan=z='1+0.06*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={L['W']}x{L['H']}:fps=30[a];"
                  f"[a][2:v]overlay=0:0,{fade}[v]")
            run(['ffmpeg', '-y', '-v', 'error', '-loop', '1', '-t', f'{dur}', '-i', bg, '-loop', '1', '-framerate', '30', '-t', f'{dur}', '-i', art,
                 '-loop', '1', '-t', f'{dur}', '-i', ov, '-filter_complex', vf, '-map', '[v]', '-t', f'{dur}', *enc, out])
        else:
            vf = f"[0:v][1:v]overlay=0:0,{fade}[v]"
            run(['ffmpeg', '-y', '-v', 'error', '-loop', '1', '-t', f'{dur}', '-i', bg, '-loop', '1', '-t', f'{dur}', '-i', ov,
                 '-filter_complex', vf, '-map', '[v]', '-t', f'{dur}', *enc, out])
        return out
    src = os.path.join(HERE, EP['takes'][lang][seg['src']])
    sp = seg.get('speed', 1); crop = ''
    if seg.get('zoom'):
        z = seg['zoom']; L = zoom_layout(L, z); crop = f"crop={z[2] - z[0]}:{z[3] - z[1]}:{z[0]}:{z[1]},"
    v = f"[1:v]fps=30,trim=start={seg['a']}:end={seg['b']},setpts=(PTS-STARTPTS)/{sp},fps=30,{crop}scale={L['pw']}:{L['ph']}"
    if seg.get('freeze'): v += f",tpad=stop_mode=clone:stop_duration={seg['freeze']}"
    v += "[p];[0:v][p]overlay=" + f"{L['x0']}:{L['y0']}[b]"
    late = seg.get('late')
    if late is not None:  # frame and badge appear only once that line is on screen
        ov0 = os.path.join(TMP, f'{tag}-{i:02d}-a.png'); ov1 = os.path.join(TMP, f'{tag}-{i:02d}-b.png')
        phone_overlay(L, seg, lang, ov0, with_rects=False, with_badge=False); phone_overlay(L, seg, lang, ov1)
        v += f";[b][2:v]overlay=0:0:enable='lt(t,{late})'[c];[c][3:v]overlay=0:0:enable='gte(t,{late})'[v]"
        ins = ['-loop', '1', '-t', f'{dur}', '-i', ov0, '-loop', '1', '-t', f'{dur}', '-i', ov1]
    else:
        ov = os.path.join(TMP, f'{tag}-{i:02d}.png'); phone_overlay(L, seg, lang, ov)
        v += ";[b][2:v]overlay=0:0[v]"; ins = ['-loop', '1', '-t', f'{dur}', '-i', ov]
    run(['ffmpeg', '-y', '-v', 'error', '-loop', '1', '-t', f'{dur}', '-i', bg, '-i', src, *ins,
         '-filter_complex', v, '-map', '[v]', '-t', f'{dur:.3f}', *enc, out])
    return out

def audio(lang, starts, total, vo, path):
    a = os.path.join(HERE, 'audio', EP['audio'])
    music = os.path.join(HERE, 'audio', '01', 'music.mp3')
    ins = ['-stream_loop', '-1', '-i', music]; parts = []
    for j, (name, c0, c1, at) in enumerate(vo):
        ins += ['-i', os.path.join(a, f'{name}.mp3')]
        trim = f"atrim=start={c0}" + (f":end={c1}" if c1 else '')
        parts.append(f"[{j + 1}:a]{trim},asetpts=PTS-STARTPTS,adelay={int(at * 1000)}:all=1[v{j}]")
    n = len(vo)
    fc = ';'.join(parts) + ';' + ''.join(f'[v{j}]' for j in range(n)) + \
         f"amix=inputs={n}:normalize=0:duration=longest,apad,atrim=end={total},asplit=2[vo][sc];" + \
         f"[0:a]atrim=end={total},apad,atrim=end={total},volume=0.5,afade=t=out:st={total - 1.6}:d=1.6[m];" + \
         "[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[md];" + \
         "[md][vo]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]"
    run(['ffmpeg', '-y', '-v', 'error', *ins, '-filter_complex', fc, '-map', '[a]', '-c:a', 'pcm_s16le', path])

def vtt(lang, segs, starts, path):
    def ts(t): return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{t % 60:06.3f}"
    cues, cur = [], None
    for seg, st in zip(segs, starts):
        c = seg.get('cap'); end = st + seg_dur(seg)
        if c and cur and cur[0] == c: cur[2] = end
        elif c: cur = [c, st, end]; cues.append(cur)
        else: cur = None
    with open(path, 'w') as f:
        f.write('WEBVTT\n\n')
        for c, a, b in cues: f.write(f"{ts(a)} --> {ts(b)}\n{EP['words'][lang]['cap'][c]}\n\n")

def build(lang, kind):
    os.makedirs(TMP, exist_ok=True)
    short = kind == 'short'; L = layout('v' if short else kind)
    segs = EP['short'][lang] if short else EP['cuts'][lang]
    tag = f"{lang}-{kind}"; parchment(L, os.path.join(TMP, f'bg-{tag}.png'))
    starts, t = [], 0.0
    for s in segs: starts.append(t); t += seg_dur(s)
    total = t
    files = [render_segment(L, s, lang, i, tag) for i, s in enumerate(segs)]
    lst = os.path.join(TMP, f'{tag}.txt')
    with open(lst, 'w') as f: f.writelines(f"file '{p}'\n" for p in files)
    silent = os.path.join(TMP, f'{tag}-silent.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', silent])
    wav = os.path.join(TMP, f'{tag}.wav')
    audio(lang, starts, total, (EP['vo_short'] if short else EP['vo'])[lang](starts), wav)
    base = f"{EP['name']}-{lang}"; name = {'v': base, 'h': f'{base}-16x9', 'short': f'{base}-15s'}[kind]
    mp4 = os.path.join(OUT, name + '.mp4'); webm = os.path.join(OUT, name + '.webm')
    # sized for the site (~6 MB at most): the screen is mostly flat colour, so this rate stays sharp
    run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-i', wav, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
         '-maxrate', '1300k', '-bufsize', '2600k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
         '-c:a', 'aac', '-b:a', '128k', '-shortest', mp4])
    run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-i', wav, '-c:v', 'libvpx-vp9', '-b:v', '1000k', '-row-mt', '1',
         '-deadline', 'good', '-cpu-used', '2', '-c:a', 'libopus', '-b:a', '96k', '-shortest', webm])
    vtt(lang, segs, starts, os.path.join(OUT, name + '.vtt'))
    if kind == 'v':  # cover: the remembering moment, with its frame and badge
        i = next(j for j, s in enumerate(segs) if s.get('cap') == EP['cover_cap'])
        run(['ffmpeg', '-y', '-v', 'error', '-i', mp4, '-ss', f'{starts[i] + seg_dur(segs[i]) - 0.3:.2f}', '-frames:v', '1',
             '-q:v', '3', os.path.join(OUT, f'{base}-cover.jpg')])
    mb = os.path.getsize(mp4) / 1e6
    print(f"{name}: {total:.1f} s, mp4 {mb:.1f} MB, webm {os.path.getsize(webm) / 1e6:.1f} MB")
    return starts


def words(ep_words):
    out = {}
    for lang, w in ep_words.items():
        m = dict(COMMON.get(lang, {})); m.update(w); out[lang] = m
    return out

def main(ep):
    EP.clear(); EP.update(ep); EP['words'] = words(ep['words'])
    args = sys.argv[1:]
    langs = [a for a in args if a in EP['cuts']] or list(EP['cuts'])
    kinds = [a for a in args if a in ('v', 'h', 'short')] or ['v', 'h', 'short']
    for lang in langs:
        for kind in kinds:
            if kind == 'short' and lang not in EP.get('short', {}): continue
            build(lang, kind)
