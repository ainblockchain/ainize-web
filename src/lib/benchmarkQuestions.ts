const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Count declared questions, not guaranteed knowledge coverage. Do not rewrite the signed anchor. */
export function benchmarkQuestionCount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0) return raw;
  return Array.isArray(raw) && raw.every(q => object(q) && typeof q.prompt === 'string' && typeof q.expect === 'string') ? raw.length : null;
}

/** A matching cardinality alone does not prove the same questions were tested. */
export function benchmarkCoverage(tested: number | null, questions: unknown): 'declared' | 'measured' | 'unknown' {
  if (tested === null || !Number.isSafeInteger(tested) || tested <= 0) return 'unknown';
  return benchmarkQuestionCount(questions) === null ? 'measured' : 'declared';
}
