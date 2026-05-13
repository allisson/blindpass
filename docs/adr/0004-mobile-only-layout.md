# Web app uses a fixed mobile-width shell on all viewports

The web app renders inside a `max-width: 430px` centred container on every viewport. Desktop screens see the same mobile layout against a background fill. `VaultSidebar` and its responsive classes have been removed; the bottom tab bar is the sole navigation surface on every screen size.

A password manager is used primarily on the device you are logging into things with — a phone. Maintaining a separate desktop layout means keeping two navigation surfaces, two animation models, and two visual hierarchies in sync. In practice the desktop layout consistently lagged behind mobile quality. Removing it lets one layout be excellent instead of two being adequate. An operator who needs a desktop-first experience should consider the native-app path rather than expecting the web app to expand.

## Considered alternatives

- **Responsive layout** — keep the sidebar and a full-width desktop shell alongside the mobile layout. Rejected: ongoing maintenance cost, dual navigation models, and the desktop experience consistently trailing mobile quality.
