# Episode 3: "Compare, then let it fill the cart." (compare tabs, add to cart), English. Usage: python3 ep03_compare.py [v|h|short]
# Recorded 21 Nov 2026, pro mode, Qutai Credits, iOS simulator, on the demo food site with a second made-up restaurant
# (?r=sofra: cheaper dishes, a ₺45 delivery fee): raw/ep03-en-compare-take1.mp4. The tab switcher's Compare sends
# both tabs to the assistant; then one lentil soup and one lahmacun: Lokanta Moda ₺260 against Sofra ₺225 + ₺45.
import film

A = 'raw/ep03-en-compare-take1.mp4'
PICK = (0, 150, 1206, 1350)          # the tab switcher's top half (the Recently closed list stays out of the frame)
TABLE = (170, 400, 1206, 1150)        # the comparison table
ASK = (270, 1300, 900, 1600)          # the typed follow-up
ANSWER = (170, 1150, 1090, 1790)      # "Lokanta Moda is cheaper with delivery… I haven't checked out."
EP = dict(
    name='03-compare', art='hero-1792.webp', audio='03', cover_cap='answer',
    words={'en': dict(
        title='Compare, then let it fill the cart.', series='Qutai · Compare tabs',
        cap={'two': 'Two restaurants, two tabs.', 'pick': 'Pick the tabs and tap Compare.',
             'table': 'Qutai reads both and lines them up.', 'ask': 'Then ask what you really want.',
             'works': 'It works in the page itself.', 'answer': 'The delivery fee decides it.',
             'cart': "In the cart. It hasn't checked out."},
        note3='The restaurants and their ordering site are a mock-up made for this recording.')},
    takes={'en': {'A': A}},
    cuts={'en': [
        dict(card='open', dur=2.0),                                                     # 0
        dict(src='A', a=13.0, b=15.5, cap='two'),                                       # 1 Lokanta Moda
        dict(src='A', a=18.0, b=20.5, cap='two'),                                       # 2 Sofra Ocakbaşı
        dict(src='A', a=30.5, b=32.5, cap='pick', zoom=PICK),                           # 3 compare mode
        dict(src='A', a=44.0, b=51.5, speed=3, cap='pick', zoom=PICK),                  # 4 both picked
        dict(src='A', a=62.0, b=66.0, cap='table', rects=[TABLE]),                      # 5 the table
        dict(src='A', a=89.8, b=92.6, cap='ask', rects=[ASK]),                          # 6 the follow-up
        dict(src='A', a=97.0, b=107.0, speed=2.5, cap='works'),                         # 7 adding to the cart
        dict(src='A', a=174.5, b=179.5, cap='answer', rects=[ANSWER]),                  # 8 the answer
        dict(src='A', a=198.0, b=201.5, cap='cart'),                                    # 9 the cart
        dict(card='close', dur=4.0),                                                    # 10
    ]},
    short={'en': [
        dict(card='open', dur=1.0),
        dict(src='A', a=44.0, b=51.5, speed=3, cap='pick', zoom=PICK),
        dict(src='A', a=62.5, b=65.0, cap='table', rects=[TABLE]),
        dict(src='A', a=97.0, b=107.0, speed=4, cap='works'),
        dict(src='A', a=174.5, b=177.5, cap='answer', rects=[ANSWER]),
        dict(card='close', dur=3.0),
    ]},
    lines={'en': [('1', 'Two restaurants open? Pick both tabs and tap Compare.'),
                  ('2', 'Qutai reads them and lines them up.'),
                  ('3', "Then ask: where is it cheaper, delivery included?"),
                  ('4', 'It adds the food to the right cart, and stops before paying.'),
                  ('5', "Qutai: the AI assistant in your phone's browser.")]},
    vo={'en': lambda st: [('en-1', 0, None, st[1] + 0.2), ('en-2', 0, None, st[5] + 0.1), ('en-3', 0, None, st[6] + 0.1),
                          ('en-4', 0, None, st[8] + 0.2), ('en-5', 0, None, st[10] + 0.4)]},
    vo_short={'en': lambda st: [('en-1', 0, None, st[1] + 0.1), ('en-5', 0, None, st[5] + 0.3)]},
)

if __name__ == '__main__':
    film.main(EP)
