function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(str) {
  return normalize(str).split(" ").filter(Boolean);
}

function scoreMatch(queryTokens, fileTokens) {
  if (queryTokens.length === 0 || fileTokens.length === 0) return 0;
  const fileSet = new Set(fileTokens);
  let hits = 0;
  for (const t of queryTokens) {
    if (fileSet.has(t)) {
      hits += 1;
    } else {
      for (const f of fileTokens) {
        if (f.startsWith(t) || t.startsWith(f)) {
          hits += 0.5;
          break;
        }
      }
    }
  }
  return hits / queryTokens.length;
}

export function findCandidates(query, files) {
  const qTokens = tokens(query);
  const scored = files
    .map((f) => {
      const fTokens = tokens(f.name);
      const score = scoreMatch(qTokens, fTokens);
      return { file: f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored;
}

export function extractNameFromQuery(query) {
  const patterns = [
    /(?:para|de|do|da|cliente|sobre|orcad[oa]?\s+(?:para|de))\s+(?:a\s+|o\s+)?([a-zA-ZÀ-ÿ' ]{2,})/i,
  ];
  let candidate = query;
  for (const p of patterns) {
    const m = query.match(p);
    if (m && m[1]) {
      candidate = m[1];
      break;
    }
  }
  return candidate
    .replace(/\b(qual|quero|saber|valor|orcado|orcamento|o|a|me|diga|informe|por favor)\b/gi, " ")
    .replace(/[?.!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export { normalize };
