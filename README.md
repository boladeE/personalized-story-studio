# Personalized Story Studio

Implementation workspace for a Nigerian personalized digital-gifting studio. Open Codex in this directory and read AGENTS.md and BRIEF.md first.

## Separation of responsibilities

This folder contains implementation: code, assets, demos, tests, and technical notes.

Planning and business discussion remain in:

    /home/sanmi/Documents/Obsidian_vault/Projects/Personalized Story Studio/

Use the relevant notes as read-only context unless the user explicitly asks to edit them. The latest Partnership Proposal.md takes precedence over older research and discussion drafts.

## Existing work

- Landing Page/ — working Little Things storefront concept, an unconfirmed brand name. Local-only brief download, not a live order form. Includes a bundled copy of the photographic sample in sample/.
- Demos/For Zara v2/ — preferred photo-led fictional birthday experience, seven consistent generated photographs, 14 scenes. Its YouTube soundtrack is not equivalent to seamless background audio and the user reported sound not playing.
- Demos/For Zara/ — preserved historical illustrated demo and MP4. The user rejected this creative direction; do not treat it as the target product or promote it as the current sample.

Folder names were preserved during migration to avoid unnecessary code churn. The landing page and v2 demo currently duplicate static assets and sample code; keep copies in sync if changing the sample, or propose consolidation before restructuring.

## Preview

From the project root:

    python -m http.server 8768 --bind 127.0.0.1 --directory "Landing Page"

Open http://127.0.0.1:8768/ . Its sample link uses the bundled sample and does not depend on another server.

For the standalone preferred demo:

    python -m http.server 8767 --bind 127.0.0.1 --directory "Demos/For Zara v2"

Open http://127.0.0.1:8767/ . Both are local-only, not publicly deployed.

## Tests

Optional project-local setup:

    python -m venv .venv
    .venv/bin/pip install -r requirements-dev.txt
    .venv/bin/python "Landing Page/test_landing.py"
    .venv/bin/python "Demos/For Zara v2/test_gift_v2.py"
    node --test "Demos/For Zara/story.test.cjs"

The browser tests currently expect Google Chrome at /usr/bin/google-chrome. They launch isolated headless browsers and their own temporary HTTP ports. On this machine an existing helper environment is also available at /home/sanmi/.hermes/cache/scratch/gift-demo-env/bin/python; it is temporary tooling, not part of the deliverable.

## Next

See BRIEF.md for the first implementation task and acceptance criteria. Do not build a platform, payment system, or broad automation pipeline without a new scoped request. No API key is required to run any existing page.
