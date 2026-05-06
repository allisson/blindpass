import type { ZxcvbnResult } from '@zxcvbn-ts/core';

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export type StrengthResult = {
  score: StrengthScore;
  warning: string;
  suggestion: string;
  crackTimeDisplay: string;
};

export type Estimator = (password: string, userInputs?: string[]) => StrengthResult;

let estimatorPromise: Promise<Estimator> | null = null;

async function configure(): Promise<Estimator> {
  const [core, common, en] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-en'),
  ]);

  core.zxcvbnOptions.setOptions({
    translations: en.translations,
    graphs: common.adjacencyGraphs,
    dictionary: {
      ...common.dictionary,
      ...en.dictionary,
    },
  });

  return (password: string, userInputs: string[] = []): StrengthResult => {
    const inputs = userInputs.flatMap(splitUserInput);
    const r: ZxcvbnResult = core.zxcvbn(password, inputs);
    return {
      score: r.score as StrengthScore,
      warning: r.feedback.warning ?? '',
      suggestion: r.feedback.suggestions[0] ?? '',
      crackTimeDisplay: String(r.crackTimesDisplay.offlineSlowHashing1e4PerSecond),
    };
  };
}

function splitUserInput(value: string): string[] {
  if (!value) return [];
  const parts = new Set<string>([value]);
  const local = value.split('@')[0];
  if (local && local !== value) parts.add(local);
  for (const token of local.split(/[._\-+]/)) {
    if (token.length >= 3) parts.add(token);
  }
  return [...parts];
}

export function loadZxcvbn(): Promise<Estimator> {
  if (!estimatorPromise) {
    estimatorPromise = configure();
  }
  return estimatorPromise;
}

export function resetZxcvbnForTests(): void {
  estimatorPromise = null;
}
