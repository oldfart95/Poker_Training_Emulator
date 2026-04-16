# UI Cleanup Follow-Up

## Observations

- The table now reads as the primary surface instead of competing with the surrounding study UI.
- The old equal-weight dashboard feel is reduced by collapsing room policy, recap, and analytics into utility panels.
- Seat cards are faster to scan because they now show only the essentials: name, position, stack, and archetype badge.
- Coaching is more respectful of flow because hints are available on demand instead of occupying permanent screen space.
- Replay remains visible and valuable without dominating the default practice layout.
- The onboarding copy is lighter, but the room guide still preserves deeper context when a player wants it.
- The premium dark cardroom aesthetic is stronger now that spacing, contrast, and surface hierarchy are doing more work than borders and text blocks.

## State And Architecture Notes

- Core hand logic, pacing, replay generation, and hint generation were preserved.
- Presentation responsibilities were split into reusable UI components under `src/components/TableLayout.tsx`.
- New UI state was added only for presentation concerns:
  - expanded top status card
  - open right-rail panel
  - opponent drawer visibility

## Follow-Up Recommendations

- Split `src/App.tsx` again into feature-level containers like `TableStage`, `UtilityRail`, and `ReplayView` now that the new layout is stable.
- Add subtle open/close motion for the drawer, hint popover, and recap panels to push the premium feel further.
- Fine-tune seat placement and overlay behavior for tablet widths so the table keeps maximum visual authority below desktop.
- Consider replacing the current seat-detail popover with richer hover/focus behavior on larger screens and a bottom sheet on mobile.
- If more study depth is needed later, keep adding it behind progressive disclosure rather than returning to always-open text sections.

## Commit Prep

- Current UI changes are localized to the main app shell, shared table layout components, styles, and trimmed onboarding copy.
- Build verification already passed with `npm run build`.
