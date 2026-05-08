import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VaultItem } from '@blindpass/vault';

export function CustomFieldsSection() {
  const { control, register } = useFormContext<VaultItem>();
  const { fields, append, remove } = useFieldArray({ control, name: 'customFields' });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Custom Fields</Label>
        <button
          type="button"
          onClick={() => append({ label: '', value: '' })}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add field
        </button>
      </div>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-2 items-start">
          <Input
            placeholder="Label"
            className="w-36 shrink-0"
            {...register(`customFields.${index}.label`)}
          />
          <Input
            placeholder="Value"
            className="flex-1"
            {...register(`customFields.${index}.value`)}
          />
          <button
            type="button"
            onClick={() => remove(index)}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Remove field"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
