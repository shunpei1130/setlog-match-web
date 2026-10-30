/** Edmonds' augmenting-path algorithm for maximum cardinality general matching.
 * Vertices/adjacency should be ordered by the caller's persisted event seed.
 * Supports odd cycles (preferences do not form a bipartite graph).
 */
export function maximumMatching(graph: readonly (readonly number[])[]): number[] {
  const size = graph.length;
  const match = Array<number>(size).fill(-1);
  const parent = Array<number>(size).fill(-1);
  const base = Array.from({ length: size }, (_, index) => index);
  const used = Array<boolean>(size).fill(false);
  const flower = Array<boolean>(size).fill(false);

  function commonBase(first: number, second: number) {
    const path = Array<boolean>(size).fill(false);
    for (;;) {
      first = base[first];
      path[first] = true;
      if (match[first] === -1) break;
      first = parent[match[first]];
    }
    for (;;) {
      second = base[second];
      if (path[second]) return second;
      second = parent[match[second]];
    }
  }

  function markPath(vertex: number, root: number, child: number) {
    while (base[vertex] !== root) {
      flower[base[vertex]] = flower[base[match[vertex]]] = true;
      parent[vertex] = child;
      child = match[vertex];
      vertex = parent[match[vertex]];
    }
  }

  function augment(root: number) {
    parent.fill(-1);
    used.fill(false);
    for (let index = 0; index < size; index += 1) base[index] = index;
    const queue = [root];
    used[root] = true;
    for (let head = 0; head < queue.length; head += 1) {
      const vertex = queue[head];
      for (const next of graph[vertex]) {
        if (base[vertex] === base[next] || match[vertex] === next) continue;
        if (next === root || (match[next] !== -1 && parent[match[next]] !== -1)) {
          const ancestor = commonBase(vertex, next);
          flower.fill(false);
          markPath(vertex, ancestor, next);
          markPath(next, ancestor, vertex);
          for (let index = 0; index < size; index += 1) {
            if (!flower[base[index]]) continue;
            base[index] = ancestor;
            if (!used[index]) { used[index] = true; queue.push(index); }
          }
        } else if (parent[next] === -1) {
          parent[next] = vertex;
          if (match[next] === -1) {
            let current = next;
            while (current !== -1) {
              const previous = parent[current];
              const following = previous === -1 ? -1 : match[previous];
              match[current] = previous;
              if (previous !== -1) match[previous] = current;
              current = following;
            }
            return;
          }
          used[match[next]] = true;
          queue.push(match[next]);
        }
      }
    }
  }

  for (let root = 0; root < size; root += 1) if (match[root] === -1) augment(root);
  return match;
}
