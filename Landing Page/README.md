# Little Things Digital landing page

A shareable storefront preview for the personalized digital-gifting studio. The user has confirmed the business name Little Things Digital and owns littlethingsdigital.com. Offer terms shown on the page remain pilot proposals.

## Public preview

https://landing-page-production-ddee.up.railway.app/

Railway serves this directory as a static site. The bundled sample is at `/sample/`. This service was deployed from the `Landing Page/` directory with `railway up -y`; it is not connected to GitHub for automatic deployments. Run `railway up` from this directory after future changes. `.dockerignore` keeps tests and internal design notes out of the served build.

## Local preview

    python -m http.server 8768 --bind 127.0.0.1

Open http://127.0.0.1:8768/ . The page also opens directly from index.html; HTTP is preferable for the embedded sample's optional external music player.

## Included

- Redesigned (Nov 2026) for the confirmed name Little Things Digital. See DESIGN.md for tokens and rationale.
- Hero with a short fictional "quick moment" that reveals line by line, with replay and a reduced-motion fallback.
- Six occasion groups from the partner's Product Offerings proposal. Selecting one updates the example moments and presets the brief.
- The bundled fictional photographic Zara/Tobi sample at sample/, with its real chapter list.
- Quick moment vs full story, website/video/both comparison, and extras being explored, all labelled as pilot proposals.
- Four-step process, FAQ, accessible native-dialog brief (occasion, size, format) that downloads a text file.
- Fonts are self-hosted: Bricolage Grotesque (subset woff2) and Bodoni Moda italic, with OFL files in assets/. `dm-sans.ttf` and `bodoni-regular.ttf` are no longer referenced by the landing page but were left in place.

## Honest prototype limits

The form does not submit orders, upload media, send email, collect payments, or claim a booking. It generates a text file on the visitor's device and states this before use. Nothing is stored in localStorage or sent to a backend. The browser may retain fields for the current page session; closing and reopening the dialog preserves that draft until reload.

The pilot price is a starting hypothesis from the proposal, not validated pricing or a fixed all-inclusive offer. Scope, delivery timing, revisions, music permissions, and website hosting must be agreed before production.

The film panel is an illustration of the planned format using a still photograph, not a play button or claim of a completed photographic video sample. The clickable sample is the actual interactive website. Its music uses opt-in official streaming embeds, not seamless licensed local audio. The landing page does not promise that unresolved soundtrack behavior is fixed.

## Media and skills

All photos shown depict the same fictional adult couple, generated earlier specifically for the demo. No original private customer media or API credentials were copied. No new image generation was purchased for this landing page.

Anthropic's frontend-design skill was downloaded from the official anthropics/skills GitHub repository through Hermes's skill installer, security-scanned SAFE, installed in the default profile as creative/frontend-design, and loaded before design. See DESIGN.md for the design plan. Existing claude-design and test-driven-development guidance also informed implementation and verification.

The fonts are local; their SIL Open Font License files are in assets/. The site itself makes no external requests before the visitor opens the sample and chooses streaming music.

## Verification

Run (system Python with Playwright and Chrome at /usr/bin/google-chrome):

    python3 test_landing.py

Ten tests: the sample opens to its admission ticket; the bundled sample is byte-identical to Demos/For Zara v2; the hero moment reveals and replays; reduced motion shows it complete; occasion selection updates examples and presets the brief; a filled brief downloads with the entered values and makes no POST or data-bearing request; mobile menu and size/format preselection; required fields block download; no third-party requests; no overflow, image failures, or JS errors at 320–1440px with the dialog inside the viewport.

## Before taking orders

Finalize pricing/scope/revisions; connect real intake/email and secure media storage; define privacy, retention and hosting terms; resolve direct-audio rights and playback; add checkout only after terms are agreed. The public preview does not take orders.
