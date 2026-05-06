export async function fetchAllPages<T>(
  fetcher: (cursor?: string) => Promise<{ data: T[]; nextCursor: string | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    if (pages++ >= 200) break;
    const { data, nextCursor } = await fetcher(cursor);
    all.push(...data);
    cursor = nextCursor ?? undefined;
  } while (cursor);
  return all;
}
