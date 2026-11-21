# Episode 8: "Answers with their sources." (research on the web), English. Usage: python3 ep08_research.py [v|h|short]
# Recorded 21 Nov 2026, pro mode, Qutai Credits, iOS simulator, on the real web from a new tab:
# raw/ep08-en-research-take2.mp4 (take 1 was dropped: the new tab page's paste button searched the web instead).
# Three red lentil soup recipes compared, with the searches and source cards; one source opened at the end.
import film

A = 'raw/ep08-en-research-take2.mp4'
ASK = (270, 1300, 900, 1600)            # the typed request
COMPARISON = (180, 560, 1080, 1630)     # the Comparison list
SOURCES = (180, 1775, 1206, 2175)       # "Searched: …" lines and the source cards
EP = dict(
    name='08-research', art='hero-1792.webp', audio='08', cover_cap='compare',
    words={'en': dict(
        title='Answers with their sources.', series='Qutai · Research',
        cap={'ask': 'Ask a question the web can answer.', 'search': 'Qutai searches and reads the pages.',
             'compare': 'Then it compares what it found.', 'detail': 'Ingredients and times, recipe by recipe.',
             'sources': 'The sources are listed under the answer.', 'open': 'One tap opens the page it came from.'},
        note3='Recipes from public websites, shown as the assistant cited them.')},
    takes={'en': {'A': A}},
    cuts={'en': [
        dict(card='open', dur=2.0),                                                     # 0
        dict(src='A', a=18.0, b=22.3, cap='ask', rects=[ASK]),                          # 1 the request
        dict(src='A', a=23.0, b=32.5, speed=3, cap='search'),                           # 2 working
        dict(src='A', a=33.5, b=38.5, cap='compare', rects=[COMPARISON]),               # 3 the comparison
        dict(src='A', a=60.0, b=64.0, cap='detail'),                                    # 4 recipe by recipe
        dict(src='A', a=50.0, b=53.5, cap='sources', rects=[SOURCES]),                  # 5 sources
        dict(src='A', a=73.0, b=77.0, cap='open'),                                      # 6 the source page
        dict(card='close', dur=4.0),                                                    # 7
    ]},
    short={'en': [
        dict(card='open', dur=1.0),
        dict(src='A', a=20.8, b=22.3, cap='ask', rects=[ASK]),
        dict(src='A', a=23.0, b=32.5, speed=4, cap='search'),
        dict(src='A', a=33.5, b=37.0, cap='compare', rects=[COMPARISON]),
        dict(src='A', a=50.0, b=53.0, cap='sources', rects=[SOURCES]),
        dict(card='close', dur=3.0),
    ]},
    lines={'en': [('1', 'Ask Qutai to find and compare things on the web.'),
                  ('2', 'It searches, reads, and lines up what it found.'),
                  ('3', 'Every answer comes with its sources, one tap away.'),
                  ('5', "Qutai: the AI assistant in your phone's browser.")]},
    vo={'en': lambda st: [('en-1', 0, None, st[1] + 0.2), ('en-2', 0, None, st[3] + 0.1), ('en-3', 0, None, st[5] + 0.1),
                          ('en-5', 0, None, st[7] + 0.4)]},
    vo_short={'en': lambda st: [('en-1', 0, None, st[1] + 0.1), ('en-5', 0, None, st[5] + 0.3)]},
)

if __name__ == '__main__':
    film.main(EP)
