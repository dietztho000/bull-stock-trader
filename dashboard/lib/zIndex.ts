/** Canonical stacking layers for the dashboard.
 *
 *  Tailwind `z-[N]` literals and `style={{ zIndex: N }}` are scattered
 *  across the codebase — this module centralizes the values everyone should
 *  reach for so a stray `z-[55]` doesn't end up wedged below an unrelated
 *  `z-[60]`. Audit T4.
 *
 *  Usage:
 *    import { Z } from "@/lib/zIndex";
 *    style={{ zIndex: Z.MODAL_OVERLAY }}
 *
 *  Higher number = closer to the user. Layers are in roughly the order they
 *  visually appear on top of each other.
 *
 *  Existing call sites we're aware of (kept consistent here so re-aligning
 *  later doesn't move things visually):
 *    - Sidebar nav:          20  (sticky aside)
 *    - Top toolbar:          30  (sticky header)
 *    - Mobile nav drawer:    40  (overlay) / 50 (panel)
 *    - Dropdowns / popovers: 40
 *    - Tile visibility menu: 50
 *    - Modals (overlays):    50–60
 *    - Mascot achievement:   55  (between modal overlay and modal panel)
 *    - Mascot modal:         60
 *    - App-wide toast stack: 100 (always on top, even above modals)
 */
export const Z = {
  /** Top toolbar — sticky header above page content. */
  TOOLBAR: 30,
  /** Side nav drawer overlay (mobile). */
  NAV_DRAWER: 40,
  /** Dropdowns and popovers (account selector, tile visibility menu). */
  POPOVER: 40,
  /** Modal background scrim. */
  MODAL_OVERLAY: 50,
  /** Mascot achievement toast — sits between modal scrim and panel so a
   *  newly-unlocked achievement doesn't flash on top of the mascot recap
   *  modal the user is actively reading. */
  MASCOT_TOAST: 55,
  /** Mascot recap modal — slightly above general modal stacks so it floats
   *  cleanly when triggered from a deeper page modal context. */
  MASCOT_MODAL: 60,
  /** App-wide toast stack — always on top of everything else, including
   *  modals (a toast for "saved" should never be hidden behind the modal
   *  the user just submitted from). */
  APP_TOAST: 100,
} as const;
