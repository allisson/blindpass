import { Copy, Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  parseMnemonic,
  suggestWord,
  validateChecksum,
  validateWordCount,
} from '@blindpass/vault/bip39';
import { useCopyWithAutoClear } from '@/hooks/useCopyWithAutoClear';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function MnemonicGrid({ value, onChange, disabled }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checksumWarning, setChecksumWarning] = useState<string | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const copyWithClear = useCopyWithAutoClear(15000);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const { words } = parseMnemonic(value);

  useEffect(() => {
    if (words.length === 0 || !validateWordCount(words)) {
      setChecksumWarning(null);
      return;
    }
    let cancelled = false;
    validateChecksum(words).then((result: { valid: boolean; reason?: string }) => {
      if (cancelled) return;
      if (!result.valid) {
        setChecksumWarning(
          result.reason === 'unknown_word'
            ? 'One or more words not in the BIP39 English wordlist.'
            : 'Checksum invalid — typo or non-English wordlist?',
        );
      } else {
        setChecksumWarning(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value, words]);

  function handlePaste(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const { canonical } = parseMnemonic(e.target.value);
    onChange(canonical);
    e.target.value = '';
  }

  function startEdit(index: number) {
    if (disabled) return;
    setEditingIndex(index);
    setEditValue(words[index] ?? '');
    setSuggestions([]);
  }

  async function handleEditChange(v: string) {
    setEditValue(v);
    if (v.length >= 2) {
      const s = await suggestWord(v);
      setSuggestions(s);
    } else {
      setSuggestions([]);
    }
  }

  function commitEdit(word?: string) {
    const committed = (word ?? editValue).trim().toLowerCase();
    if (editingIndex === null) return;
    const next = [...words];
    next[editingIndex] = committed;
    onChange(next.join(' '));
    setEditingIndex(null);
    setEditValue('');
    setSuggestions([]);
  }

  async function handleWordCopy(word: string) {
    await copyWithClear(word);
  }

  async function handleMnemonicCopy() {
    await copyWithClear(value);
    setShowCopyDialog(false);
  }

  const gridWords = words.length > 0 ? words : [];

  return (
    <div className="space-y-3">
      <textarea
        ref={pasteRef}
        placeholder="Paste mnemonic here…"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        className="h-auto min-h-[60px] w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs transition-all outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none dark:bg-input/20"
        onChange={handlePaste}
      />

      {checksumWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          <span className="shrink-0">⚠</span>
          <span>{checksumWarning}</span>
        </div>
      )}

      {gridWords.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{gridWords.length} words</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCopyDialog(true)}
                disabled={disabled}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy mnemonic"
              >
                <Copy className="w-3 h-3" />
                Copy all
              </button>
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label={revealed ? 'Hide words' : 'Reveal words'}
              >
                {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {revealed ? 'Hide' : 'Reveal'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {gridWords.map((word: string, i: number) => (
              <div key={i} className="group relative flex items-center gap-1">
                <span className="w-5 shrink-0 text-right text-[10px] text-muted-foreground">
                  {i + 1}.
                </span>
                {editingIndex === i ? (
                  <div className="relative flex-1">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => handleEditChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') {
                          setEditingIndex(null);
                          setSuggestions([]);
                        }
                        if (e.key === 'Tab' && suggestions[0]) {
                          e.preventDefault();
                          commitEdit(suggestions[0]);
                        }
                      }}
                      onBlur={() => commitEdit()}
                      list={`suggestions-${i}`}
                      className="w-full rounded border border-ring bg-background px-1.5 py-0.5 font-mono text-xs outline-none"
                    />
                    {suggestions.length > 0 && (
                      <datalist id={`suggestions-${i}`}>
                        {suggestions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(i)}
                    disabled={disabled}
                    className="flex-1 rounded border border-transparent bg-muted/50 px-1.5 py-0.5 text-left font-mono text-xs hover:border-border transition-colors overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {revealed ? word : '••••••'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleWordCopy(word)}
                  className="shrink-0 p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Copy word ${i + 1}`}
                >
                  <Copy className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <ResponsiveDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        title="Copy mnemonic?"
        description="Mnemonic will be on clipboard for 15 seconds, then automatically cleared."
        footer={
          <>
            <Button onClick={handleMnemonicCopy}>Copy</Button>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </div>
  );
}
