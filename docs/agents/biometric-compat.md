# Biometric unlock — passkey provider compatibility

**Last verified:** 2026-05-10

BlindPass biometric unlock requires the WebAuthn **PRF** extension. PRF is implemented per **passkey provider** (the app or service that stores the credential), not per device. A platform may support WebAuthn — and even let the user create a passkey — without exposing PRF, in which case enrollment fails with `PrfNotEnabledError`.

## Support matrix

| Platform | Browser            | Provider                | PRF | Notes                                                                                                                                  |
| -------- | ------------------ | ----------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Android  | Chrome 120+        | Google Password Manager | ✅  | Primary supported path on Android.                                                                                                     |
| Android  | Chrome 120+        | Bitwarden               | ❌  | Verified — passkey is stored in Bitwarden's vault, but `getClientExtensionResults().prf.enabled` is `false`. Track Bitwarden upstream. |
| Android  | Chrome 120+        | 1Password               | ❌  | Unverified — assumed false based on third-party provider pattern. Re-verify when tested.                                               |
| Android  | Chrome 120+        | Samsung Pass            | ❌  | Unverified — assumed false. Re-verify when tested.                                                                                     |
| iOS      | Safari 18+         | iCloud Keychain         | ✅  | Supported.                                                                                                                             |
| iOS      | Safari 17.4–17.x   | iCloud Keychain         | ❌  | PRF added in 18. Probe returns `prf_unsupported` via `getClientCapabilities()` on most builds.                                         |
| iOS      | Chrome / others    | iCloud Keychain         | ✅  | All third-party iOS browsers run on WebKit; behaviour matches Safari.                                                                  |
| macOS    | Safari 18+         | iCloud Keychain         | ✅  | Supported.                                                                                                                             |
| macOS    | Chrome 116+ / Edge | iCloud Keychain (macOS) | ✅  | Chrome routes through the macOS platform authenticator.                                                                                |
| Windows  | Chrome / Edge      | Windows Hello           | ✅  | Requires a follow-up assertion to harvest PRF — handled in `apps/web/src/lib/biometric/webauthn.ts:128`.                               |
| Linux    | any                | —                       | ❌  | No platform authenticator. Probe returns `no_platform_authenticator`.                                                                  |

## Why a passkey can be saved but unlock still fails

On Android, `navigator.credentials.create()` is brokered by Credential Manager. The user selects a passkey provider from a system sheet **during** the ceremony, and the chosen provider may or may not honour the requested `prf` extension. If it doesn't:

- The passkey is created and saved in the provider's vault (Bitwarden, 1Password, …).
- The browser returns the credential to BlindPass.
- `cred.getClientExtensionResults().prf?.enabled` is `false`.
- `apps/web/src/lib/biometric/webauthn.ts` throws `PrfNotEnabledError` (no `BiometricEnrollment` record is written).

`probePrfSupport()` cannot predict this — the provider hasn't been picked yet when the probe runs. Treat the failure as a normal post-`create()` branch.

## Cleaning up an orphan passkey

When `PrfNotEnabledError` fires, a passkey was already saved in the user's password manager that BlindPass will never use. There is no Web API to delete it programmatically — the user must remove it manually:

- **Google Password Manager** — passwords.google.com → search the BlindPass RP ID → delete.
- **Bitwarden** — open Bitwarden → search BlindPass → edit item → delete passkey credential.
- **1Password** — open the BlindPass item → delete the passkey credential.
- **Samsung Pass** — Settings → Samsung Pass → Passkeys → BlindPass → delete.

The `BiometricUnlockSection` failure card surfaces the same instruction in-app.

## Updating this matrix

Provider support changes over time as third-party password managers ship PRF. To update a row:

1. Verify on a real device (`make dev`, navigate to settings, attempt enrollment with the target provider chosen in the Credential Manager sheet).
2. Inspect `cred.getClientExtensionResults().prf?.enabled` in DevTools.
3. Update the row, bump the **Last verified** date, and remove the `(unverified)` qualifier if applicable.

Chrome DevTools' Virtual Authenticator (DevTools → WebAuthn → Add) can simulate the success and failure branches without real hardware, but **does not** simulate the Android Credential Manager picker or per-provider extension behaviour.
