# Encrypted exports use a passphrase-derived key, not the vault key

Encrypted exports (`.blindpass`) derive their encryption key from a user-supplied passphrase via Argon2id, not from the **VaultKey**. This makes the file fully portable — it can be stored, shared, or restored on any device without requiring access to the account **Keychain**, and it survives master-password changes without becoming unreadable.

The trade-off is that security is bounded by passphrase strength rather than by the Argon2id-derived **VaultKey**. The UI nudges users toward the encrypted format and will warn if a weak passphrase is detected.

## Considered alternatives

Using the **VaultKey** to encrypt the export was rejected because the export file would silently become unreadable after a password rotation (**VaultKey** stays the same, but the ceremony that unlocks it changes), and it would require the vault to be unlocked at import time on the receiving device — defeating the purpose of a portable backup.
