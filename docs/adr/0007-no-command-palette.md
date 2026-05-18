# No command palette and no keyboard-shortcut surface

The web app does not ship a command palette (`Cmd/Ctrl+K`) or a keyboard-shortcuts dialog. Filtering, navigation, and item actions are reachable only through the touch UI: the folder dropdown, the type filter pill, the search input, and the bottom tab bar.

This follows directly from [ADR-0004](0004-mobile-only-layout.md). The product runs in a fixed 430px shell; the primary device is a phone, where there is no keyboard and no `Cmd` key. A command palette is an answer to a question — "how do power users navigate a dense desktop UI fast?" — that BlindPass deliberately does not ask. Maintaining one means keeping a shadow IA in sync with the visible one, writing shortcut docs that 95% of users will never read, and tempting future contributors to add desktop-only features behind it.

A palette had existed (`CommandPalette.tsx`, `ShortcutsDialog.tsx`); both were removed in v0.8.0 along with the `CommandPaletteContext`. The type-filter pill and folder dropdown now cover the flows the palette was used for (jump-to-folder, filter-by-type).

## Considered alternatives

- **Keep the palette as a desktop-only affordance.** Rejected: contradicts ADR-0004's "one excellent layout" stance, and meant a second navigation model to test against the touch UI.
- **Keep `/` as a search-focus shortcut only.** Retained — `/` still focuses the search input. This is a single, discoverable hotkey, not a parallel navigation surface.
