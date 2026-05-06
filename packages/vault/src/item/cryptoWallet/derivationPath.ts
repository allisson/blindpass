const DERIVATION_PATH_RE = /^m(\/\d+'?)+$/;

export function isValidDerivationPath(p: string): boolean {
  return DERIVATION_PATH_RE.test(p);
}
