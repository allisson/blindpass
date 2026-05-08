import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import {
  type CryptoWalletItem,
  type DeveloperCredentialItem,
  type VaultItem,
} from '@blindpass/vault';
import { useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useBlocker } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useSubmitShortcut } from '@/hooks/useSubmitShortcut';
import { CustomFieldsSection } from './CustomFieldsSection';
import { VAULT_ITEM_FIELDS_REGISTRY, type VaultItemType } from './item-fields';

interface Props {
  type: VaultItemType;
  defaultValues?: Partial<VaultItem>;
  onSubmit: (data: VaultItem) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

function buildInitialValues(
  type: VaultItemType,
  defaultValues?: Partial<VaultItem>,
): Partial<VaultItem> {
  if (type === 'developer_credential') {
    const dev =
      defaultValues?.type === 'developer_credential'
        ? (defaultValues as Partial<DeveloperCredentialItem>)
        : undefined;
    return { type, credentialMode: 'token', ...dev } as Partial<VaultItem>;
  }
  if (type === 'crypto_wallet') {
    const wallet =
      defaultValues?.type === 'crypto_wallet'
        ? (defaultValues as Partial<CryptoWalletItem>)
        : undefined;
    return { type, walletMode: 'bip39', ...wallet } as Partial<VaultItem>;
  }
  return { type, ...defaultValues } as Partial<VaultItem>;
}

export function ItemForm({ type, defaultValues, onSubmit, onCancel, submitLabel = 'Save' }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const initialValues = buildInitialValues(type, defaultValues);

  const entry = VAULT_ITEM_FIELDS_REGISTRY[type];
  const FieldsComponent = entry.Component;

  const methods = useForm<VaultItem>({
    resolver: standardSchemaResolver(entry.schema as StandardSchemaV1<VaultItem>),
    defaultValues: initialValues,
  });
  const {
    register,
    handleSubmit,
    formState: { errors: _errors, isSubmitting, isDirty },
  } = methods;
  const errors = _errors as Record<string, { message?: string } | undefined>;

  const discardConfirmed = useRef(false);

  useBlocker({
    shouldBlockFn: () => {
      if (discardConfirmed.current) {
        discardConfirmed.current = false;
        return false;
      }
      return true;
    },
    disabled: !isDirty || isSubmitting,
  });

  async function handleFormSubmit(data: VaultItem) {
    setError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    }
  }

  function handleCancel() {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onCancel();
    }
  }

  function handleConfirmDiscard() {
    discardConfirmed.current = true;
    setShowDiscardDialog(false);
    onCancel();
  }

  const formRef = useRef<HTMLFormElement>(null);
  useSubmitShortcut(formRef);

  const developerInitialMode =
    type === 'developer_credential'
      ? ((defaultValues?.type === 'developer_credential'
          ? (defaultValues as Partial<DeveloperCredentialItem>).credentialMode
          : undefined) ?? 'token')
      : undefined;

  return (
    <FormProvider {...methods}>
      <form
        ref={formRef}
        onSubmit={handleSubmit((data) => handleFormSubmit(data as VaultItem))}
        className="space-y-4"
        aria-busy={isSubmitting}
      >
        <input type="hidden" {...register('type')} />

        <div className="field-group" data-invalid={!!errors.title}>
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="My Account" {...register('title')} />
          <FieldError message={errors.title?.message} />
        </div>

        {type === 'developer_credential' ? (
          <FieldsComponent initialMode={developerInitialMode} />
        ) : (
          <FieldsComponent />
        )}

        <CustomFieldsSection />

        <FieldError message={error ?? undefined} />
        <div className="sticky bottom-0 bg-card pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:bg-transparent lg:pt-2 border-t border-border/50 lg:border-0 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>

        <ResponsiveDialog
          open={showDiscardDialog}
          onOpenChange={setShowDiscardDialog}
          title="Discard changes?"
          description="Your unsaved changes will be lost."
          footer={
            <>
              <Button variant="destructive" onClick={handleConfirmDiscard}>
                Discard
              </Button>
              <Button variant="outline" onClick={() => setShowDiscardDialog(false)}>
                Keep editing
              </Button>
            </>
          }
        />
      </form>
    </FormProvider>
  );
}
