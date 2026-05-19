import { z } from 'zod';

export const Base64StringSchema = z
  .string()
  .min(1)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, 'must be base64');

export const UsernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_]+$/, 'must contain only lowercase letters, numbers, and underscores');

export const AuthenticatorCodeSchema = z
  .string()
  .length(6)
  .regex(/^\d{6}$/, 'must be 6 digits');

export const EncryptedValueSchema = z.object({
  ciphertext: Base64StringSchema,
  nonce: Base64StringSchema,
});

export const RegisterRequestSchema = z.object({
  username: UsernameSchema,
  kekSalt: Base64StringSchema,
  publicKey: Base64StringSchema,
  encryptedMasterKey: EncryptedValueSchema,
  encryptedMasterKeyForRecovery: EncryptedValueSchema,
  encryptedPrivateKey: EncryptedValueSchema,
  encryptedRecoveryKey: EncryptedValueSchema,
  encryptedVaultKey: EncryptedValueSchema,
  encryptedVaultData: EncryptedValueSchema,
  recoveryVerifier: Base64StringSchema,
});

export const TotpEnrollmentSchema = z.object({
  enrollmentId: z.uuid(),
  setupKey: Base64StringSchema,
  otpauthUri: z.string().url(),
  expiresAt: z.string().datetime(),
});

export const RegisterResponseSchema = z.object({
  enrollment: TotpEnrollmentSchema,
});

export const CompleteRegistrationRequestSchema = z.object({
  username: UsernameSchema,
  enrollmentId: z.uuid(),
  authenticatorCode: AuthenticatorCodeSchema,
});

export const AuthSessionBundleSchema = z.object({
  publicKey: Base64StringSchema,
  kekSalt: Base64StringSchema,
  encryptedMasterKey: EncryptedValueSchema,
  encryptedMasterKeyForRecovery: EncryptedValueSchema,
  encryptedPrivateKey: EncryptedValueSchema,
  encryptedRecoveryKey: EncryptedValueSchema,
});

export const CompleteRegistrationResponseSchema = AuthSessionBundleSchema;

export const StartLoginRequestSchema = z.object({
  username: UsernameSchema,
});

export const StartLoginResponseSchema = z.object({
  message: z.string(),
});

export const CompleteLoginRequestSchema = z.object({
  username: UsernameSchema,
  authenticatorCode: AuthenticatorCodeSchema,
});

export const CompleteLoginResponseSchema = z.object({
  message: z.string(),
});

export const StartRecoveryRequestSchema = z.object({
  username: UsernameSchema,
});

export const StartRecoveryResponseSchema = z.object({
  message: z.string(),
});

export const VerifyRecoveryRequestSchema = z.object({
  username: UsernameSchema,
  recoveryVerifier: Base64StringSchema,
});

export const VerifyRecoveryResponseSchema = z.object({
  recoveryToken: z.string(),
  enrollment: TotpEnrollmentSchema,
  bundle: AuthSessionBundleSchema,
});

export const CompleteRecoveryRequestSchema = z.object({
  username: UsernameSchema,
  recoveryToken: z.string(),
  enrollmentId: z.uuid(),
  authenticatorCode: AuthenticatorCodeSchema,
  kekSalt: Base64StringSchema,
  publicKey: Base64StringSchema,
  encryptedMasterKey: EncryptedValueSchema,
  encryptedMasterKeyForRecovery: EncryptedValueSchema,
  encryptedPrivateKey: EncryptedValueSchema,
  encryptedRecoveryKey: EncryptedValueSchema,
  recoveryVerifier: Base64StringSchema,
});

export const CompleteRecoveryResponseSchema = AuthSessionBundleSchema;

export const StartTotpRotationRequestSchema = z.object({
  authenticatorCode: AuthenticatorCodeSchema,
});

export const StartTotpRotationResponseSchema = z.object({
  enrollment: TotpEnrollmentSchema,
});

export const CompleteTotpRotationRequestSchema = z.object({
  enrollmentId: z.uuid(),
  authenticatorCode: AuthenticatorCodeSchema,
});

export const BiometricCredentialSchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const RegisterBiometricCredentialRequestSchema = z.object({
  credentialId: Base64StringSchema,
  label: z.string().max(255).optional(),
});

export const RegisterBiometricCredentialResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const ListBiometricCredentialsResponseSchema = z.object({
  credentials: z.array(BiometricCredentialSchema),
});

export const SessionSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime(),
  userAgent: z.string().nullable(),
  isCurrent: z.boolean(),
});

export const ListSessionsResponseSchema = z.object({
  sessions: z.array(SessionSchema),
});

export type EncryptedValue = z.infer<typeof EncryptedValueSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type CompleteRegistrationRequest = z.infer<typeof CompleteRegistrationRequestSchema>;
export type CompleteRegistrationResponse = z.infer<typeof CompleteRegistrationResponseSchema>;
export type StartLoginRequest = z.infer<typeof StartLoginRequestSchema>;
export type StartLoginResponse = z.infer<typeof StartLoginResponseSchema>;
export type CompleteLoginRequest = z.infer<typeof CompleteLoginRequestSchema>;
export type CompleteLoginResponse = z.infer<typeof CompleteLoginResponseSchema>;
export type StartRecoveryRequest = z.infer<typeof StartRecoveryRequestSchema>;
export type StartRecoveryResponse = z.infer<typeof StartRecoveryResponseSchema>;
export type VerifyRecoveryRequest = z.infer<typeof VerifyRecoveryRequestSchema>;
export type VerifyRecoveryResponse = z.infer<typeof VerifyRecoveryResponseSchema>;
export type CompleteRecoveryRequest = z.infer<typeof CompleteRecoveryRequestSchema>;
export type CompleteRecoveryResponse = z.infer<typeof CompleteRecoveryResponseSchema>;
export type StartTotpRotationRequest = z.infer<typeof StartTotpRotationRequestSchema>;
export type StartTotpRotationResponse = z.infer<typeof StartTotpRotationResponseSchema>;
export type CompleteTotpRotationRequest = z.infer<typeof CompleteTotpRotationRequestSchema>;
export type TotpEnrollment = z.infer<typeof TotpEnrollmentSchema>;
export type AuthSessionBundle = z.infer<typeof AuthSessionBundleSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type ListSessionsResponse = z.infer<typeof ListSessionsResponseSchema>;
export type BiometricCredential = z.infer<typeof BiometricCredentialSchema>;
export type RegisterBiometricCredentialRequest = z.infer<
  typeof RegisterBiometricCredentialRequestSchema
>;
export type RegisterBiometricCredentialResponse = z.infer<
  typeof RegisterBiometricCredentialResponseSchema
>;
export type ListBiometricCredentialsResponse = z.infer<
  typeof ListBiometricCredentialsResponseSchema
>;
