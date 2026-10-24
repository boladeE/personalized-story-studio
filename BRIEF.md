# Implementation brief

## What we are making

A small Nigeria-focused digital-gifting studio: turn someone's photos, clips, messages, songs, and personal memories into a thoughtful interactive website or downloadable film. Human creative direction and customer approval stay central. Start with a few paid projects, not a fully automated self-service platform.

The user leads business/marketing/customer operations; their creative friend is the proposed creative/production lead. Partnership details are not finalized. Current price hypothesis: ₦30,000 upwards, subject to scope and validation. Website ordering and email communication are proposed; no WhatsApp-first funnel.

## Input checklist

1. Selected photos.
2. Selected video clips.
3. Music choices and usable/cleared audio.
4. Occasion: birthday, proposal, anniversary, or another milestone.
5. Visual style and emotional tone, separate from the occasion.
6. People: sender, recipient, nicknames, relationship.
7. Specific memories, inside jokes, habits, messages, and stories. The customer need not write a complete script.
8. Ending/reveal/action, with genuine choice and no covert response collection.
9. Output format, target date, sharing/privacy preferences, and hosting requirements.
10. Permissions for production/AI processing where relevant; separate marketing consent.

## Current baseline

The landing page is a public Railway preview with a bundled copy of the photographic v2 demo. The standalone v2 demo is local. There is no real intake backend, storage, payment processing, or completed photographic video export. The illustrated first demo was rejected and remains historical.

The original reference's music was implemented through preloaded hosted MP3s, an AudioContext unlocked by the opening click, per-track gains, and fades. The v2 substitute uses official YouTube embeds and a local-file selector. The user reported sound not playing; seamless soundtrack behavior remains unresolved, not verified.

## First task for Codex

Scope and build a proper direct-audio path for the preferred interactive demo, once an authorized playable audio fixture is available. Do not redesign the storefront or build the full platform as part of this task.

- Reproduce the current sound issue and establish a playback test before changing the implementation.
- Start/unlock audio in the actual admission-click gesture, report failures clearly, and keep a functioning mute control.
- Support deliberate scene-to-track mapping with transitions appropriate to the story, without restarting the same track unnecessarily.
- Use an authorized test file. If no file is provided, ask for one or propose an explicitly approved licensed source. Do not download a copyrighted song from the reference or rip a stream.
- Verify audio decoding and increasing playback time after a real click, mute/unmute, navigation, missing-file failure, and mobile behavior. Ask for a human listening check; don't equate a DOM state with audible output.
- Update the landing page's bundled sample too, or propose a small consolidation to prevent duplicate copies drifting.
- Keep public fictional-media disclosure and the personal photographic direction. Preserve the existing visuals unless a change is necessary for the scoped task.

Completion means tests backed by actual playback progress, a usable preview, and an honest account of remaining rights/browser/audio limitations. No automatic publishing or vault edits.

## Discussion references (read-only)

/home/sanmi/Documents/Obsidian_vault/Projects/Personalized Story Studio/Partnership Proposal.md
/home/sanmi/Documents/Obsidian_vault/Projects/Personalized Story Studio/Research and Production Plan.md

The latest proposal and this handoff supersede older conflicting research recommendations. Bring material pricing, scope, branding, and business changes back to the user rather than deciding them during coding.
