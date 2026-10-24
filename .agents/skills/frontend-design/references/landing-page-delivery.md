# Landing-page delivery and honest local intake

Use for a service-business storefront or pilot landing page that must look finished while some production integrations are intentionally absent.

## 1. Establish the offer and the page's job

Read the latest proposal or product brief rather than earlier draft prices. Identify the intended customer, actual formats, current sample, primary CTA, contact channel, and which terms are still hypotheses. Separate occasion (birthday, anniversary, proposal) from visual style (cinema, scrapbook, playful); a selector must not confuse the two.

Keep the storefront distinct from the delivered product. A cinematic personal gift may justify a theatrical admission screen; the storefront should let a buyer understand the service and inspect that gift without first completing the same ceremony.

Create a compact design plan: named palette, deliberate type roles, composition, real copy, and one memorable visual gesture. Review it for generic template defaults before writing code. A temporary brand name is useful for a concept, but must not silently become the user's confirmed business identity.

## 2. Package only approved assets and working examples

Reuse existing approved fictional photographs and fonts before purchasing or generating new assets. Preserve the actual supplied media where the user values personal realism. Keep fiction/AI-media disclosure adjacent to samples rather than implying generated people are customers.

Copy the sample's required HTML, CSS, JavaScript, configuration, fonts, media, and license files into a relative `sample/` directory when portability matters. Avoid absolute filesystem URLs or links to another temporary preview port; they break when the storefront is moved or hosted. Do not copy credentials, private customer content, or unrelated production files.

Use a real link for an implemented sample. A still illustrating a planned video format must not have a fake play control or imply that a playable export already exists. Carry known sample limitations into the copy: linking a soundtrack with unresolved playback does not fix it.

Host fonts locally when offline portability or predictable preview rendering matters, and include their license files. Keep the page free of third-party media requests until the visitor opts into that service when practical.

## 3. Build the smallest useful intake flow

Use a native `dialog` with `showModal()` for a compact brief flow, named close control, Escape behavior, visible focus, viewport-constrained height, and scrollable content. Keep the form comfortably usable on narrow screens instead of shrinking every field to fit above the fold.

Preselect the occasion and format from the CTA the visitor actually chose. Collect only information needed to discuss the gift: sender, reply address, recipient/nickname, occasion, format, optional desired date, and a few specific memories. Invite incomplete notes rather than requiring a polished script. Defer private media uploads until a real secure sharing path is connected.

Give inputs explicit labels. For selects, prefer `label[for]` and an input `id`, or an explicit accessible name; nested option text can make exact-name browser locators disagree with the intended label.

Use native required/email validation before producing output. Render user text with `textContent` or into a plain-text export, never through `innerHTML`. Do not auto-save intimate stories or media references to localStorage; persist only harmless preferences by default, with an explicit choice for personal drafts.

Without a backend, state the local-only behavior before data entry and in the result. A real text download is a useful substitute for a dead submit button, not a submitted order:

```js
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const text = buildPlainTextBrief(values);
  const url = URL.createObjectURL(new Blob([text], {
    type: 'text/plain;charset=utf-8'
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Gift-Brief.txt';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  status.textContent = 'Your draft is ready. Nothing has been sent or booked.';
});
```

Do not invent an email address, checkout, secure storage policy, delivery guarantee, testimonials, customer count, or limited-slot scarcity to make the page feel complete. Present pilot price and timing as provisional until confirmed.

## 4. Verify behavior, visual quality, and privacy separately

Use the repository's test stack, or a small Playwright script with a local HTTP server for a standalone page. Develop one customer behavior at a time with a failing test before implementation; avoid writing a speculative pile of tests for an unbuilt UI.

Cover these seams:

- Follow the actual sample link and assert the sample's usable opening, not merely a successful href or HTTP response.
- Select an occasion, enter through a format-specific CTA, and assert the resulting form values.
- Fill a real brief, use `page.expect_download()`, read `download.path()`, and assert that the downloaded text contains the entered names, occasion, and story.
- Assert that empty/invalid required fields prevent the download.
- Monitor requests while submitting; local-only intake must not send POSTs or leak entered data through network URLs.
- Open the mobile menu, navigate from it, and verify menu closure, dialog focus/closing, and Escape handling.
- Test representative widths including a narrow phone, tablet, and desktop; assert document width fits and the modal stays within the viewport.
- Wait for lazy images and local fonts before screenshot review; check natural image dimensions, failed HTTP responses, and JavaScript errors.
- Inspect the actual hero, sample block, middle sections, and modal on desktop/mobile. Check face crops, text/photo overlap, line breaks, readable disclosures, and close controls; no-overflow assertions alone miss these defects.

Keep media playback acceptance separate from UI configuration. A loaded iframe or valid song identifier proves neither advancing playback nor audible output. Follow the soundtrack workflow in `claude-design` when sound is part of the brief.

## 5. Serve and hand off

For a standalone static preview, serve its directory bound to loopback:

```sh
python -m http.server PORT --bind 127.0.0.1
```

Choose an available port and verify the exact page returns successfully before opening it. On a desktop where `xdg-open` is appropriate, open the verified URL for the user. Do not deploy publicly without authorization.

Document startup commands, working assumptions, asset provenance, real test results, and remaining integrations in README/design files. Keep the final chat concise: preview URL or absolute artifact path, a short description, what passed, and the truthful boundary between a local prototype and a live service.
