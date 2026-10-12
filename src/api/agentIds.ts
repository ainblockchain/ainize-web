/**
 * Readable agent ids. An agent's id is its public address (`/agents/<id>`) and its page (`/agent/<id>`), and it
 * never changes once taken, so the suggestion the forms make is the one most agents keep for good.
 *
 * The rule: the name, romanized when it is Korean, lower-case `[a-z0-9-]`, at most 40 characters — and on a
 * collision a short `-2`, `-3`… rather than a millisecond timestamp or a hash (the `baghyanggi-1765208006999` and
 * `external-e20458854c448acf7809` ids imported from AINspace Builder are what this replaces).
 */

/** The node's id rule (ainize-node `LINKED_AGENT_ID`): 1–40 of `[a-z0-9-]`, not starting with a hyphen. */
export const AGENT_ID_MAX_LENGTH = 40;

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const VOWELS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
/** A final consonant as it sounds at the end of a syllable (Revised Romanization's representative sounds). */
const FINALS = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
const FINAL_RIEUL = 8;
const INITIAL_RIEUL = 5;

/**
 * Hangul syllables to Latin letters, Revised Romanization syllable by syllable: `박향기` → `bakhyanggi`,
 * `안새벽` → `ansaebyeok`. Sound changes across syllables are left out (except `ㄹㄹ` → `ll`) — an id should be
 * predictable from the name, not a pronunciation guide. Everything that is not a Hangul syllable passes through.
 */
export function romanizeHangul(text: string): string {
  let out = '';
  let prevFinal = -1;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < HANGUL_FIRST || code > HANGUL_LAST) { out += ch; prevFinal = -1; continue; }
    const index = code - HANGUL_FIRST;
    const initial = Math.floor(index / 588);
    const vowel = Math.floor((index % 588) / 28);
    const final = index % 28;
    out += (initial === INITIAL_RIEUL && prevFinal === FINAL_RIEUL ? 'l' : INITIALS[initial]) + VOWELS[vowel] + FINALS[final];
    prevFinal = final;
  }
  return out;
}

/**
 * An id from a name: "My Score Bot!" → `my-score-bot`, "박향기" → `bakhyanggi`, "출석 체크" → `chulseok-chekeu`.
 *
 * Hangul is romanized and accents fold to their base letter (`Café` → `cafe`). Anything else outside `[a-z0-9]`
 * becomes one hyphen, and the result is cut to 40 characters without a hyphen at either end. A name with nothing
 * that maps (Chinese or Japanese only, say) yields `''` — the form then asks for an id instead of inventing one.
 */
export function agentIdFromName(name: string): string {
  return romanizeHangul(name.normalize('NFC'))
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, AGENT_ID_MAX_LENGTH)
    .replace(/-+$/, '');
}

/**
 * The `n`th try for an id that is taken: `coffee-bot` → `coffee-bot-2`, `-3`… The base is shortened first when the
 * suffix would push it past 40 characters, so the result is always a valid id. `n` below 2 is the base itself.
 */
export function agentIdCandidate(base: string, n: number): string {
  if (n < 2) return base;
  const suffix = `-${n}`;
  const head = base.slice(0, AGENT_ID_MAX_LENGTH - suffix.length).replace(/-+$/, '');
  return `${head || 'agent'}${suffix}`;
}

/** How many suffixed ids a form tries on its own when the node answers `id_taken`, before it asks the person. */
export const AGENT_ID_AUTO_RETRIES = 8;

/**
 * Create with the suggested id, and when the node says it is taken, try `-2`, `-3`… on our own (up to `retries`
 * more). Only for an id the form suggested: an id the person typed is theirs, and a refusal goes back to them.
 * Resolves with the body that was accepted; any other error, or the last `id_taken`, is thrown as it came.
 */
export async function createWithFreeAgentId<T extends { id: string }>(
  body: T,
  create: (body: T) => Promise<unknown>,
  isTaken: (error: unknown) => boolean,
  retries = AGENT_ID_AUTO_RETRIES,
): Promise<T> {
  for (let n = 1; ; n++) {
    const attempt = n === 1 ? body : { ...body, id: agentIdCandidate(body.id, n) };
    try {
      await create(attempt);
      return attempt;
    } catch (error) {
      if (n > retries || !isTaken(error)) throw error;
    }
  }
}
