# Writing a template

A template is one way a film can look, written as a JSON file in `public/templates/<id>.json` and drawn by one engine. The studio's aim is that two people's films are very unlikely to look alike, so it needs many templates that differ in **composition**, not only in colour and type. A recolour of an existing layout is not a new template.

Read these first, in this order:

1. `src/template/types.ts` — the format. It is the authority: every field, every allowed value, with comments. Do not invent fields or values.
2. `public/templates/gallery-wall.json` and `public/templates/loud-poster.json` — two finished templates that pass every check and look nothing like each other.
3. This file.

You write data only. Do not edit the engine (`src/template/*`, `src/styles/template.css`), the scripts, or another template. If the engine cannot do something your design needs, design around it and say so in your report.

## How a page works

A film is made of pages of fixed kinds (`PAGES` in `types.ts`): `cover`, `name`, `card`, `line`, `photo`, `item` and/or `list`, `montage`, `voice`, `letter`, `wish`, `reveal`, `credits`. A template lays out every kind. It never contains words or photos: a page names **slots** (`title`, `body`, `who`…) and the film fills them.

- A page is a **grid**: `cols` and `rows` are track sizes as shares of the space. It is given twice: `wide` (a 16:10 screen) and `tall` (a phone held upright, 1:2). They are different compositions, not one squeezed into the other.
- Every item has `at: { wide: [col, row, colSpan, rowSpan], tall: [...] }`, counted from 1. Items may overlap; later items are drawn on top, so put shapes first.
- Words are **fitted**: the engine shrinks them (down to `min`, a share of `size`) until they fit the area. Give big words a big area. Small words (labels, sentences) are never shrunk below a readable size.
- A slot with nothing in it is left out, and so is its item. Design so a page still looks finished without its optional slots (`kicker`, `body`, `sub`, `occasion`, `sender`, `note`, `pick`, `count`).
- `only: "photo"` / `only: "noPhoto"` shows an item only when the page has (or lacks) a photo. A voice page must look right both ways: usually one set of items for each case.
- A `box` is a filled shape behind words. With `stretch: true` it fills its whole area: that is how you make a panel of colour with words on it.
- A `group` stacks several slots in one area and fits them together. Use it for a label + headline + sentence.

## Sizes

Sizes, gaps and padding are in **units**. One unit is 1% of a wide frame's width (12.8px on the test page) and about 2.1% of a phone's width (8.2px).

| Use | Size |
|---|---|
| Small labels | 1.4 to 1.8 (1.4 is the least that stays readable on a phone) |
| Sentences | 1.8 to 2.4 |
| Headlines | 4 to 9 |
| A name, a numeral, a shout | 9 to 20 |

## What the checks turn away

Run these from `platform/`. A dev server is already running on port 3124; do not start or stop one.

```
node scripts/check-template.mjs public/templates/<id>.json     # the data: shape, required pages, readable colour pairs
node scripts/gate.mjs public/templates/<id>.json --shots <dir>  # drawn on two test films, wide and upright, in every palette
node scripts/distinct.mjs public/templates/<id>.json            # its layout is not another template's
```

The gate draws every page on a film with very little to say and one with a great deal (a 17-letter name, a seven-line list, long sentences), and fails a template when:

- words do not fit their area even at their smallest, or run off the page;
- a word had to be broken in two to fit (a long name cut mid-word);
- words from different items lie over each other;
- words lie on a photo with nothing behind them (give them a `box`);
- words have less than 4.5:1 contrast with what is behind them (3:1 for large type), in **any** palette, including after the palette is turned toward a film's own colours;
- words are smaller than 11px on a phone or 13px on a wide screen;
- a photo is too small, or mostly off the page; a button is too small or off the page.

Colour rules that save time: `ink` and `soft` are for words on `bg`. `onSurface` is for words on `surface`. `onAccent` is for words on `accent`. `accent` on `bg` is only guaranteed 3:1, so use it for large type and marks, not small labels, unless your palettes give it 4.5:1. `accent2` is for shapes.

## Look at what you made

`--shots <dir>` saves contact sheets (`<id>-wide-p0.jpg`, `<id>-tall-p0.jpg`, …). **Open them and look.** The gate only catches what can be measured. You are responsible for whether it is good:

- Does every page look composed and finished, with the short film and with the long one?
- Is there a clear idea a person could name in a few words, carried through every page?
- Is the upright layout designed for a phone, or a squeezed copy of the wide one?
- Are the big words big? Timid type is the most common failure.
- Would someone mistake it for one of the templates that already exist? If so, change the composition, not the colours.

Fix and run again until the checks pass and you would be content to have it shown to a paying customer.

## Making it its own

Vary these, in roughly this order of how much they change what a viewer sees:

1. **Composition**: where the photo and the words sit, how big each is, symmetry or its absence, what overlaps, panels of colour.
2. **Surface**: the ground and its texture, a `sheet` (a page or card inside the frame), photo frames, shapes.
3. **Type**: the three voices, their case and spacing, how large the display voice runs.
4. **Colour**: two to four palettes that each work, light and dark where the idea allows.
5. **Motion**: how pages cut and how things arrive.

A template has one idea. Do not mix every frame and every shape into one design.

## Things that help

- `sizeTall` on words and lists gives a different size on a phone, for when one `size` cannot serve both shapes.
- A list has `valign`: `start` makes it grow downward from the top of its area as lines arrive.
- `mark: "glow"` lights words in their own colour (a sign on a dark ground).
- A shape has `anchor` (`top-left`, `bottom`, `right`…) to sit in a corner or along an edge of its area, `scale` from 0.02 to 2.5, and there is a `vrule` (vertical line) beside `rule`.
- A shape may be turned any amount (`rotate` from -180 to 180); everything else from -8 to 8.
- Words on a shape are measured against the shape. They do not need a `box` of their own, but they do need contrast with the shape's colour in every palette.

## The file

- `id`: lower-case with hyphens, the same as the file name. `name`: two or three words. `idea`: one sentence.
- `tags`: what it suits, from the list in `types.ts`.
- `tint: true` lets a film turn the palette toward its own photos; set it `false` only when the idea depends on exact colours.
- Nothing in a template may name or depict a real person, brand, film, band or product.
