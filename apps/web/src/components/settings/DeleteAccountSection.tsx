import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from './DeleteAccountDialog';

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete account...
      </Button>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
