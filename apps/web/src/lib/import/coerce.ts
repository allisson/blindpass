import { VaultItemSchema } from '@blindpass/vault';
import type { CustomField, VaultItem } from '@blindpass/vault';

export interface CoerceArgs {
  categoryName?: string;
  title: string;
  customFields: CustomField[];
  sourceNotes?: string;
  extraContent?: string;
}

export function coerceToSecureNote(args: CoerceArgs): VaultItem | null {
  const baseTitle = args.title.trim() || '(untitled)';
  const title = args.categoryName ? `[${args.categoryName}] ${baseTitle}` : baseTitle;
  const parts = [args.sourceNotes?.trim(), args.extraContent?.trim()].filter(
    (s): s is string => !!s,
  );
  const content = parts.join('\n\n');
  const payload: Record<string, unknown> = { type: 'secure_note', title, content };
  if (args.customFields.length) payload.customFields = args.customFields;
  const result = VaultItemSchema.safeParse(payload);
  return result.success ? result.data : null;
}
