async function isReachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
  if (!(await isReachable(backendUrl))) {
    throw new Error(`Backend not reachable at ${backendUrl} — run \`make dev\` first.`);
  }
}
