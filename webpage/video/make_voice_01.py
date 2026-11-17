# Voice-over for episode 1 with ElevenLabs (voice "Ayça D.", multilingual v2), into audio/01/<lang>-<line>.mp3.
# Each language is ONE request with the lines separated by pauses, then cut at those pauses: lines made in separate
# requests came out sounding like slightly different speakers.
# Usage: ELEVENLABS_API_KEY=… python3 make_voice_01.py [tr] [en]   (no arguments: both)
import json, os, re, subprocess, sys

KEY = os.environ['ELEVENLABS_API_KEY']; VOICE = '5RqXmIU9ikjifeWoXHMG'
LINES = {
 'tr': [('1', 'Bir kez söyleyin, yeter. Qutai hatırlar.'),
        ('2', 'Telefonunuzda saklanır; görebilir, silebilirsiniz.'),
        ('3a', 'Ertesi akşam yemek isteyin.'),
        ('3b', 'Söylemenize gerek yok: glutensiz seçer.'),
        ('4a', 'Bilgileriniz sorulmadan girilmez.'),
        ('4b', 'Ödemeyi siz yaparsınız.'),
        ('5', 'Qutai: telefonunuzun tarayıcısında çalışan yapay zekâ asistanınız.')],
 'en': [('1', 'Tell Qutai once. It remembers.'),
        ('2', 'It stays on your phone, where you can see it and delete it.'),
        ('3a', 'The next evening, ask for dinner.'),
        ('3b', 'No need to say it again: it picks gluten-free.'),
        ('4a', 'Your details go in only when you say so.'),
        ('4b', 'You make the payment.'),
        ('5', "Qutai: the AI assistant in your phone's browser.")],
}
GAP = 2.5  # seconds of pause between lines in the request; a line's own pauses stay well under the cut threshold

# The brand is written "Qutai" but said "Kutay" (the owner's choice); only the text sent for speech changes.
def spoken(text): return text.replace('Qutai:', 'Kutay,').replace('Qutai', 'Kutay')

def run(*cmd): return subprocess.run(cmd, capture_output=True, text=True)

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio', '01'))
for lang in [a for a in sys.argv[1:] if a in LINES] or list(LINES):
    lines = LINES[lang]
    text = f' <break time="{GAP}s" /> '.join(spoken(t) for _, t in lines)
    body = {'text': text, 'model_id': 'eleven_multilingual_v2', 'language_code': lang, 'seed': 7,
            'voice_settings': {'stability': 0.7, 'similarity_boost': 0.85, 'style': 0.1, 'use_speaker_boost': True}}
    whole = f'{lang}-all.mp3'
    code = subprocess.check_output(['curl', '-s', '-o', whole, '-w', '%{http_code}', '-X', 'POST',
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128',
        '-H', f'xi-api-key: {KEY}', '-H', 'Content-Type: application/json', '-d', json.dumps(body)]).decode()
    if code != '200': sys.exit(f'{lang}: HTTP {code} {open(whole, "rb").read()[:300]}')
    # the speech between pauses longer than 1.6 s, one piece per line
    log = run('ffmpeg', '-i', whole, '-af', 'silencedetect=n=-42dB:d=1.6', '-f', 'null', '-').stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    dur = float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', whole).stdout)
    cuts = [0.0] + ends; stops = starts + [dur]
    pieces = [(a, b) for a, b in zip(cuts, stops) if b - a > 0.3]
    if len(pieces) != len(lines): sys.exit(f'{lang}: found {len(pieces)} pieces for {len(lines)} lines; check {whole}')
    for (n, t), (a, b) in zip(lines, pieces):
        a = max(0, a - 0.06); b = min(dur, b + 0.12)
        run('ffmpeg', '-y', '-v', 'error', '-i', whole, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-c:a', 'libmp3lame', '-b:a', '128k', f'{lang}-{n}.mp3')
        print(f'{lang}-{n} {b - a:5.2f}s  {t}')
