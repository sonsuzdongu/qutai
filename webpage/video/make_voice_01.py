# Voiceover for episode 1 with ElevenLabs (voice "Ayça D.", multilingual v2), one file per line, into audio/01/.
# Usage: ELEVENLABS_API_KEY=… python3 make_voice_01.py [tr-2 en-3 …]   (no arguments: every line)
# Prints each line's length against its scene window from 01-hafiza.md.
import json, os, subprocess, sys
KEY=os.environ['ELEVENLABS_API_KEY']; VOICE='5RqXmIU9ikjifeWoXHMG'
LINES={
 'tr':[("1","0:00–0:09",9,"Qutai’ye bir kez söyleyin. Hatırlar."),
       ("2","0:09–0:14",5,"Telefonunuzda saklanır; görebilir, silebilirsiniz."),
       ("3","0:15–0:23",8,"Ertesi akşam yemek isteyin. Söylemenize gerek yok: glutensiz arar."),
       ("4","0:26–0:33",7,"Bilgileriniz sorulmadan girilmez. Ödemeyi siz yaparsınız."),
       ("5","0:33–0:37",4,"Qutai. Sizi tanır, telefonunuzda.")],
 'en':[("1","0:00–0:09",9,"Tell Qutai once. It remembers."),
       ("2","0:09–0:14",5,"It stays on your phone, where you can see it and delete it."),
       ("3","0:15–0:23",8,"The next evening, ask for dinner. No need to say it again: it looks for gluten-free."),
       ("4","0:26–0:33",7,"Your details go in only when you say so. You make the payment."),
       ("5","0:33–0:37",4,"Qutai. It knows you, on your phone.")]}
only=sys.argv[1:]  # optional "tr-2" style filters
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio", "01"))
for lang, lines in LINES.items():
    for i,(n,win,maxs,text) in enumerate(lines):
        name=f"{lang}-{n}"
        if only and name not in only: continue
        body={"text":text,"model_id":"eleven_multilingual_v2","language_code":lang,
              "voice_settings":{"stability":0.55,"similarity_boost":0.8,"style":0.15,"use_speaker_boost":True}}
        if i>0: body["previous_text"]=lines[i-1][3]
        if i<len(lines)-1: body["next_text"]=lines[i+1][3]
        code=subprocess.check_output(["curl","-s","-o",f"{name}.mp3","-w","%{http_code}","-X","POST",
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
            "-H",f"xi-api-key: {KEY}","-H","Content-Type: application/json","-d",json.dumps(body)]).decode()
        if code!="200": print(name,"HTTP",code,open(f"{name}.mp3","rb").read()[:300]); continue
        d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"{name}.mp3"]))
        print(f"{name} {d:5.2f}s / window {maxs}s {'OK' if d<=maxs else 'LONG'}  {text}")
