import type { FieldErrors, FieldValues } from 'react-hook-form';

export type ErrorMap = Record<string, { message?: string } | undefined>;

export function asErrorMap<T extends FieldValues>(errors: FieldErrors<T>): ErrorMap {
  return errors as unknown as ErrorMap;
}
