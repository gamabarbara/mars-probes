const minimumLabelLength = 8;

function commonPrefixLength(id: string, neighbor = '') {
  let length = 0;
  while (length < id.length && id[length] === neighbor[length]) {
    length += 1;
  }
  return length;
}

export function buildProbeLabels(ids: string[]): ReadonlyMap<string, string> {
  const sortedIds = [...new Set(ids)].sort();

  // In sorted order, the longest shared prefix is with an adjacent ID.
  return new Map(
    sortedIds.map((id, index) => {
      const length = Math.max(
        minimumLabelLength,
        commonPrefixLength(id, sortedIds[index - 1]) + 1,
        commonPrefixLength(id, sortedIds[index + 1]) + 1
      );
      return [id, id.slice(0, length)];
    })
  );
}
