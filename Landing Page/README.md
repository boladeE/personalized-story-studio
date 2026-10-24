# Little Things landing page

A working local storefront concept for the personalized digital-gifting studio. “Little Things” is a temporary brand name, not a registered or user-approved final identity.

## Preview

    python -m http.server 8768 --bind 127.0.0.1

Open http://127.0.0.1:8768/ . The page also opens directly from index.html; HTTP is preferable for the embedded sample's optional external music player.

## Included

- Responsive photo-led landing page with locally hosted Bodoni Moda and DM Sans fonts.
- Working occasion selector and format-specific brief CTAs.
- A self-contained copy of the fictional photographic Zara/Tobi interactive birthday demo at sample/.
- Website and keepsake-film offer descriptions, three-step process, ₦30,000 starting pilot-price guide, and FAQ.
- Accessible native-dialog brief form with required-field/email validation and a real downloadable text brief.
- Working mobile menu, native FAQ disclosure, keyboard focus, Escape-to-close dialog behavior, and reduced-motion support.

## Honest prototype limits

The form does not submit orders, upload media, send email, collect payments, or claim a booking. It generates a text file on the visitor's device and states this before use. Nothing is stored in localStorage or sent to a backend. The browser may retain fields for the current page session; closing and reopening the dialog preserves that draft until reload.

The pilot price is a starting hypothesis from the proposal, not validated pricing or a fixed all-inclusive offer. Scope, delivery timing, revisions, music permissions, and website hosting must be agreed before production.

The film panel is an illustration of the planned format using a still photograph, not a play button or claim of a completed photographic video sample. The clickable sample is the actual interactive website. Its music uses opt-in official streaming embeds, not seamless licensed local audio. The landing page does not promise that unresolved soundtrack behavior is fixed.

## Media and skills

All photos shown depict the same fictional adult couple, generated earlier specifically for the demo. No original private customer media or API credentials were copied. No new image generation was purchased for this landing page.

Anthropic's frontend-design skill was downloaded from the official anthropics/skills GitHub repository through Hermes's skill installer, security-scanned SAFE, installed in the default profile as creative/frontend-design, and loaded before design. See DESIGN.md for the design plan. Existing claude-design and test-driven-development guidance also informed implementation and verification.

The fonts are local; their SIL Open Font License files are in assets/. The site itself makes no external requests before the visitor opens the sample and chooses streaming music.

## Verification

Run:

    /home/sanmi/.hermes/cache/scratch/gift-demo-env/bin/python test_landing.py

Five real Chrome/Playwright tests passed:

- Landing page and bundled sample open successfully.
- A filled brief produces a downloadable file containing the actual entered information without sending an order.
- Mobile menu and format preselection work.
- Required fields prevent an empty brief download.
- Images/fonts load and no horizontal document overflow or JavaScript errors occur at 320, 390, 600, 768, 1024, and 1440 pixels; dialog remains within viewport width.

Actual desktop and mobile screenshots were inspected. QA captures are in /home/sanmi/.hermes/cache/scratch/landing-qa/ (temporary scratch, not required by the site).

## Before public launch

Confirm the brand name and copy; finalize pricing/scope/revisions; connect real intake/email and secure media storage; define privacy, retention and hosting terms; resolve direct-audio rights and playback; add checkout only after terms are agreed. This page is not deployed publicly.
