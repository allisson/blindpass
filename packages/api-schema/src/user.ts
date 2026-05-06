import { z } from 'zod';
import {
  AuthenticatorCodeSchema,
  Base64StringSchema,
  EncryptedValueSchema,
  RegisterRequestSchema,
  UsernameSchema,
} from './auth.js';

export const LookupByUsernameQuerySchema = z.object({
  username: UsernameSchema,
});

export const LookupByEmailQuerySchema = LookupByUsernameQuerySchema;

export const KeysResponseSchema = RegisterRequestSchema.omit({
  username: true,
  encryptedVaultKey: true,
  encryptedVaultData: true,
  recoveryVerifier: true,
});

export const UpdateKeysRequestSchema = RegisterRequestSchema.omit({
  username: true,
  encryptedVaultKey: true,
  encryptedVaultData: true,
  recoveryVerifier: true,
});

export const ChangePasswordRequestSchema = z.object({
  authenticatorCode: AuthenticatorCodeSchema,
  kekSalt: Base64StringSchema,
  encryptedMasterKey: EncryptedValueSchema,
});

export const DeleteAccountRequestSchema = z.object({
  authenticatorCode: AuthenticatorCodeSchema,
});

export const RotateRecoveryPhraseRequestSchema = z.object({
  authenticatorCode: AuthenticatorCodeSchema,
  publicKey: Base64StringSchema,
  encryptedMasterKeyForRecovery: EncryptedValueSchema,
  encryptedPrivateKey: EncryptedValueSchema,
  encryptedRecoveryKey: EncryptedValueSchema,
  recoveryVerifier: Base64StringSchema,
});

export type LookupByUsernameQuery = z.infer<typeof LookupByUsernameQuerySchema>;
export type LookupByEmailQuery = z.infer<typeof LookupByEmailQuerySchema>;
export type KeysResponse = z.infer<typeof KeysResponseSchema>;
export type UpdateKeysRequest = z.infer<typeof UpdateKeysRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;
export type RotateRecoveryPhraseRequest = z.infer<typeof RotateRecoveryPhraseRequestSchema>;
