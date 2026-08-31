/**
 * Ainize plain-language glossary — the single source of truth for how the UI talks about the system.
 *
 * Rule: users buy and use *knowledge*, not table rows. Technical terms stay available in tooltips
 * (`tech`) for developers, but the primary label (`ko`/`en`) is what a person who has never heard of an
 * n-gram table would understand. Every page must take its terminology from here.
 */
export interface Term { ko: string; en: string; tech: string; help_ko: string; help_en: string }

export const GLOSSARY = {
  brand: { ko: 'Ainize', en: 'Ainize', tech: 'ainize (AI + -ize)', help_ko: 'AI + -ize: "AI가 쓸 수 있게 만든다". 1세대 Ainize는 GitHub 저장소를 AI 서비스로 만들었고, 지금의 Ainize는 지식을 AI가 아는 상태로 만듭니다. 앞 세 글자 AIN은 결제·기록·권한을 맡는 AI Network입니다.', help_en: 'AI + -ize: "make it usable by AI". The first Ainize turned GitHub repos into AI services; this Ainize turns knowledge into something a model actually knows. The first three letters, AIN, are the AI Network that records payments and permissions.' },
  patch: { ko: '지식', en: 'knowledge', tech: 'knowledge patch (n-gram memory-table rows: addr / before / after)', help_ko: 'AI 모델에 끼웠다 뺄 수 있는 지식 한 묶음입니다. 내부적으로는 모델 기억 테이블의 행(row) 값이지만, 사용자는 "이 지식을 모델에 넣는다/뺀다"로만 생각하면 됩니다.', help_en: 'A bundle of knowledge you can plug into (and remove from) an AI model. Internally it is a set of memory-table rows; you only need to think "add this knowledge / remove it".' },
  rows: { ko: '학습된 기억 항목', en: 'learned memory entries', tech: 'rows (table addresses touched by the patch)', help_ko: '이 지식이 모델 기억에서 바꾸는 항목 수입니다. 문장 수가 아니라 저장 단위 수이며, 클수록 넓은 지식입니다.', help_en: 'How many memory entries this knowledge changes. Not a sentence count — a storage unit; larger means broader knowledge.' },
  facts: { ko: '담긴 사실', en: 'facts covered', tech: 'benchmark.queries', help_ko: '이 지식이 답할 수 있는 질문(사실)의 수입니다.', help_en: 'Number of questions (facts) this knowledge can answer.' },
  verified: { ko: '검증 완료', en: 'Verified', tech: 'verifier quorum reached (≥ N independent attestations)', help_ko: '독립된 검증 노드 여러 곳이 실제 모델에 넣어 보고 정답률과 부작용을 확인한 지식입니다.', help_en: 'Several independent verifier nodes actually loaded it into the model and checked accuracy and side effects.' },
  verifying: { ko: '검증 중', en: 'Verifying', tech: 'attestations < quorum', help_ko: '검증 노드들이 실제 모델에 넣어 채점하는 중입니다.', help_en: 'Verifier nodes are scoring it on the real model.' },
  accuracy: { ko: '정답률', en: 'accuracy', tech: 'free-generation hits / benchmark queries', help_ko: '지식을 넣은 모델이 검증 질문에 정답을 낸 비율입니다.', help_en: 'Share of benchmark questions the model answers correctly with the knowledge loaded.' },
  sideEffects: { ko: '부작용 검사', en: 'side-effect check', tech: 'collateral / locality bound (unrelated-text logprob drift, nats)', help_ko: '지식을 넣어도 모델의 다른 일반 지식이 망가지거나 헛소리(환각)가 늘지 않는지 확인합니다.', help_en: 'Checks that adding the knowledge does not damage the model’s other knowledge or increase hallucination.' },
  conflict: { ko: '겹침·충돌 검사', en: 'overlap check', tech: 'address-set intersection', help_ko: '내가 가진 다른 지식과 겹치거나 서로 모순되는지 자동으로 알려줍니다.', help_en: 'Automatically tells you whether it overlaps or contradicts knowledge you already have.' },
  branch: { ko: '지식 묶음(브랜치)', en: 'knowledge track', tech: 'branch (context-mapped patch set)', help_ko: '서로 다른 전제(예: 한국법 vs 미국법)를 따로 유지하는 지식 묶음입니다. 상황에 맞는 묶음으로 몇 초 만에 전환합니다.', help_en: 'Sets of knowledge kept in parallel for different contexts (e.g. KR law vs US law); switch in seconds.' },
  superseded: { ko: '최신 버전 있음', en: 'Newer version available', tech: 'superseded (newer patch overlaps on the same benchmark)', help_ko: '같은 주제의 더 새로운 지식이 등록되어 이 버전은 대체되었습니다.', help_en: 'A newer knowledge on the same subject replaced this one.' },
  lineage: { ko: '원작자 수익 분배', en: 'creator revenue share', tech: 'lineage royalties (parent patches)', help_ko: '다른 지식을 바탕으로 만든 지식이 팔리면 원작자에게도 자동으로 수익이 나뉩니다.', help_en: 'When knowledge built on someone else’s work sells, the original creator automatically gets a share.' },
  autoPay: { ko: '자동 결제', en: 'automatic payment', tech: 'HTTP 402 / x402 (ain-transfer or local-credit)', help_ko: '사람이나 AI 에이전트가 지식을 요청하면 가격을 안내받고 자동으로 결제한 뒤 바로 내려받습니다. 별도 회원가입이 없고, 결제 수단은 지갑(AIN) 또는 노드 크레딧입니다.', help_en: 'A person or an AI agent asks for knowledge, is quoted a price, pays automatically and downloads immediately. No sign-up; payment is a wallet (AIN) or node credit.' },
  ledger: { ko: '공개 기록', en: 'public record', tech: 'ledger (AI Network blockchain or local P2P log)', help_ko: '누가 어떤 지식을 등록·검증·구매했는지 누구나 확인할 수 있는 기록입니다.', help_en: 'A record anyone can check: who registered, verified and bought which knowledge.' },
  ain: { ko: 'AIN (AI Network 토큰)', en: 'AIN (AI Network token)', tech: 'AIN — native token of the AI Network blockchain', help_ko: '실결제 모드에서 쓰는 토큰입니다. 이 데모는 로컬 개발 체인이라 실제 가치가 없습니다.', help_en: 'Token used in real-payment mode. This demo runs a local development chain, so it has no real-world value.' },
  credit: { ko: '노드 크레딧', en: 'node credit', tech: 'local-credit (dev currency derived from settlements)', help_ko: '개발용 가상 화폐입니다. 실제 돈이 아니며, 노드마다 처음에 100 크레딧이 주어집니다.', help_en: 'Development-only play money. Not real; every node starts with 100 credits.' },
  stake: { ko: '검증 보증', en: 'verifier deposit', tech: 'stake / bond on attestation', help_ko: '검증 노드가 잘못된 검증을 하면 잃게 되는 보증금입니다. 그래서 검증 결과를 믿을 수 있습니다.', help_en: 'A deposit a verifier loses if its verification turns out wrong — that is why the result can be trusted.' },
  node: { ko: '노드', en: 'node', tech: 'P2P marketplace peer (ainize node)', help_ko: '지식을 팔고, 검증하고, 모델에 끼워 쓰는 참여자 서버입니다. 사용자는 노드를 몰라도 지식을 사서 쓸 수 있습니다.', help_en: 'A participant server that sells, verifies and applies knowledge. You can buy and use knowledge without running one.' },
  liveTest: { ko: '라이브 테스트', en: 'Live test', tech: 'ChatMode: base vs patched completion under the shared runtime lock', help_ko: '같은 질문을 지식을 넣기 전과 후의 모델에 물어 답이 어떻게 달라지는지 직접 봅니다.', help_en: 'Ask the same question before and after loading the knowledge and see how the answer changes.' },
  apply: { ko: '모델에 넣기', en: 'Load into model', tech: 'apply (write rows to the serving table, no restart)', help_ko: '재시작 없이 몇 초 만에 지식이 모델에 들어갑니다. 언제든 뺄 수 있습니다.', help_en: 'Loads in seconds without restarting; removable at any time.' },
  remove: { ko: '모델에서 빼기', en: 'Unload', tech: 'remove (restore original rows)', help_ko: '원래 값으로 되돌립니다.', help_en: 'Restores the original values.' },
  synthetic: { ko: '데모용 합성 데이터', en: 'synthetic demo data', tech: 'random rows, no real knowledge', help_ko: '실제 지식이 아닌 시연용 데이터입니다.', help_en: 'Demo-only data, not real knowledge.' },
} as const satisfies Record<string, Term>;

export type TermKey = keyof typeof GLOSSARY;

/** Audience split for the landing page (users who buy/use knowledge vs people who run nodes). */
export const AUDIENCE = {
  user: { ko: '지식을 사서 쓰는 분', en: 'I want to use knowledge', help_ko: '검증된 지식을 찾아 라이브 테스트하고 내 모델에 넣습니다.', help_en: 'Find verified knowledge, test it live, load it into your model.' },
  creator: { ko: '지식을 만들어 파는 분', en: 'I want to sell knowledge', help_ko: '지식을 등록하면 네트워크가 검증하고, 팔릴 때마다 정산됩니다.', help_en: 'Register knowledge; the network verifies it and you get paid per sale.' },
  operator: { ko: '노드 운영자·개발자', en: 'Node operators & developers', help_ko: 'CLI로 노드를 띄워 검증에 참여하고 API/에이전트로 자동화합니다.', help_en: 'Run a node from the CLI, take part in verification, automate with the API and agents.' },
} as const;
