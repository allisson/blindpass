import type { FastifyReply } from 'fastify';
import type {
  RegisterUserFailure,
  CompleteRegistrationFailure,
} from '../../auth/registration/service.js';
import type { CompleteLoginFailure } from '../../auth/login/service.js';
import type {
  VerifyRecoveryFailure,
  CompleteRecoveryFailure,
} from '../../auth/recovery/service.js';
import type {
  ChangePasswordFailure,
  RotateRecoveryPhraseFailure,
  DeleteAccountFailure,
} from '../../auth/account/service.js';
import type {
  StartRotationFailure,
  CompleteRotationFailure,
} from '../../auth/totp-rotation/service.js';

export type AuthFailureReason =
  | RegisterUserFailure
  | CompleteRegistrationFailure
  | CompleteLoginFailure
  | VerifyRecoveryFailure
  | CompleteRecoveryFailure
  | ChangePasswordFailure
  | RotateRecoveryPhraseFailure
  | DeleteAccountFailure
  | StartRotationFailure
  | CompleteRotationFailure;

type StatusEntry = [status: number, message: string];

const DEFAULTS: Record<AuthFailureReason, StatusEntry> = {
  registrations_disabled: [403, 'registrations_disabled'],
  username_taken: [409, 'Conflict'],
  not_provisioned: [400, 'Account not fully provisioned'],
  invalid_enrollment: [400, 'Invalid or expired enrollment'],
  invalid_credentials: [400, 'Invalid credentials'],
  invalid: [400, 'Invalid recovery completion'],
  invalid_authenticator: [400, 'Invalid authenticator code'],
  admin_user_protected: [403, 'admin_user_protected'],
  user_not_found: [404, 'Not found'],
};

/**
 * Sends an error reply for an auth ServiceResult failure. Call inside an
 * `if (!result.ok)` guard so TypeScript can narrow the success branch:
 *
 *   if (!result.ok) return sendAuthFailure(reply, result.reason);
 *
 * Pass `extra` to map additional reasons or override defaults.
 */
export function sendAuthFailure(
  reply: FastifyReply,
  reason: AuthFailureReason | undefined,
  extra: Record<string, StatusEntry> = {},
): FastifyReply {
  const map: Record<string, StatusEntry> = { ...DEFAULTS, ...extra };
  const entry = reason !== undefined ? map[reason] : undefined;
  const [status, error] = entry ?? [500, 'Internal server error'];
  return reply.status(status).send({ error });
}
