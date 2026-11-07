# Option 3 — design and functional QA

final result: passed

## Visual target and evidence

The selected third mockup is the visual source of truth: `design/option3-reference.png` (1487 × 1058 pixels). This replaces the earlier green/cream newsroom interpretation.

Final implementation: `test-results/option3-desktop.png`, NFL sample, Bills at Chiefs, page top, closed filters. Source and implementation were opened together in the same comparison input after the final visual fixes. The in-app browser used a 1502 × 1068 CSS viewport, with 1487 pixels of document width after its scrollbar. Its screenshot is 1487 × 1057 pixels; the one-pixel bottom difference is capture rounding, with no image stretching. Earlier iterations were checked at 1440 × 1024 and 1487 × 1058 CSS viewports.

Additional evidence:
- `test-results/option3-mobile.png`: initial NFL view, 390 × 844 CSS viewport.
- `test-results/option3-mobile-props.png`: player filters and horizontally scrollable table at the same phone size.
- `test-results/option3-live.png`: live NBA player props and completed averages, including data-age notices.

The full-size comparison made the masthead, hero, logos, table headings, prices, and player identities readable. The mobile table was also inspected separately at close scale. No additional cropped comparison was necessary.

## Findings and fixes

1. **P1 resolved — visual direction.** The previous green/cream design did not match the selected image. Replaced it with the compact white masthead, navy NBA/NFL bar, scoreboard strip, stadium panorama, blue/red matchup panels with diagonal edges, and two-column game-lines/player-props desk.
2. **P2 resolved — scale and hierarchy.** The first rendered comparison had undersized logos and a small masthead. Increased official logos, condensed display typography, the matchup headline, and broad section headings. Corrected the compact header and hero height.
3. **P2 resolved — vertical density.** The first prop implementation repeated headings/table headers and pushed key rows below the fold. Consolidated the prop rows into one table with the market named on each player row. Moved optional player filters behind a button, compacted comparison notes, and corrected row spacing. The final capture shows the same three primary players and both desk columns together.
4. **P2 resolved — responsive and longer names.** Checked 390-pixel phone layout, confined horizontal scrolling to the scoreboard and prop table, and added smaller headline/team styles for longer names. Measured document width: 375 pixels inside the 390-pixel browser viewport, with no page overflow.

No open P0/P1/P2 findings remain.

## Required fidelity surfaces

- **Typography:** locally hosted Barlow Condensed ExtraBold/Italic supplies the sports masthead, hero and numeric tables; broad bold section headings reproduce the reference hierarchy. Body/action text uses Barlow. Display size and row density were corrected through rendered comparison.
- **Spacing/layout:** 72-pixel masthead, 42-pixel league bar, compact scoreboard, 82-pixel stadium banner, 176-pixel matchup panel, then action controls and the split desk. Real status/filter controls add modest spacing; the main regions and visible content match the selected composition.
- **Colors:** white page, navy navigation, blue actions and Bills panel, red Chiefs panel, subtle gray table headers/rules. Other matchups use official team colors with dark text for bright primary colors.
- **Images:** all 62 team identities use locally hosted ESPN logos. Seven player portraits are local real photographs, and the two generated stadium panoramas fit their narrow banner slot. No broken images were found in either league. The photographs and official logo variants differ from the generated mockup while preserving subject, treatment, and placement.
- **Copy/content:** page labels match the matchup-center purpose. Sample prices, rosters, and averages are explicitly identified. The date is current. Every mixed-market prop row names its market. Historical averages show actual available game counts and dates.

## Necessary functional differences from the mockup

- SIDE displays Over/Under or Yes/No; a team logo would not identify the quoted betting outcome.
- Totals retain separate Over and Under quotes and bookmaker attribution. Sample book names/prices come from the supplied fixtures; mockup artwork is not treated as a live source of odds.
- Multiple checked market pills accurately reflect multiple selected requests. More markets exposes the full original selection without a hard cap.
- Additional returned rows remain available below the initial view. No real results are removed to fit the mockup.
- Session controls remain in the header disclosure. Player/team filters are accessible through labeled buttons.

## Functional verification

- Both league tabs, corresponding arena/banner, team logos/colors, and isolated sample/live state.
- Player-name search, Over/Under/both-side filter, additional market expansion, and team-search empty state with Clear filters recovery.
- Editing Josh Allen's sample passing average to 263.3 updated both sides; restored to 263.2. The value persisted through reload.
- Live NBA schedule + lines returned 11 matchups; the earliest matchup was selected automatically. Three prop markets rendered 138 Over rows. Computing averages filled 39 player-market values from SportsDataverse / hoopR, preserved existing entries, and displayed older-data notices. Filtered Jokic rows showed populated averages.
- The existing prior NBA/NFL endpoint and game-log verification remains applicable; the backend data adapters were preserved.
- Browser console check: no errors or warnings. No missing local images in checked views.
- `npm test`: 11/11 passed, including expanded public module, PNG/font MIME, private-file and asset-traversal checks. Syntax checks passed for server, statistics adapter, app, matchup renderer, samples, and asset downloader.
- `.env` remains backend-only. No browser API-key entry, automatic odds polling, new market cap, or new quota restriction was added.

## Follow-up polish / limits

P3: bookmaker brand marks and the mockup's small decorative session/arrow icons are omitted; text labels preserve their meaning. Official photo/logo variants and the generated stadium framing differ slightly from the image. These do not block use or change the selected visual direction.

The site is running locally, not publicly deployed. Manual averages remain browser-local. Third-party data coverage and recency depend on providers. This was browser, integration, and automated security regression verification, not an external penetration test.

## Completed checklist

- Exact third visual target stored and compared with the final browser capture.
- P1/P2 visual findings fixed and rechecked.
- Desktop, phone, sample, and live workflows verified.
- Backend credentials and original usage controls preserved.
- Local preview remains running for review.
