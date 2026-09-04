/**
 * Finding 100 — a knowledge's description is clamped to two lines on the browse card, and the descriptions this
 * network actually carries spend them on how the file was built:
 *
 *   "… (pinpoint). 270,053 memory entries (0.084% of all parameters). Source: results/train-all/rows-pin.npz (2026-08-30)."
 *   "… learned from 8 phrasings. Source: /mnt/newdata/qwen3.8 results/train-fact (2026-08-29, 10 steps of row-wise Adam)."
 *
 * A buyer looking at 25 AIN gets a developer's filesystem path where the answer to "what will the model know after
 * loading this?" should be. Every one of those facts is already on the card or in the structured recipe behind the
 * developer disclosure, so the browse card drops those sentences and keeps the prose.
 *
 * This only ever DROPS whole sentences — nothing is rewritten, nothing is invented, and a description that would be
 * left with nothing to say comes back exactly as it was. The full text is still what the knowledge page shows.
 */

/** "Source: …" / "출처: …" — a provenance sentence, not a description of the knowledge. */
const PROVENANCE = /^\s*(source|출처)\s*[:：]/i;
/** An absolute path on somebody's machine. */
const ABSOLUTE_PATH = /(^|[\s("'[])[~/](mnt|home|Users|var|opt|tmp|srv|data)\//;
/** A build artefact reached through a directory, e.g. `results/train-all/rows-pin.npz`. */
const ARTEFACT_PATH = /[\w.-]+\/[\w.-]*\.(npz|npy|jsonl|json|pt|bin|safetensors|ckpt)\b/i;
/**
 * A sentence that is only the row count again — the card already prints it, under its plain-language name. It has to
 * BEGIN with the number and stay short, so "270,053 memory entries (0.084% of all parameters)." goes and a real
 * sentence that happens to open with the count ("270,053 memory entries were taken from three phrasings of each
 * company name, …") stays.
 */
const ROW_COUNT_ONLY = /^\s*[\d,.]+\s*(memory entries|rows|기억 항목|개의 기억 항목|행)\b/i;
const ROW_COUNT_MAX = 70;

const isBuildNote = (sentence: string): boolean =>
  PROVENANCE.test(sentence) || ABSOLUTE_PATH.test(sentence) || ARTEFACT_PATH.test(sentence)
  || (ROW_COUNT_ONLY.test(sentence) && sentence.trim().length <= ROW_COUNT_MAX);

/**
 * The description as a browse card should show it. Sentence boundaries are a full stop FOLLOWED BY WHITESPACE, so
 * "0.084%" and "Qwen3.8" are never split.
 */
export function browseDescription(text?: string | null): string {
  const full = (text ?? '').trim();
  if (!full) return '';
  const sentences = full.split(/(?<=[.。!?！？])\s+/);
  const kept = sentences.filter((s) => !isBuildNote(s)).join(' ').trim();
  // A description that was ONLY a build note keeps it: better a provenance line than a card with nothing to read.
  return kept || full;
}
