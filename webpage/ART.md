# Miniatures for the website

The site is illustrated with six paintings in the style of Ottoman miniatures (like the ones on
games.sonsuzdongu.com), whose characters are **robots**: Qutai's assistant, shown at work. Until a painting exists,
its place on the page shows a patterned placeholder.

## Adding a painting

1. Make the image (prompts below). Landscape, at least 1920 px wide; PNG, JPEG or WebP.
2. Save it in `webpage/art-src/` with the exact name from the table (`hero.png`, `compare.jpg`, …).
3. Run `npm run art`. It writes `src/art/<name>-640.webp`, `-1280.webp` and `-1920.webp` (the originals stay out of
   git).
4. `npm run build` (or `npm run dev`): the page uses the painting automatically. Commit `src/art/`.

| File | Where it appears | Ratio |
|---|---|---|
| `hero` | Under the headline, full width | 3:2 (e.g. 1920×1280) |
| `compare` | "Compare products across tabs" | 4:3 |
| `checkout` | "Fill the checkout, stop before payment" | 4:3 |
| `booking` | "Book it, then put it in your calendar" | 4:3 |
| `research` | "Research with sources" | 4:3 |
| `memory` | "It gets to know you" | 4:3 |

## The robot (keep it the same in every painting)

An original character, not resembling any existing brand's robot: a slender humanoid robot with a smooth, rounded
**porcelain-white head** and a **dark glass visor** across the face, on which a thin **ring of light in blue fading to
cyan** glows (a nod to the Q logo). Jointed white hands. It wears Ottoman court dress in rich colours (kaftans in
lapis blue, turquoise, coral red or saffron, gold embroidery), sometimes a tall felt cap or a small turban over the
porcelain head. Several robots may appear in one painting, all of the same model in different robes. People, when
they appear, are the robots' patrons: the user is always the one who holds the purse, the seal or the key.

## Shared style (append to every prompt)

> Ottoman miniature painting, 16th-century Istanbul court style (Nakkaş Osman / Levnî school), flat perspective,
> rich mineral pigments, lapis blue, turquoise, coral red, saffron and gold leaf, Iznik tile patterns and floral
> borders, fine ink outlines, cream paper texture, intricate but readable composition, no text, no letters, no
> logos, no watermark, landscape.

## Prompts

**hero**: A palace library in Istanbul where several porcelain-headed robot scribes in colourful kaftans sit at low
inlaid desks, each reading a glowing tablet that shows a web page; one robot points at a page and turns to another
as if comparing; scrolls, books, an astrolabe and tulips on the desks; tiled walls; through an arched window the
domes and minarets of the city. Calm, busy, wondrous.

**compare**: A robot in a turquoise kaftan in a Grand Bazaar shop holds two pairs of embroidered leather slippers,
weighing them on a brass balance; two open tablets on the counter show the two shops' pages; a small scroll lists
prices side by side; merchants and lanterns in the background.

**checkout**: A robot in a lapis kaftan at a merchant's counter writes the patron's name and address on an order
form with a reed pen, reading from a small notebook; at the end of the counter stands a closed money chest, and the
robot stops with an open, waiting hand, while the human patron beside it holds the purse and the seal. Clear moment
of "over to you".

**booking**: A robot in a saffron kaftan in a caravanserai courtyard arranges a dinner reservation: it writes in a
large calendar scroll marked with moon phases, while a brass handset (an old telephone, painted in the miniature
style) rings on a cushion beside it; a garden table with lanterns and food is being set in the background.

**research**: A robot scholar in a coral kaftan in an observatory tower, surrounded by many open books and
manuscripts, an astrolabe and a celestial globe; thin gold threads connect passages in different books to a single
report the robot is writing; a night sky with stars through the window.

**memory**: A robot in a turquoise robe kneels before an open, beautifully inlaid wooden chest filled with small
labelled boxes, letters and keepsakes, sorting them into compartments; the chest sits inside a patterned room of a
house (not a treasury); the human patron holds the chest's key on a cord, watching approvingly.

## Notes

- The paintings illustrate; they are not screenshots. The phone mock on the page shows the real interface.
- Keep faces and objects free of real brands, letters and logos (the models often invent text; regenerate if so).
- Alt texts for each painting are in `src/i18n/` (`art.<name>.alt`); update them if a painting's content changes.
