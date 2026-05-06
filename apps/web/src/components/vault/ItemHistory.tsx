import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { toast } from 'sonner';
import { useItemVersion, useItemVersions } from '@/hooks/useVault';
import { Skeleton } from '@/components/ui/skeleton';

interface VersionRowProps {
  itemId: string;
  versionId: string;
  versionNum: number;
  createdAt: string;
}

function VersionRow({ itemId, versionId, versionNum, createdAt }: VersionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isError } = useItemVersion(itemId, expanded ? versionId : null);

  useEffect(() => {
    if (isError) toast.error("Couldn't load this version. It may be corrupted or inaccessible.");
  }, [isError]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent/40 transition-colors"
      >
        <span className="text-sm text-foreground">
          Version {versionNum} &mdash;{' '}
          <span className="text-muted-foreground text-xs">
            {new Date(createdAt).toLocaleString()}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : data ? (
            <>
              {data.type === 'login' && (
                <>
                  <ReadOnlyField label="Username" value={data.username} />
                  <ReadOnlyField label="Password" value={data.password} masked />
                  {data.url && <ReadOnlyField label="URL" value={data.url} />}
                  {data.notes && <ReadOnlyField label="Notes" value={data.notes} />}
                </>
              )}
              {data.type === 'secure_note' && (
                <ReadOnlyField label="Content" value={data.content} />
              )}
              {data.type === 'payment_card' && (
                <>
                  <ReadOnlyField label="Cardholder" value={data.cardholderName} />
                  <ReadOnlyField label="Number" value={data.number} />
                  <ReadOnlyField label="Expires" value={`${data.expMonth}/${data.expYear}`} />
                  {data.cvv && <ReadOnlyField label="CVV" value={data.cvv} masked />}
                  {data.notes && <ReadOnlyField label="Notes" value={data.notes} />}
                </>
              )}
              {data.type === 'identity' && (
                <>
                  <ReadOnlyField label="Name" value={`${data.firstName} ${data.lastName}`} />
                  {data.email && <ReadOnlyField label="Email" value={data.email} />}
                  {data.phone && <ReadOnlyField label="Phone" value={data.phone} />}
                  {data.notes && <ReadOnlyField label="Notes" value={data.notes} />}
                </>
              )}
              {data.type === 'totp' && (
                <>
                  <ReadOnlyField label="Secret" value={data.secret} masked />
                  {data.issuer && <ReadOnlyField label="Issuer" value={data.issuer} />}
                  {data.accountName && <ReadOnlyField label="Account" value={data.accountName} />}
                  {data.notes && <ReadOnlyField label="Notes" value={data.notes} />}
                </>
              )}
              {data.type === 'developer_credential' && (
                <>
                  {data.credentialMode === 'token' ? (
                    <>
                      <ReadOnlyField label="Provider" value={data.provider} />
                      {data.environment && (
                        <ReadOnlyField label="Environment" value={data.environment} />
                      )}
                      {data.baseUrl && <ReadOnlyField label="Base URL" value={data.baseUrl} />}
                      <ReadOnlyField label="Secret" value={data.secret} masked />
                      {data.keyId && <ReadOnlyField label="Key ID" value={data.keyId} />}
                    </>
                  ) : data.credentialMode === 'client_secret_pair' ? (
                    <>
                      <ReadOnlyField label="Provider" value={data.provider} />
                      {data.environment && (
                        <ReadOnlyField label="Environment" value={data.environment} />
                      )}
                      {data.baseUrl && <ReadOnlyField label="Base URL" value={data.baseUrl} />}
                      <ReadOnlyField label="Client ID" value={data.clientId} />
                      <ReadOnlyField label="Client Secret" value={data.clientSecret} masked />
                    </>
                  ) : (
                    <>
                      <ReadOnlyField label="Username" value={data.username} />
                      <ReadOnlyField label="Host" value={data.host} />
                      {data.algorithm && <ReadOnlyField label="Algorithm" value={data.algorithm} />}
                      {data.fingerprint && (
                        <ReadOnlyField label="Fingerprint" value={data.fingerprint} />
                      )}
                      <ReadOnlyField label="Public Key" value={data.publicKey} />
                      <ReadOnlyField label="Private Key" value={data.privateKey} masked />
                      {data.passphrase && (
                        <ReadOnlyField label="Passphrase" value={data.passphrase} masked />
                      )}
                    </>
                  )}
                  {data.notes && <ReadOnlyField label="Notes" value={data.notes} />}
                </>
              )}
              {data.type === 'crypto_wallet' && (
                <>
                  <ReadOnlyField label="Seed phrase" value={data.mnemonic} masked />
                  {data.passphrase && (
                    <ReadOnlyField label="Passphrase" value={data.passphrase} masked />
                  )}
                  {data.walletName && <ReadOnlyField label="Wallet name" value={data.walletName} />}
                  {data.network && <ReadOnlyField label="Network" value={data.network} />}
                  {data.derivationPath && (
                    <ReadOnlyField label="Derivation path" value={data.derivationPath} />
                  )}
                  {data.addressHint && (
                    <ReadOnlyField label="Address hint" value={data.addressHint} />
                  )}
                  {data.notes && <ReadOnlyField label="Notes" value={data.notes} />}
                </>
              )}
              {data.customFields?.map((f, i) => (
                <ReadOnlyField key={i} label={f.label} value={f.value} />
              ))}
            </>
          ) : (
            <p className="text-xs text-destructive">Failed to decrypt version.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground font-mono flex-1 truncate">
          {masked && !show ? '••••••••••••' : value}
        </span>
        {masked && (
          <button
            onClick={() => setShow((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  );
}

interface ItemHistoryProps {
  itemId: string;
}

export function ItemHistory({ itemId }: ItemHistoryProps) {
  const [open, setOpen] = useState(false);
  const { data: versions, isLoading } = useItemVersions(open ? itemId : '');

  const hasVersions = versions && versions.length > 0;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="w-4 h-4" />
        <span>History</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          )}
          {!isLoading && !hasVersions && (
            <p className="text-xs text-muted-foreground">No history yet.</p>
          )}
          {hasVersions &&
            versions.map((v) => (
              <VersionRow
                key={v.id}
                itemId={itemId}
                versionId={v.id}
                versionNum={v.versionNum}
                createdAt={v.createdAt}
              />
            ))}
        </div>
      )}
    </div>
  );
}
