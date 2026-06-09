/**
 * Reciprocal Rank Fusion (Cormack et al., 2009):
 *   score(d) = Σ  1 / (k + rank_i(d))
 * where rank_i is the 1-based rank of document d in ranking i.
 *
 * Documents not present in a ranking contribute nothing from that ranking.
 */
export function reciprocalRankFusion<T extends { id: string }>(
  rankings: ReadonlyArray<ReadonlyArray<T>>,
  k = 60,
): T[] {
  const scoreMap = new Map<string, number>();
  const itemMap = new Map<string, T>();

  for (const ranking of rankings) {
    ranking.forEach((item, idx) => {
      const rank = idx + 1; // 1-based
      const prev = scoreMap.get(item.id) ?? 0;
      scoreMap.set(item.id, prev + 1 / (k + rank));
      if (!itemMap.has(item.id)) itemMap.set(item.id, item);
    });
  }

  return Array.from(itemMap.values())
    .map((item) => ({ item, score: scoreMap.get(item.id) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
