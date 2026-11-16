# Music bed for episode 1 with ElevenLabs Music, into audio/01/music.mp3.
# Usage: ELEVENLABS_API_KEY=… python3 make_music_01.py
import json, os, subprocess
KEY = os.environ['ELEVENLABS_API_KEY']
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio', '01'))
body = {
    'prompt': (
        'Calm, warm, lightly rhythmic instrumental for a 37-second product video. A plucked oud or kanun motif over '
        'soft electronic beats and a gentle pad; modern and understated, hopeful. Builds slightly towards 30 seconds, '
        'then resolves with a soft ending at 37 seconds. No vocals.'
    ),
    'music_length_ms': 37000,
    'force_instrumental': True,
}
code = subprocess.check_output([
    'curl', '-s', '-o', 'music.mp3', '-w', '%{http_code}', '-X', 'POST',
    'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128',
    '-H', f'xi-api-key: {KEY}', '-H', 'Content-Type: application/json', '-d', json.dumps(body),
]).decode()
if code != '200':
    print('HTTP', code, open('music.mp3', 'rb').read()[:400])
    os.remove('music.mp3')
else:
    d = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'music.mp3'])
    print(f'music.mp3 {float(d):.2f}s')
