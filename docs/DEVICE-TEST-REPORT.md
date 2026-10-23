# Device coverage — 23 October 2026

## Physical devices

Not tested: the user confirmed that no physical phone or tablet is available. No Android/iOS hardware, mobile Safari, touch hardware, virtual keyboard, device thermals, or real Alexa device results are claimed. The app currently binds to desktop loopback; a phone cannot use its own localhost to reach this desktop instance.

## Browser responsive checks completed

The actual app was checked in the in-app Chromium browser at 320x568, 390x844, 768x1024 and 844x390, in addition to the earlier desktop 1280x720 and compact 775x668 checks. These are viewport checks, not device or mobile browser emulation.

- No horizontal page overflow at any checked size.
- Source library and saved-plan controls remained available. The message send control measured 44 px wide.
- At 390x844, the saved-plan dialog displayed all three sample saved entries. Escape dismissed the native modal.
- Browser reduced-motion preference was enabled; all four decorative shapes computed to animation-name none.
- The actual model generated five exact-source topics in 7,792 ms. Time revision produced 60/45/60 budgets. Canceling review kept two saved plans; explicit save increased the count to three and saved revision 2.
- Current source, revision, save confirmation and MCP activity screenshots were captured for the final walkthrough.

Evidence: docs/screenshots/01-draft.png through 06-mcp.png; outputs/DocuFlow-Device-Checks.json and DocuFlow-Device-Dialog.png in the task workspace. Normal-motion background keyframes are rendered deterministically in the demo framing; app screenshots are still captures. This is not a screen recording.

## Physical-device follow-up when hardware is available

Use a supported deployment or run the app locally on the target computer; do not assume desktop localhost is reachable from a phone. Check text and controls at default and enlarged text sizes, file upload through the native picker, portrait/landscape orientation, soft keyboard visibility around the composer, modal scrolling/closing, source quotes, saving/reopening after restart, and reduced-motion settings. Record device model, OS/browser versions, failures and screenshots. A mobile-ready layout alone does not establish phone hosting or mobile Safari compatibility.
