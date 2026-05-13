import { createContext, useContext } from 'react';

export const CommandPaletteContext = createContext<() => void>(() => {});

export function useOpenCommandPalette() {
  return useContext(CommandPaletteContext);
}
