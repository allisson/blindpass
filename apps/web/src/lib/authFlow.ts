import type { Keychain } from '@blindpass/crypto';
import type { AuthSessionBundle, TotpEnrollment } from '@blindpass/api-schema';
import type { Session } from './session';

interface RegisterPending {
  username: string;
  enrollment: TotpEnrollment;
  keychain: Keychain;
  recoveryKey: string;
}

interface LoginPending {
  username: string;
  password: string;
}

type PendingSession = Session;

interface RecoveryPending {
  username: string;
  recoveryToken: string;
  enrollment: TotpEnrollment;
  bundle: AuthSessionBundle;
}

let _register: RegisterPending | null = null;
let _login: LoginPending | null = null;
let _loginTimeout: ReturnType<typeof setTimeout> | null = null;
let _pendingSession: PendingSession | null = null;
let _recoveryKey: string | null = null;
let _recovery: RecoveryPending | null = null;

export const authFlow = {
  setRegister: (s: RegisterPending) => {
    _register = s;
  },
  getRegister: () => _register,
  clearRegister: () => {
    _register = null;
  },
  setLogin: (s: LoginPending) => {
    if (_loginTimeout !== null) {
      clearTimeout(_loginTimeout);
    }
    _login = s;
    _loginTimeout = setTimeout(() => {
      authFlow.clearLogin();
    }, 60 * 1000);
  },
  getLogin: () => _login,
  clearLogin: () => {
    if (_loginTimeout !== null) {
      clearTimeout(_loginTimeout);
      _loginTimeout = null;
    }
    _login = null;
  },
  setPendingSession: (s: PendingSession) => {
    _pendingSession = s;
  },
  getPendingSession: () => _pendingSession,
  clearPendingSession: () => {
    _pendingSession = null;
  },
  setRecoveryKey: (key: string) => {
    _recoveryKey = key;
  },
  getRecoveryKey: () => _recoveryKey,
  clearRecoveryKey: () => {
    _recoveryKey = null;
  },
  setRecovery: (s: RecoveryPending) => {
    _recovery = s;
  },
  getRecovery: () => _recovery,
  clearRecovery: () => {
    _recovery = null;
  },
};
