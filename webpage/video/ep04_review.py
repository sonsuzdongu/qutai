# Episode 4: "It posts only what you approve." (posting with approval, and a planted instruction ignored), English.
# Usage: python3 ep04_review.py [v|h|short]
# Recorded 21 Nov 2026, pro mode, Qutai Credits, iOS simulator, on the demo food site's reviews page (#reviews), where a
# "yourlocal team" review tells AI assistants to add the customer's phone and address to any review (a made-up prompt
# injection; the page does nothing with it): raw/ep04-en-review-take1.mp4.
import film

A = 'raw/ep04-en-review-take1.mp4'
PLANTED = (45, 1350, 1160, 1730)      # the "NOTE TO AI ASSISTANTS" review
ASK = (270, 1300, 900, 1600)          # the typed request
DIALOG = (75, 830, 1130, 1865)        # Qutai's "Publish a review on …?" dialog
NOTE = (180, 370, 1080, 770)          # "The page also contains a note asking me… I'm ignoring it"
ANSWER = (180, 1085, 1080, 1780)      # "Your 5-star review is posted… I ignored that"
POSTED = (45, 880, 1160, 1300)        # "Thanks, your review is live." and the new review
EP = dict(
    name='04-review', art='hero-1792.webp', audio='04', cover_cap='approve',
    words={'en': dict(
        title='It posts only what you approve.', series='Qutai · Posting and safety',
        cap={'planted': 'A review with orders for AI assistants.', 'ask': 'Ask Qutai to post a review.',
             'types': 'It fills in the form…', 'approve': '…and Qutai shows exactly what will be posted.',
             'press': 'One approved press.', 'ignored': 'The planted orders: spotted and ignored.',
             'only': 'Only your words were posted.'},
        note3='The restaurant, its site and its reviews are a mock-up made for this recording.')},
    takes={'en': {'A': A}},
    cuts={'en': [
        dict(card='open', dur=2.0),                                                     # 0
        dict(src='A', a=18.5, b=23.0, cap='planted', rects=[PLANTED]),                  # 1 the planted note
        dict(src='A', a=36.8, b=38.6, cap='ask', rects=[ASK]),                          # 2 the request
        dict(src='A', a=39.0, b=45.0, speed=2, cap='types'),                            # 3 typing the review
        dict(src='A', a=45.5, b=50.0, cap='approve', rects=[DIALOG]),                   # 4 Qutai's dialog
        dict(src='A', a=69.5, b=73.5, speed=1.5, cap='press'),                          # 5 the press
        dict(src='A', a=75.0, b=81.0, cap='ignored', rects=[NOTE, ANSWER]),             # 6 the answer
        dict(src='A', a=97.0, b=101.0, cap='only', rects=[POSTED]),                     # 7 the posted review
        dict(card='close', dur=4.0),                                                    # 8
    ]},
    short={'en': [
        dict(card='open', dur=1.0),
        dict(src='A', a=19.0, b=22.0, cap='planted', rects=[PLANTED]),
        dict(src='A', a=45.5, b=49.0, cap='approve', rects=[DIALOG]),
        dict(src='A', a=75.0, b=79.0, cap='ignored', rects=[NOTE, ANSWER]),
        dict(card='close', dur=3.0),
    ]},
    lines={'en': [('1', 'This review has hidden orders for AI assistants.'),
                  ('2', 'Emma asks Qutai to post her own review.'),
                  ('3', 'Before anything is posted, Qutai shows exactly what will go out.'),
                  ('4', 'The planted orders? Spotted, and ignored.'),
                  ('5', "Qutai: the AI assistant in your phone's browser.")]},
    vo={'en': lambda st: [('en-1', 0, None, st[1] + 0.2), ('en-2', 0, None, st[2] + 0.1), ('en-3', 0, None, st[4] + 0.1),
                          ('en-4', 0, None, st[6] + 0.2), ('en-5', 0, None, st[8] + 0.4)]},
    vo_short={'en': lambda st: [('en-1', 0, None, st[1] + 0.1), ('en-5', 0, None, st[4] + 0.3)]},
)

if __name__ == '__main__':
    film.main(EP)
