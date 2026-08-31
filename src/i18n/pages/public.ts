import type { Dict } from '../index';

/**
 * Public-facing pages: landing, explore, benchmark (same-topic list), list item, terms, 404.
 * Plain language only — the technical name of every concept lives in the glossary `tech` field and is surfaced via tooltips.
 */
export const landing: Dict = {
  // nav
  'landing.nav.explore': { ko: '지식 둘러보기', en: 'Explore knowledge' },
  'landing.nav.chat': { ko: '라이브 테스트', en: 'Live test' },
  'landing.nav.teach': { ko: '가르치기', en: 'Teach' },
  'landing.nav.signin': { ko: '노드 로그인', en: 'Node sign-in' },
  'landing.nav.signin_help': { ko: '노드 운영자·개발자용 콘솔입니다. 지식을 사서 쓰는 데는 로그인이 필요 없습니다.', en: 'Console for node operators and developers. You do not need to sign in to use knowledge.' },

  // hero
  'landing.hero.title': { ko: '지식을 AI에 끼우다', en: 'Plug knowledge into your AI' },
  'landing.hero.sub': { ko: 'Ainize = AI + -ize, "AI가 쓸 수 있게 만든다".\n검증된 지식을 고르고, 라이브로 확인하고, 몇 초 만에 모델에 넣으세요.', en: 'Ainize = AI + -ize, "make it usable by AI".\nPick verified knowledge, check it live, load it into your model in seconds.' },
  'landing.hero.count': { ko: '검증 완료 지식 {n}개', en: '{n} verified knowledge' },
  'landing.hero.count_verifying': { ko: '검증 중 {n}개', en: '{n} being verified' },
  'landing.hero.count_help': { ko: '독립된 검증 노드가 실제 모델에 넣어 정답률과 부작용까지 확인한 지식의 수입니다.', en: 'Knowledge that independent verifier nodes loaded into the real model and checked for accuracy and side effects.' },
  'landing.hero.primary': { ko: '지식 둘러보기', en: 'Explore knowledge' },
  'landing.hero.secondary': { ko: '라이브 테스트 해보기', en: 'Try a live test' },
  'landing.hero.note': { ko: '회원가입 없음 · 결제는 지갑(AIN) 또는 노드 크레딧으로 자동 처리 · 언제든 뺄 수 있음', en: 'No sign-up · pays automatically with a wallet (AIN) or node credit · removable any time' },

  // audience
  'landing.oneline.title': { ko: '한 줄이면 됩니다', en: 'One line is enough' },
  'landing.oneline.sub': { ko: '터미널이 편하시면 — 지식을 올리는 것도, 쓰는 것도 명령 한 줄입니다.', en: 'If you prefer the terminal — publishing knowledge and using it are each a single command.' },
  'landing.oneline.publish.who': { ko: '지식을 올리는 분', en: 'Publish knowledge' },
  'landing.oneline.publish.help': { ko: '학습된 지식 파일과 검증 질문 몇 개를 주면 등록과 공표가 끝납니다. 검증은 네트워크가 실제 모델에서 대신 하고, 팔릴 때마다 자동으로 정산됩니다.', en: 'Give it the learned knowledge file and a few benchmark questions — registration and announcement are done. The network verifies it on the real model and you are paid on every sale.' },
  'landing.oneline.use.who': { ko: '지식을 쓰는 분', en: 'Use knowledge' },
  'landing.oneline.use.help': { ko: '검증 완료를 확인하고, 자동 결제하고, 내려받아 내 모델에 넣는 것까지 한 번에 합니다. 회원가입 없이 지갑(AIN) 또는 노드 크레딧으로 결제됩니다.', en: 'Checks verification, pays automatically, downloads and loads it into your model in one go. No sign-up — a wallet (AIN) or node credit pays.' },
  'landing.oneline.caption': { ko: '웹으로도 똑같이 할 수 있습니다 — 위의 "지식 둘러보기"와 "라이브 테스트"부터 시작하세요.', en: 'You can do all of this on the web too — start with "Explore knowledge" and "Live test" above.' },
  'landing.oneline.more': { ko: '자세한 API·CLI 문서', en: 'Full API & CLI reference' },
  'landing.audience.title': { ko: '어떤 분이신가요?', en: 'Which one are you?' },
  'landing.audience.sub': { ko: 'Ainize는 지식을 쓰는 사람, 만드는 사람, 네트워크를 돌리는 사람이 함께 씁니다.', en: 'Ainize is used by people who use knowledge, people who make it, and people who run the network.' },
  'landing.audience.user.s1': { ko: '주제·모델별로 검증된 지식을 찾습니다.', en: 'Find knowledge verified for your topic and model.' },
  'landing.audience.user.s2': { ko: '같은 질문을 넣기 전/후 모델에 물어 답이 달라지는지 직접 봅니다.', en: 'Ask the same question before and after loading it and see the answer change.' },
  'landing.audience.user.s3': { ko: '마음에 들면 결제 후 몇 초 만에 모델에 넣고, 언제든 뺍니다.', en: 'If you like it, pay and load it in seconds — unload any time.' },
  'landing.audience.user.cta': { ko: '지식 둘러보기', en: 'Explore knowledge' },
  // creator card = teach mode (spec §5.1): the visitor teaches the model in Live test; registering a file is the operator's route
  'landing.audience.creator.title': { ko: '모델에게 가르치고 싶어요', en: 'I want to teach the model something' },
  'landing.audience.creator.s1': { ko: '라이브 테스트에서 물어보고, 틀리면 바로잡습니다.', en: 'Ask the model in Live test and correct it when it is wrong.' },
  'landing.audience.creator.s2': { ko: '이 노드가 내 바로잡기를 지식으로 학습합니다. 로그인도 내 서버도 필요 없습니다.', en: 'This node trains your corrections into knowledge — no sign-in, no server of your own.' },
  'landing.audience.creator.s3': { ko: '나만 쓰거나, 공개해서 팔릴 때마다 정산받습니다.', en: 'Keep it private, or publish it and get paid on every sale.' },
  'landing.audience.creator.cta': { ko: '모델 가르치기', en: 'Teach the model' },
  'landing.audience.creator.operator_link': { ko: '이미 지식 파일(.npz)이 있고 노드를 운영하나요? 파일 등록 →', en: 'Already have a knowledge file (.npz) and run a node? Register a file →' },
  'landing.audience.creator.off': { ko: '이 노드는 지금 수업을 받지 않습니다. 라이브 테스트는 그대로 쓸 수 있습니다.', en: 'This node is not accepting lessons right now. Live test still works.' },
  'landing.audience.operator.s1': { ko: '노드를 띄워 지식을 팔고 검증에 참여합니다.', en: 'Run a node to sell knowledge and take part in verification.' },
  'landing.audience.operator.s2': { ko: '올바른 검증에는 보상이, 잘못된 검증에는 보증금 손실이 따릅니다.', en: 'Correct verification is rewarded; wrong verification costs the deposit.' },
  'landing.audience.operator.s3': { ko: 'HTTP API로 AI 에이전트가 지식을 직접 사고 넣도록 자동화합니다.', en: 'Automate with the HTTP API so AI agents buy and load knowledge themselves.' },
  'landing.audience.operator.cta': { ko: '운영자 콘솔 열기', en: 'Open the operator console' },
  'landing.audience.operator.dev_label': { ko: '개발자용 · 터미널', en: 'For developers · terminal' },
  'landing.audience.operator.dev_help': { ko: '아래 명령은 노드를 직접 운영하려는 개발자만 필요합니다. 지식을 사서 쓰는 데는 설치가 필요 없습니다.', en: 'Only developers who want to run their own node need these commands. Using knowledge requires no install.' },

  // how it works
  'landing.how.title': { ko: '이렇게 됩니다', en: 'How it works' },
  'landing.how.sub': { ko: '세 단계면 끝납니다. 재학습도, 재시작도 없습니다.', en: 'Three steps. No retraining, no restart.' },
  'landing.how.step1.title': { ko: '검증', en: 'Verified' },
  'landing.how.step1.desc': { ko: '등록된 지식은 독립된 검증 노드 여러 곳이 실제 모델에 넣어 채점합니다. 정답률뿐 아니라 다른 지식이 망가지거나 환각이 늘지 않는지(부작용 검사)까지 봅니다.', en: 'Several independent verifier nodes load each registered knowledge into the real model and score it — accuracy, plus a side-effect check that nothing else breaks and hallucination does not rise.' },
  'landing.how.step2.title': { ko: '라이브 테스트', en: 'Live test' },
  'landing.how.step2.desc': { ko: '사기 전에 직접 물어보세요. 같은 질문을 지식을 넣기 전과 후의 모델에 던져 답이 어떻게 달라지는지 나란히 봅니다.', en: 'Ask before you buy. Put the same question to the model before and after the knowledge is loaded and compare the answers side by side.' },
  'landing.how.step3.title': { ko: '모델에 넣기', en: 'Load into model' },
  'landing.how.step3.desc': { ko: '결제는 자동으로 처리되고, 지식은 몇 초 만에 모델에 들어갑니다. 겹침·충돌 검사가 먼저 돌고, 마음이 바뀌면 언제든 뺄 수 있습니다.', en: 'Payment is automatic and the knowledge is in the model in seconds. An overlap check runs first, and you can unload whenever you change your mind.' },

  // trending
  'landing.trending.title': { ko: '지금 많이 찾는 검증 완료 지식', en: 'Popular verified knowledge' },
  'landing.trending.sub': { ko: '독립 검증을 통과해 바로 모델에 넣을 수 있는 지식입니다.', en: 'Passed independent verification and ready to load into the model.' },
  'landing.trending.empty': { ko: '아직 검증 완료된 지식이 없습니다. 검증 노드들이 채점하는 중이니 잠시 후 다시 확인해 주세요.', en: 'No knowledge has completed verification yet. Verifier nodes are scoring — check back in a moment.' },
  'landing.trending.empty_count': { ko: '지금 검증 중인 지식 {n}개', en: '{n} knowledge currently being verified' },
  'landing.trending.more': { ko: '더 보기', en: 'See all' },
  'landing.trending.accuracy_pending': { ko: '정답률 채점 전', en: 'Accuracy not scored yet' },

  // why
  'landing.why.title': { ko: '왜 Ainize인가', en: 'Why Ainize' },
  'landing.why.2019.year': { ko: '2019 – 2020', en: '2019 – 2020' },
  'landing.why.2019.title': { ko: '저장소를 AI 서비스로', en: 'Repo → running AI service' },
  'landing.why.2019.desc': { ko: '1세대 Ainize는 GitHub 저장소 하나를 몇 분 만에 돌아가는 AI 서비스로 만들었습니다. "ainize your repo".', en: 'The first Ainize turned any GitHub repo into a running AI service in minutes. "Ainize your repo."' },
  'landing.why.2026.year': { ko: '2026', en: '2026' },
  'landing.why.2026.title': { ko: '지식을 모델이 아는 상태로', en: 'Knowledge → something the model knows' },
  'landing.why.2026.desc': { ko: '지금의 Ainize는 지식을 AI 모델이 실제로 아는 상태로 만듭니다. 검증된 지식을 고르고, 라이브로 확인하고, 몇 초 만에 넣습니다. "ainize your knowledge".', en: 'This Ainize turns knowledge into something an AI model actually knows: pick verified knowledge, check it live, load it in seconds. "Ainize your knowledge."' },
  'landing.why.ain.year': { ko: 'AIN', en: 'AIN' },
  'landing.why.ain.title': { ko: '앞 세 글자, AI Network', en: 'The first three letters: AI Network' },
  'landing.why.ain.desc': { ko: '누가 어떤 지식을 등록·검증·구매했는지는 AI Network에 공개 기록으로 남고, 결제와 원작자 수익 분배도 그 위에서 자동으로 처리됩니다.', en: 'Who registered, verified and bought which knowledge is a public record on the AI Network, and payments and creator revenue share settle on it automatically.' },
  'landing.why.tagline': { ko: '만든 사람은 팔릴 때마다 정산받고, 쓰는 사람은 검증된 지식만 봅니다.', en: 'Creators get paid per sale; users only ever see verified knowledge.' },

  // footer
  'landing.footer.terms': { ko: '이용약관', en: 'Terms' },
  'landing.footer.network': { ko: '네트워크', en: 'Network' },
  'landing.footer.ledger': { ko: '공개 기록', en: 'Public record' },
  'landing.footer.contact': { ko: '문의하기', en: 'Contact us' },
  'landing.footer.copyright': { ko: 'ⓒ {year} Common Computer Inc. · Ainize', en: 'ⓒ {year} Common Computer Inc. · Ainize' },
};

export const listing: Dict = {
  // sort
  'explore.sort.popular': { ko: '인기순', en: 'Most popular' },
  'explore.sort.latest': { ko: '최신순', en: 'Newest' },
  'explore.sort.price': { ko: '가격순', en: 'Price' },
  'explore.sort.rows': { ko: '지식 크기순', en: 'Knowledge size' },

  // explore
  'explore.title': { ko: '지식 둘러보기', en: 'Explore knowledge' },
  'explore.sub': { ko: '검증 상태와 정답률을 보고 고르세요. 사기 전에 라이브 테스트로 직접 확인할 수 있습니다.', en: 'Choose by verification status and accuracy. You can check any of it with a live test before buying.' },
  'explore.filter.model': { ko: '대상 모델', en: 'Model' },
  'explore.filter.schema': { ko: '주제', en: 'Topic' },
  'explore.filter.schema_help': { ko: '같은 주제의 지식은 같은 질문 묶음으로 채점됩니다.', en: 'Knowledge on the same topic is scored with the same question set.' },
  'explore.filter.all': { ko: '전체', en: 'All' },
  'explore.search': { ko: '지식 이름·설명 검색', en: 'Search by name or description' },
  'explore.count': { ko: '지식 {n}개', en: '{n} knowledge' },
  'explore.updating': { ko: '새로고침 중…', en: 'updating…' },
  'explore.empty': { ko: '조건에 맞는 지식이 없습니다. 다른 모델·주제·검색어를 시도해 보세요.', en: 'No knowledge matches. Try another model, topic or search term.' },

  // benchmark (same-topic) page
  'bench.title': { ko: '같은 주제의 지식', en: 'Knowledge on this topic' },
  'bench.stats': { ko: '지식 {total}개 · 검증 완료 {listed}개 · 대상 모델: {models}', en: '{total} knowledge · {listed} verified · models: {models}' },
  'bench.explain': { ko: '같은 주제의 지식은 같은 질문 묶음으로 채점되어 서로 비교할 수 있습니다. 내용이 겹치면 더 새로운 검증 완료 지식이 이전 것을 대체합니다("최신 버전 있음").', en: 'Knowledge on the same topic is scored with the same question set, so it can be compared. When contents overlap, the newer verified knowledge replaces the older one ("Newer version available").' },
  'bench.back': { ko: '지식 둘러보기로 돌아가기', en: 'Back to Explore' },
  'bench.empty': { ko: '이 주제의 지식이 아직 없습니다.', en: 'No knowledge on this topic yet.' },
  'bench.notfound': { ko: '"{schema}" 주제로 등록된 지식이 없습니다.', en: 'No knowledge is registered under the topic "{schema}".' },

  // list item
  'item.verified_by': { ko: '검증 완료 (독립 검증 {passed}/{quorum})', en: 'Verified ({passed}/{quorum} independent verifiers)' },
  'item.verifying_by': { ko: '검증 중 (독립 검증 {passed}/{quorum})', en: 'Verifying ({passed}/{quorum} independent verifiers)' },
  'item.integrity_only': { ko: '무결성만 확인 {n}', en: 'integrity-only checks: {n}' },
  'item.integrity_help': { ko: '파일이 손상되지 않았는지만 확인한 검증입니다. 정답률을 재지 않았으므로 검증 완료 수에 넣지 않습니다.', en: 'Checked only that the file is intact — no accuracy was measured, so it does not count toward verification.' },
  'item.accuracy': { ko: '정답률 {pct}%', en: '{pct}% accuracy' },
  'item.accuracy_raw': { ko: '검증 질문 {raw} 정답', en: '{raw} benchmark questions correct' },
  'item.downloads': { ko: '내려받기 {n}회', en: '{n} downloads' },
  'item.size': { ko: '크기 {size}', en: 'Size {size}' },
  'item.topic': { ko: '주제', en: 'Topic' },
  'item.price_free': { ko: '무료', en: 'Free' },
  'item.price_ain': { ko: '{n} AIN', en: '{n} AIN' },
  'item.price_credit': { ko: '{n} 노드 크레딧', en: '{n} node credits' },
  'item.price_usdc': { ko: '{n} USDC', en: '{n} USDC' },
  'item.price_note_usdc': { ko: 'USDC = 달러 연동 스테이블코인', en: 'USDC = dollar-pegged stablecoin' },
};

export const misc: Dict = {
  'notfound.title': { ko: '404. 페이지를 찾을 수 없습니다', en: '404. Page not found' },
  'notfound.desc': { ko: '주소가 잘못되었거나 페이지가 더 이상 존재하지 않습니다.', en: "Either something went wrong or the page doesn't exist anymore." },
  'notfound.home': { ko: '지식 둘러보기로 가기', en: 'Go to Explore' },

  'terms.title': { ko: '이용약관과 개인정보 처리방침', en: 'Terms and Policies' },
  'terms.updated': { ko: '최종 수정: 2026년 8월 31일', en: 'Last updated: August 31, 2026' },
  'terms.s1.title': { ko: '1. Ainize는 무엇인가', en: '1. What Ainize is' },
  'terms.s1.p1': { ko: 'Ainize는 참여자들이 각자 노드를 운영하는 P2P 소프트웨어입니다. 노드는 지식을 등록·검증·판매·구매하고 AI 모델에 넣습니다. 여기서 "지식"이란 모델에 끼웠다 뺄 수 있는 지식 한 묶음과, 그 지식이 답해야 하는 질문 묶음을 함께 말합니다.\n중앙 운영자도, 호스팅 계정도, 자금 보관도 없습니다. 지금 보고 있는 화면은 노드 하나가 제공하는 것이며 그 노드만을 대변합니다.', en: 'Ainize is peer-to-peer software in which every participant runs their own node. A node registers, verifies, sells, buys and loads knowledge into an AI model. "Knowledge" here means a bundle you can plug into (and remove from) a model, together with the questions it is supposed to answer.\nThere is no central operator, no hosted account and no custody of funds. The page you are looking at is served by one node and speaks only for that node.' },
  'terms.s2.title': { ko: '2. 이용 조건', en: '2. Terms of use' },
  'terms.s2.h1': { ko: '2.1 노드의 신원', en: '2.1 Node identity' },
  'terms.s2.p1': { ko: '노드는 AI Network(AIN) 키 쌍으로 식별됩니다. 개인키를 안전하게 보관할 책임은 전적으로 노드 운영자에게 있습니다. 그 키로 만든 서명(공개 기록, 검증 결과, 결제 의사, 파일 요청)은 해당 노드에 구속력이 있습니다.', en: 'A node is identified by an AI Network (AIN) key pair. The node operator is solely responsible for keeping the private key safe. Signatures made with that key — public records, verification results, payment intents, file requests — are binding for that node.' },
  'terms.s2.h2': { ko: '2.2 지식은 데이터이지 조언이 아닙니다', en: '2.2 Knowledge is data, not advice' },
  'terms.s2.p2': { ko: '지식을 등록한다는 것은 그 지식이 첨부된 제작 방법과 질문 묶음으로 만들어졌음을 보증하는 것입니다. 지식을 구매하면 등록 시 명시된 이용 조건(기본값: 지정된 모델에서 사용, 원본 재판매 금지)에 따라 본인의 환경에서 지정된 모델에 넣어 쓸 권리를 얻습니다. 다른 지식을 바탕으로 만든 지식은 그 관계가 공개 기록에 남고, 원작자 수익 분배가 자동으로 이루어집니다.', en: 'Registering knowledge means asserting that it was produced with the attached recipe and question set. Buying knowledge grants a license to load it into the identified model on your own infrastructure under the terms stated at registration (default: use on the identified model, no resale of the raw data). Knowledge built on other knowledge keeps that relationship on the public record, and creator revenue share is applied automatically.' },
  'terms.s2.h3': { ko: '2.3 검증은 최선의 노력입니다', en: '2.3 Verification is best-effort' },
  'terms.s2.p3': { ko: '검증 결과는 독립된 검증 노드가 검증 보증(잘못 검증하면 잃는 보증금)을 걸고 게시합니다. 각 결과에는 어떤 환경에서 측정했는지가 기록됩니다. "무결성만 확인"으로 표시된 결과는 파일이 손상되지 않았는지만 확인한 것이며 정답률을 보증하지 않습니다.\n"검증 완료"는 지식이 항상 옳다거나 부작용이 전혀 없음을 보장하지 않습니다. 실제 서비스에 넣기 전에는 본인의 질문으로 라이브 테스트를 다시 해 보시기 바랍니다.', en: 'Verification results are published by independent verifier nodes that put up a verifier deposit (lost if the verification turns out wrong). Each result records the environment it was measured in. Results marked "integrity-only" confirm only that the file is intact and do not vouch for accuracy.\n"Verified" does not guarantee that knowledge is always correct or free of side effects. Re-run a live test with your own questions before loading it into production.' },
  'terms.s2.h4': { ko: '2.4 결제', en: '2.4 Payments' },
  'terms.s2.p4': { ko: '결제는 자동으로 처리됩니다. AI Network 위에서는 AIN 토큰 전송이며 실행되면 되돌릴 수 없습니다. 로컬 기록 모드의 "노드 크레딧"은 개발용 가상 화폐로 실제 가치가 없습니다. 판매 노드는 결제를 확인한 뒤에만 거래를 정산하며, 환불은 판매자의 재량이고 프로토콜이 중재하지 않습니다.', en: 'Payments are automatic. On the AI Network a payment is an AIN token transfer and is final once executed. "Node credits" in local-record mode are development play money with no real value. The selling node settles a trade only after it has confirmed payment; refunds are at the seller\'s discretion and are not mediated by the protocol.' },
  'terms.s2.h5': { ko: '2.5 금지 행위', en: '2.5 Prohibited use' },
  'terms.s2.list': { ko: '다른 사람의 지식을 출처 표시 없이 베껴 등록하는 행위 (겹침 검사로 탐지되며 재검증을 요청받을 수 있습니다)\n봉인된 정답과 공개된 정답이 다른 질문 묶음을 등록하는 행위\n실제로 측정하지 않은 정답률을 검증 결과로 게시하는 행위\n귀하의 관할권에서 불법인 콘텐츠를 네트워크로 유통하는 행위', en: 'Registering knowledge copied from someone else\'s without attribution (detectable by the overlap check and subject to re-verification)\nRegistering question sets whose sealed answers differ from the revealed answers\nPublishing accuracy that was not actually measured as a verification result\nUsing the network to distribute content that is unlawful in your jurisdiction' },
  'terms.s2.h6': { ko: '2.6 보증 없음', en: '2.6 No warranty' },
  'terms.s2.p6': { ko: '이 소프트웨어는 어떠한 보증도 없이 "있는 그대로" 제공됩니다. 노드 운영자, 검증자, 지식 제작자는 서로 독립된 당사자이며, 지식 사용으로 인한 간접적·결과적 손해에 대해 서로에게 책임지지 않습니다.', en: 'The software is provided "as is", without warranty of any kind. Node operators, verifiers and creators are independent parties; none of them is liable to the others for indirect or consequential damages arising from the use of knowledge.' },
  'terms.s3.title': { ko: '3. 개인정보 처리방침', en: '3. Privacy policy' },
  'terms.s3.h1': { ko: '3.1 노드가 저장하는 정보', en: '3.1 What a node stores about you' },
  'terms.s3.p1': { ko: '이 노드는 이름, 이메일, 분석용 식별자를 수집하지 않습니다. 저장하는 것은 프로토콜에 필요한 정보뿐입니다: 노드 주소(공개키), 접속 주소, 서명된 공개 기록, 결제 증빙(AIN 거래 해시 또는 서명된 크레딧 의사), 내려받기 토큰. 모두 가명 정보이고 대부분은 설계상 공개됩니다. 다른 노드로 복제되며, AI Network 위에서는 나중에 수정할 수 없는 블록체인에 기록됩니다.', en: 'This node does not collect names, e-mail addresses or analytics identifiers. It stores only what the protocol needs: node addresses (public keys), endpoints, signed public records, payment proofs (AIN transaction hashes or signed credit intents) and download tokens. All of it is pseudonymous and most of it is public by design — replicated to other nodes and, on the AI Network, written to a blockchain that cannot be edited afterwards.' },
  'terms.s3.h2': { ko: '3.2 운영자 콘솔', en: '3.2 Operator console' },
  'terms.s3.p2': { ko: '운영자 콘솔에 로그인하면 이 노드에만 세션 쿠키가 설정됩니다. 운영자 비밀번호는 노드 설정 파일에 해시로만 저장되며, 제3자 쿠키는 사용하지 않습니다.', en: 'Signing in to the operator console sets a session cookie on this node only. The operator password is stored only as a hash in the node\'s configuration file. No third-party cookies are used.' },
  'terms.s3.h3': { ko: '3.3 파일과 변경 이력', en: '3.3 Files and change history' },
  'terms.s3.p3': { ko: '운영자가 노드 폴더를 aindrive에 연결하면 그 폴더의 파일(설명서, 질문 묶음, 변경 기록, 지식 파일)은 운영자가 설정한 공유 규칙에 따라 접근할 수 있게 됩니다. 그 서비스에는 aindrive의 약관이 적용됩니다.', en: 'When the operator connects the node\'s folder to aindrive, files in that folder (manifests, question sets, change logs and knowledge files) become accessible according to the sharing rules the operator sets there. aindrive\'s own terms apply to that service.' },
  'terms.s3.h4': { ko: '3.4 귀하의 권리', en: '3.4 Your rights' },
  'terms.s3.p4': { ko: '언제든 노드를 중단하고 데이터 폴더를 삭제할 수 있습니다. 이미 다른 노드로 복제되었거나 블록체인에 기록된 내용은 회수할 수 없습니다. 이는 특정 운영자의 선택이 아니라 프로토콜의 성질입니다.', en: 'You can stop your node at any time and delete its data folder. Records already replicated to other nodes or written to a blockchain cannot be recalled; that is a property of the protocol, not a choice of any operator.' },
  'terms.s4.title': { ko: '4. 문의', en: '4. Contact' },
  'terms.s4.p1': { ko: '약관에 관한 문의:', en: 'Questions about these terms:' },
};
