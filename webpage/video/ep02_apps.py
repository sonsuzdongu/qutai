# Episode 2: "Build your own app." (apps inside Qutai), English. Usage: python3 ep02_apps.py [v|h|short]
# Recorded 21 Nov 2026, pro mode, Qutai Credits, iOS simulator: raw/ep02-en-apps-take2.mp4 (take 1 showed a localhost
# tile on the new tab page). The recorder caught no frame of the pasted request between the paste and the send, so
# the request is quoted in the caption over the building scene instead of shown in the box (it is what was sent).
import film

A = 'raw/ep02-en-apps-take2.mp4'
EP = dict(
    name='02-apps', art='hero-1792.webp', audio='02', cover_cap='use',
    words={'en': dict(
        title='Build your own app.', series='Qutai · Your own apps',
        cap={'start': 'Make your own apps.',
             'ask': 'You ask: “Build me an app to track how much water I drink each day.”',
             'build': 'Qutai writes it and tests it in a preview.',
             'use': 'Then it’s yours to use.', 'stays': 'Offline, with the data on your phone.',
             'myapps': 'It waits in My apps.', 'kept': 'Your entries are still there.'},
        note3='Writing an app is an ordinary assistant request; running it costs nothing.')},
    takes={'en': {'A': A}},
    cuts={'en': [
        dict(card='open', dur=2.0),                                                           # 0
        dict(src='A', a=2.0, b=5.0, cap='start', rects=[(55, 1025, 1150, 1550)]),             # 1 the new tab page
        dict(src='A', a=25.0, b=37.5, speed=4, cap='ask'),                                    # 2 building (request quoted)
        dict(src='A', a=38.0, b=41.0, cap='build'),                                           # 3 the preview
        dict(src='A', a=81.5, b=86.5, speed=1.5, cap='use'),                                # 4 +250, +250, +500
        dict(src='A', a=100.0, b=104.0, cap='stays', rects=[(190, 1835, 1080, 2020)]),        # 5 "It works offline…"
        dict(src='A', a=111.0, b=114.0, cap='myapps', rects=[(50, 1020, 340, 1280)]),         # 6 My apps
        dict(src='A', a=120.5, b=124.0, cap='kept'),                                          # 7 opened again: 1000 ml
        dict(card='close', dur=4.0),                                                          # 8
    ]},
    short={'en': [
        dict(card='open', dur=1.0),
        dict(src='A', a=25.0, b=37.5, speed=5, cap='ask'),
        dict(src='A', a=82.0, b=86.5, speed=1.5, cap='use'),
        dict(src='A', a=100.5, b=103.5, cap='stays', rects=[(190, 1835, 1080, 2020)]),
        dict(src='A', a=111.0, b=113.4, cap='myapps', rects=[(50, 1020, 340, 1280)]),
        dict(card='close', dur=3.0),
    ]},
    lines={'en': [('1', 'Ask Qutai for a small app, in your own words.'),
                  ('2', 'It writes it and tests it in a preview.'),
                  ('3', 'It runs offline, and your data stays on your phone.'),
                  ('4', "Qutai: the AI assistant in your phone's browser.")]},
    vo={'en': lambda st: [('en-1', 0, None, st[1] + 0.2), ('en-2', 0, None, st[3] + 0.1),
                          ('en-3', 0, None, st[5] + 0.2), ('en-4', 0, None, st[8] + 0.4)]},
    vo_short={'en': lambda st: [('en-1', 0, None, st[1] + 0.1), ('en-4', 0, None, st[5] + 0.3)]},
)

if __name__ == '__main__':
    film.main(EP)
