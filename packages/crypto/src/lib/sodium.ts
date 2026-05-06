import _sodium from 'libsodium-wrappers-sumo';

let ready: Promise<void> | null = null;

export async function getSodium(): Promise<typeof _sodium> {
  if (!ready) ready = _sodium.ready;
  await ready;
  return _sodium;
}
