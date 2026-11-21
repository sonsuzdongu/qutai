# Voice-over for one episode with ElevenLabs (voice "Ayça D.", multilingual v2): the lines come from the episode file
# (EP['lines'][lang], a list of (id, text)) and go to audio/<EP['audio']>/<lang>-<id>.mp3. Like make_voice_01.py, each
# language is ONE request with pauses between the lines, cut at those pauses, so every line has the same voice.
# Usage: ELEVENLABS_API_KEY=… python3 make_voice.py ep02_apps [en]
import importlib, json, os, re, subprocess, sys

KEY = os.environ['ELEVENLABS_API_KEY']; VOICE = '5RqXmIU9ikjifeWoXHMG'; GAP = 2.5
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ep = importlib.import_module(sys.argv[1]).EP
def spoken(text): return text.replace('Qutai:', 'Kutay,').replace('Qutai', 'Kutay')
def run(*cmd): return subprocess.run(cmd, capture_output=True, text=True)
d = os.path.join(HERE, 'audio', ep['audio']); os.makedirs(d, exist_ok=True); os.chdir(d)
for lang in [a for a in sys.argv[2:] if a in ep['lines']] or list(ep['lines']):
    lines = ep['lines'][lang]
    text = f' <break time="{GAP}s" /> '.join(spoken(t) for _, t in lines)
    body = {'text': text, 'model_id': 'eleven_multilingual_v2', 'language_code': lang, 'seed': 7,
            'voice_settings': {'stability': 0.7, 'similarity_boost': 0.85, 'style': 0.1, 'use_speaker_boost': True}}
    whole = f'{lang}-all.mp3'
    code = subprocess.check_output(['curl', '-s', '-o', whole, '-w', '%{http_code}', '-X', 'POST',
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
        '-H', f'xi-api-key: {KEY}', '-H', 'Content-Type: application/json', '-d', json.dumps(body)]).decode()
    if code != '200': sys.exit(f'{lang}: HTTP {code} {open(whole, "rb").read()[:300]}')
    log = run('ffmpeg', '-i', whole, '-af', 'silencedetect=n=-42dB:d=1.6', '-f', 'null', '-').stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    dur = float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', whole).stdout)
    pieces = [(a, b) for a, b in zip([0.0] + ends, starts + [dur]) if b - a > 0.3]
    if len(pieces) != len(lines): sys.exit(f'{lang}: found {len(pieces)} pieces for {len(lines)} lines; check {whole}')
    for (n, t), (a, b) in zip(lines, pieces):
        a = max(0, a - 0.06); b = min(dur, b + 0.12)
        run('ffmpeg', '-y', '-v', 'error', '-i', whole, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-c:a', 'libmp3lame', '-b:a', '128k', f'{lang}-{n}.mp3')
        print(f'{lang}-{n} {b - a:5.2f}s  {t}')
