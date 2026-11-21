# Episode 5: "Make any site yours." (page styles), English. Usage: python3 ep05_styles.py [v|h|short]
# Recorded 21 Nov 2026, pro mode, Qutai Credits, iOS simulator, on the demo food site: raw/ep05-en-styles-take1.mp4.
import film

A = 'raw/ep05-en-styles-take1.mp4'
EP = dict(
    name='05-styles', art='hero-1792.webp', audio='05', cover_cap='change',
    words={'en': dict(
        title='Make any site yours.', series='Qutai · Page styles',
        cap={'ask': 'Ask for the look you want.', 'approve': 'You see the change before it happens.',
             'change': 'The page changes at once.', 'honest': 'It checks the result and says what still looks off.',
             'keep': 'Keep it for the site…', 'rules': '…in My rules, where you can switch it off.',
             'off': 'One tap turns it off for a page.', 'reload': 'Still there after a reload.'},
        note3='The restaurant and its ordering site are a mock-up made for this recording.')},
    takes={'en': {'A': A}},
    cuts={'en': [
        dict(card='open', dur=2.0),                                                          # 0
        dict(src='A', a=9.0, b=11.8),                                                        # 1 the site as it is
        dict(src='A', a=12.0, b=15.4, cap='ask', rects=[(300, 2370, 920, 2500)]),            # 2 the request
        dict(src='A', a=20.0, b=23.0, cap='approve', rects=[(60, 870, 1145, 1835)]),         # 3 Qutai's dialog
        dict(src='A', a=33.6, b=40.0, speed=2, cap='change'),                                # 4 dark, larger text
        dict(src='A', a=57.5, b=61.0, cap='honest', rects=[(190, 1270, 1080, 1510)]),        # 5 "…a few light badges…"
        dict(src='A', a=77.5, b=80.5, cap='keep', rects=[(60, 710, 1145, 1995)]),            # 6 Keep this style?
        dict(src='A', a=89.5, b=92.0, cap='rules', rects=[(170, 680, 1160, 985)]),           # 7 Style kept in My rules
        dict(src='A', a=114.0, b=117.0, cap='off', rects=[(500, 1755, 1190, 1880)]),         # 8 Styles off for this page
        dict(src='A', a=125.0, b=128.0, cap='reload'),                                       # 9 after a reload
        dict(card='close', dur=4.0),                                                         # 10
    ]},
    short={'en': [
        dict(card='open', dur=1.0),
        dict(src='A', a=9.5, b=11.8),
        dict(src='A', a=20.5, b=23.0, cap='approve', rects=[(60, 870, 1145, 1835)]),
        dict(src='A', a=33.6, b=40.0, speed=2.5, cap='change'),
        dict(src='A', a=78.0, b=80.5, cap='keep', rects=[(60, 710, 1145, 1995)]),
        dict(card='close', dur=3.0),
    ]},
    lines={'en': [('1', 'Bigger text, a dark background: just ask.'),
                  ('2', 'Qutai shows the change first, and applies it when you say yes.'),
                  ('3', 'It checks the result, and tells you what still looks off.'),
                  ('4', 'Keep it for the site, and switch it off with one tap.'),
                  ('5', "Qutai: the AI assistant in your phone's browser.")]},
    vo={'en': lambda st: [('en-1', 0, None, st[2] + 0.1), ('en-2', 0, None, st[3] + 0.1), ('en-3', 0, None, st[5] + 0.1),
                          ('en-4', 0, None, st[6] + 0.3), ('en-5', 0, None, st[10] + 0.4)]},
    vo_short={'en': lambda st: [('en-1', 0, None, st[1] + 0.1), ('en-5', 0, None, st[5] + 0.3)]},
)

if __name__ == '__main__':
    film.main(EP)
