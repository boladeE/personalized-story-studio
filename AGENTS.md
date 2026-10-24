# Coding-agent handoff

## Workspace boundary

- Work only in /home/sanmi/Documents/Work/personalized-story-studio unless explicitly authorized otherwise.
- This is the implementation session. Personal-life brainstorming and business decisions belong in the user's separate Hermes conversation.
- Business notes live at /home/sanmi/Documents/Obsidian_vault/Projects/Personalized Story Studio/. Read only the relevant project notes when needed; do not roam the vault or edit it automatically.
- Keep technical progress, test results, and implementation decisions here. Return a short handoff when a business decision is needed; do not assume other agents share this conversation.

## Source of truth

Read README.md and BRIEF.md before changing anything. Within the Obsidian project, Partnership Proposal.md is the latest working proposal; older research/drafts include superseded channel, price, and scope ideas. Commercial terms, pricing, and partnership arrangements are proposals, not established commitments.

## Product and creative guardrails

- The offer is a done-for-you personal story, initially interactive websites and downloadable videos. Storybooks are later.
- Preserve what makes the photographic demo personal: specific memories, affectionate teasing, real people in customer orders, and deliberate music. Do not replace this with generic vector scenes or synthesized music merely for easier export.
- Public demos use clearly disclosed fiction and permitted/generated media. Never reuse the original private reference's people, messages, images, clips, or biography.
- Demos/For Zara is a rejected historical direction, preserved for reference. Demos/For Zara v2 is the preferred creative baseline.
- Little Things is a working name; ₦30,000+ is a pilot hypothesis. Do not turn them into a finalized brand or market-validated offer.
- Website/email is the proposed customer flow, not WhatsApp. No invented testimonials, traction, availability, delivery guarantees, or successful order confirmations.

## Engineering and privacy

- Make scoped changes, preserve existing work, test actual behavior, and report limitations plainly.
- The landing page's brief is local-only. Do not add real uploads, payments, email, analytics, external API calls, or public deployment without authorization.
- Keep credentials outside source and client bundles. Do not retrieve or reuse API keys from chat history. Ask for proper environment configuration if a task needs a credential.
- Music rights and playback are separate concerns. Use authorized audio supplied for the task or approved licensed assets. Do not rip audio, copy the reference's MP3s, or treat a streaming embed as permission for an MP4 soundtrack.
- A loaded iframe is not evidence of playing sound. Test the real start gesture, decoding, playback time advancement, mute, and track changes. Distinguish that from human audible verification.
- The landing page bundles a separate copy of v2 under Landing Page/sample; account for this when changing the demo. Do not let the visible sample silently drift.
- Python bytecode, virtual environments, credentials, and private customer media do not belong in Git. Respect .gitignore.

## Skills

Use frontend-design for frontend changes when available. A project-local copy is in .agents/skills/frontend-design/ so the design guidance is not confined to Hermes. Read its SKILL.md before design work.

## Reporting

Give the user a short report: what changed, what actually passed, and what remains blocked. Do not claim sound, delivery, uploads, or deployment work from configuration-only tests. Do not commit, push, or publish without a request.
