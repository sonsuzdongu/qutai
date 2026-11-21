# The all-in-one film: every finished episode in one 9:16 cut, English. Usage: python3 ep00_all.py [v|h|short]
# Built 21 Nov 2026 from the episodes' own takes (episodes 1, 2, 3, 4, 5, 8 and 9); the header names each feature.
# Not in it yet: image editing (the simulator's photo picker closes itself), contacts and calendar (they need the
# phone's permission prompts answered on the recording device).
import film

EN_A_ZOOM = (0, 340, 1206, 1080)
EN_PAY = (60, 440, 1145, 2265)
PICK = (0, 150, 1206, 1350)
EP = dict(
    name='00-all', art='hero-1792.webp', audio='00', cover_cap='approve',
    words={'en': dict(
        title='A browser that does the work.', series='Qutai',
        remembered='Remembered', from_memory='From memory',
        s_mem='Qutai · It gets to know you', s_pay='Qutai · Paying', s_cmp='Qutai · Compare tabs',
        s_rev='Qutai · Posting and safety', s_sty='Qutai · Page styles', s_app='Qutai · Apps',
        s_res='Qutai · Research', s_sent='Qutai · What was sent to the AI',
        cap={'rem': 'Say it once. Remembered.', 'note': 'Later, it uses what it remembered.',
             'approve': 'It pays only when you approve.', 'paid': 'Order placed.',
             'pick': 'Pick two tabs and tap Compare.', 'table': 'Qutai lines them up.',
             'answer': 'The delivery fee decides it.',
             'planted': 'A review with orders for AI assistants.',
             'dialog': 'Qutai shows exactly what will be posted.', 'ignored': 'The planted orders: spotted and ignored.',
             'style': 'Ask for the look you want.', 'change': 'The page changes at once.',
             'build': 'Ask for an app. Qutai builds it.', 'use': 'Then it’s yours to use.', 'myapps': 'It waits in My apps.',
             'search': 'It searches and reads the pages.', 'compare': 'Then it compares what it found.',
             'sources': 'The sources are listed under the answer.',
             'cost': 'Every answer shows what it cost.', 'text': 'And exactly what was sent to the AI.'},
        note1='Always confirm allergens with the restaurant.',
        note3='The restaurants, their site and reviews are a mock-up made for these recordings.')},
    takes={'en': {'M1': 'raw/ep01-en-actA-take3.mp4', 'M2': 'raw/ep01-en-actB-take6.mp4',
                  'C': 'raw/ep03-en-compare-take1.mp4', 'R': 'raw/ep04-en-review-take1.mp4',
                  'S': 'raw/ep05-en-styles-take1.mp4', 'P': 'raw/ep02-en-apps-take2.mp4',
                  'Q': 'raw/ep08-en-research-take2.mp4', 'L': 'raw/ep09-en-sent-take1.mp4'}},
    cuts={'en': [
        dict(card='open', dur=2.5),                                                                      # 0
        dict(src='M1', a=6.2, b=8.2, freeze=0.6, cap='rem', series='s_mem', zoom=EN_A_ZOOM, badge_above='outside',
             rects=[(170, 560, 880, 690)], badge=('remembered', 'check', (170, 560, 880, 690))),          # 1
        dict(src='M2', a=19.2, b=22.2, cap='note', series='s_mem', badge_above=True,
             rects=[(180, 625, 1070, 780)], badge=('from_memory', 'chest', (180, 625, 1070, 780))),       # 2
        dict(src='M2', a=106.0, b=109.0, cap='approve', series='s_pay', rects=[EN_PAY]),                  # 3
        dict(src='M2', a=133.0, b=135.5, cap='paid', series='s_pay', late=0.4, rects=[(40, 1120, 1166, 1300)]),  # 4
        dict(src='C', a=44.0, b=51.5, speed=3, cap='pick', series='s_cmp', zoom=PICK),                    # 5
        dict(src='C', a=62.5, b=65.0, cap='table', series='s_cmp', rects=[(170, 400, 1206, 1150)]),       # 6
        dict(src='C', a=174.5, b=177.5, cap='answer', series='s_cmp', rects=[(170, 1150, 1090, 1790)]),   # 7
        dict(src='R', a=19.0, b=22.0, cap='planted', series='s_rev', rects=[(45, 1350, 1160, 1730)]),     # 8
        dict(src='R', a=45.5, b=48.5, cap='dialog', series='s_rev', rects=[(75, 830, 1130, 1865)]),       # 9
        dict(src='R', a=75.0, b=79.0, cap='ignored', series='s_rev',
             rects=[(180, 370, 1080, 770), (180, 1085, 1080, 1780)]),                                    # 10
        dict(src='S', a=12.0, b=15.0, cap='style', series='s_sty', rects=[(300, 2370, 920, 2500)]),       # 11
        dict(src='S', a=33.6, b=40.0, speed=2.5, cap='change', series='s_sty'),                           # 12
        dict(src='P', a=25.0, b=37.5, speed=5, cap='build', series='s_app'),                              # 13
        dict(src='P', a=81.5, b=86.5, speed=1.5, cap='use', series='s_app'),                              # 14
        dict(src='P', a=111.0, b=114.0, cap='myapps', series='s_app', rects=[(50, 1020, 340, 1280)]),     # 15
        dict(src='Q', a=23.0, b=32.5, speed=4, cap='search', series='s_res'),                             # 16
        dict(src='Q', a=33.5, b=37.0, cap='compare', series='s_res', rects=[(180, 560, 1080, 1630)]),     # 17
        dict(src='Q', a=50.0, b=53.0, cap='sources', series='s_res', rects=[(180, 1775, 1206, 2175)]),    # 18
        dict(src='L', a=32.0, b=35.0, cap='cost', series='s_sent', rects=[(75, 855, 1130, 1855)]),        # 19
        dict(src='L', a=80.5, b=84.5, cap='text', series='s_sent', rects=[(50, 1700, 1155, 2510)]),       # 20
        dict(card='close', dur=4.0),                                                                     # 21
    ]},
    short={'en': [
        dict(card='open', dur=1.0),
        dict(src='M2', a=106.0, b=108.5, cap='approve', series='s_pay', rects=[EN_PAY]),
        dict(src='C', a=174.5, b=177.0, cap='answer', series='s_cmp', rects=[(170, 1150, 1090, 1790)]),
        dict(src='R', a=75.0, b=78.0, cap='ignored', series='s_rev', rects=[(180, 370, 1080, 770), (180, 1085, 1080, 1780)]),
        dict(src='P', a=81.5, b=86.5, speed=2, cap='use', series='s_app'),
        dict(card='close', dur=3.0),
    ]},
    lines={'en': [('mem', 'Tell Qutai something once, and it remembers.'),
                  ('pay', 'It pays only when you approve.'),
                  ('cmp', 'It compares your tabs, and fills the cheaper cart.'),
                  ('rev', 'It posts only what you approve, and ignores orders hidden in pages.'),
                  ('sty', 'Restyle any site, just by asking.'),
                  ('app', 'Ask for an app, and it builds one for you.'),
                  ('res', 'It researches the web, and shows its sources.'),
                  ('sent', 'And you can see everything that was sent to the AI.'),
                  ('close', "Qutai: the AI assistant in your phone's browser.")]},
    vo={'en': lambda st: [('en-mem', 0, None, st[1] + 0.2), ('en-pay', 0, None, st[3] + 0.1), ('en-cmp', 0, None, st[5] + 0.1),
                          ('en-rev', 0, None, st[8] + 0.2), ('en-sty', 0, None, st[11] + 0.1), ('en-app', 0, None, st[13] + 0.1),
                          ('en-res', 0, None, st[16] + 0.1), ('en-sent', 0, None, st[19] + 0.1), ('en-close', 0, None, st[21] + 0.4)]},
    vo_short={'en': lambda st: [('en-pay', 0, None, st[1] + 0.1), ('en-close', 0, None, st[5] + 0.3)]},
)

if __name__ == '__main__':
    film.main(EP)
