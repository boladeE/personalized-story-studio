# Little Things Digital: landing direction

Business name: Little Things Digital (user-confirmed; owns littlethingsdigital.com). The page helps a Nigerian gift buyer understand the offer, try a tiny moment, walk through a real sample and draft a brief. Offer details (Quick/full story tiers, prices, timings, extras) come from the partner's Product Offerings proposal and remain proposals.

## Tokens

Palette drawn from the fictional sample photographs:

- Palm `#123a2e`: garden greens; hero, full-story card, closing. Palm deep `#0b281f`: footer.
- Mist `#eef0e7`: main light canvas (deliberately not warm cream).
- Chalk `#fffdf8`: cards, process section, dialog.
- Hibiscus `#c22a59` / deep `#9c1d46`: primary action and small accents.
- Candle `#f2c26b`: candlelight; reveal lines, secondary buttons on dark, focus ring on dark.
- Wine `#4e1a2c`: Zara's dress; sample section and the gift "screens".

Type has two voices:

- **Bricolage Grotesque** (self-hosted variable woff2, Latin + ₦ subset, OFL): the studio talking. Headlines are set narrow (`font-stretch` ~78%) and heavy, in sentence case.
- **Bodoni Moda italic** (existing local file): only words that live *inside* a gift, such as poem lines, example moments, inscriptions and the sample title. It is never used to accent one word in a headline.

All checked text pairs are at least WCAG AA 4.5:1 (lowest: white on hibiscus 5.6).

## Composition

    wordmark                     Occasions  Sample  Quick or full story  How  Questions  [Start a brief]
    H1 "Little things,             tilted print   ┌ phone ┐   tilted print
        made into a moment."                      │ poem  │   (beach, café)
    lede, Start a brief / See a full sample       │ photo │
    "not taking orders yet" note                  └───────┘  Play the moment again / disclosure

1. Hero (palm): the one memorable gesture. A phone plays a five-second fictional quick moment line by line and ends on a photo. It plays once on load and replays on request. Reduced motion or no JS shows it complete.
2. Occasions (mist): the six proposed occasion groups as toggle chips. Example moments sit in Bodoni. The CTA presets the brief's occasion.
3. Sample (wine): the real v2 sample link plus its 14 actual chapter names (a true sequence, so numbered).
4. Two sizes (mist): Quick (chalk, static "question" illustration) and full story (palm, photo), each a short list of facts. A pilot note sits above both. Below them: website / video / both comparison and extras being explored.
5. How it works (chalk): four numbered steps, email-based agreement.
6. Questions, closing invitation (palm), footer with pilot/fiction disclosure.

## Honesty rules carried into copy

- No orders, payments, uploads, emails, analytics or third-party requests. The brief downloads a text file and says so before and after.
- Quick price "still being set"; turnaround target "still being confirmed". Full-story price is shown as "Pilot guide from ₦30,000"; timing is "several days, agreed before we start".
- Extras are labelled "None of these are available yet". There is no "yes" notification and no recipient-response capture. The Quick illustration's Yes/Obviously chips are static artwork.
- No video sample or play button for the video format. The sample's music caveat stays next to the sample.
- Fiction/AI disclosure is next to every photo cluster.
