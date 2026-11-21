# Episode 9: "See what left your phone." (what was sent to the AI, and the cost), English. Usage: python3 ep09_sent.py [v|h|short]
# Recorded 21 Nov 2026 right after episode 3, in its conversation (pro mode, Qutai Credits, iOS simulator):
# raw/ep09-en-sent-take1.mp4. The charge under the answer, its details, the answer's menu › What was sent to the AI,
# the day's list, one request and the page text exactly as it was sent (marked as untrusted page content).
import film

A = 'raw/ep09-en-sent-take1.mp4'
EP = dict(
    name='09-sent', art='hero-1792.webp', audio='09', cover_cap='list',
    words={'en': dict(
        title='See what left your phone.', series='Qutai · What was sent to the AI',
        cap={'answer': 'Every answer shows what it cost.', 'cost': 'Tap it for the details.',
             'menu': 'And what exactly was sent?', 'list': 'Every request, logged before it leaves.',
             'request': 'What one request carried, and charged.',
             'text': 'The exact page text, marked as untrusted.'},
        note3='The restaurants and their ordering site are a mock-up made for this recording.')},
    takes={'en': {'A': A}},
    cuts={'en': [
        dict(card='open', dur=2.0),                                                          # 0
        dict(src='A', a=23.0, b=26.0, cap='answer', rects=[(680, 1790, 1000, 1900)]),        # 1 0.53 credits
        dict(src='A', a=31.5, b=36.0, cap='cost', rects=[(75, 855, 1130, 1855)]),            # 2 Charged: 0.53 credits
        dict(src='A', a=47.0, b=50.0, cap='menu', rects=[(55, 2365, 1125, 2480)]),           # 3 the answer's menu
        dict(src='A', a=55.5, b=60.0, cap='list', rects=[(40, 1140, 1160, 2510)]),           # 4 Sent to the AI
        dict(src='A', a=68.5, b=72.5, cap='request', rects=[(50, 1085, 1155, 1565)]),        # 5 one request
        dict(src='A', a=80.0, b=85.0, cap='text', rects=[(50, 1700, 1155, 2510)]),           # 6 the page text
        dict(src='A', a=93.0, b=97.5, speed=1.5, cap='text'),                                # 7 scrolling through it
        dict(card='close', dur=4.0),                                                         # 8
    ]},
    short={'en': [
        dict(card='open', dur=1.0),
        dict(src='A', a=32.0, b=35.0, cap='cost', rects=[(75, 855, 1130, 1855)]),
        dict(src='A', a=56.0, b=59.5, cap='list', rects=[(40, 1140, 1160, 2510)]),
        dict(src='A', a=80.5, b=84.0, cap='text', rects=[(50, 1700, 1155, 2510)]),
        dict(card='close', dur=3.0),
    ]},
    lines={'en': [('1', 'Every answer shows what it cost.'),
                  ('2', 'And you can see exactly what was sent to the AI:'),
                  ('3', 'every request, with the page text it carried.'),
                  ('4', 'Nothing goes to the AI without showing up here.'),
                  ('5', "Qutai: the AI assistant in your phone's browser.")]},
    vo={'en': lambda st: [('en-1', 0, None, st[1] + 0.2), ('en-2', 0, None, st[3] + 0.1), ('en-3', 0, None, st[5] + 0.1),
                          ('en-4', 0, None, st[6] + 1.8), ('en-5', 0, None, st[8] + 0.4)]},
    vo_short={'en': lambda st: [('en-1', 0, None, st[1] + 0.1), ('en-5', 0, None, st[4] + 0.3)]},
)

if __name__ == '__main__':
    film.main(EP)
