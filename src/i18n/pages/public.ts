import type { Dict } from '../index';

/**
 * Public-facing pages: landing, explore, benchmark (same-topic list), list item, terms, 404.
 * Plain language only — the technical name of every concept lives in the glossary `tech` field and is surfaced via tooltips.
 *
 * The landing is organised around the four things a node does — serve models, host agents, run scripts, deploy
 * repos — followed by the two things only Ainize does (teaching a model, and one AIN identity across the products).
 * Owner review 2026-10: the old page explained the knowledge marketplace and said nothing about models, agents, run
 * or deploy, which by then were the capabilities most visitors came for. Every promise below is checked against the
 * docs it links to; `test/landing.test.ts` holds the sections, their order and their links.
 */
export const landing: Dict = {
  // nav
  'landing.nav.explore': { ko: '지식', en: 'Knowledge' },
  'landing.nav.teach': { ko: '가르치기', en: 'Teach' },
  'landing.nav.signin': { ko: '로그인', en: 'Sign in' },
  'landing.nav.aria': { ko: '주요 메뉴', en: 'Main' },
  'landing.nav.signin_help': { ko: '노드 운영자·개발자용 콘솔입니다. 모델을 써 보는 데는 로그인이 필요 없습니다.', en: 'Console for node operators and developers. You do not need to sign in to try the models.' },

  // hero — one headline that names all four capabilities, and a terminal trace of the one path that uses all of them
  'landing.hero.title': { ko: '모델을 부르고, 에이전트를 올리고,\n코드를 돌리고, 배포하세요', en: 'Call models, host agents,\nrun code, deploy repos' },
  'landing.hero.sub': { ko: 'API 키 하나로 채팅·판단(Clef)·이미지·음성 모델을 부르고, A2A 에이전트에 공개 주소를 주고, git 저장소를 push할 때마다 샌드박스에서 실행·배포합니다. 그리고 모델을 직접 가르칠 수 있는 곳은 여기뿐입니다.', en: 'One API key calls chat, decision (Clef), image and speech models, gives an A2A agent a public address, and runs or deploys a git repo in a sandbox on every push. And it is the one place you can teach the model itself.' },
  'landing.hero.primary': { ko: '모델 써 보기', en: 'Try the models' },
  'landing.hero.secondary': { ko: '라이브 테스트로 가르치기', en: 'Teach it in Live test' },
  'landing.hero.note': { ko: '모델 체험은 키 없이 브라우저에서 · 키는 지갑 또는 Google 계정으로 발급 · 예금 없음', en: 'Model trials run in the browser with no key · keys are issued to a wallet or a Google account · no deposit' },
  'landing.hero.trace_caption': { ko: 'push 하나가 실행되고 배포되기까지 — 예시 프로젝트 clef-artwork-search가 거치는 단계입니다. 실제 순위는 프로젝트의 배포 로그에 있습니다.', en: 'One push, run and deployed — the steps the example project clef-artwork-search goes through. The real ranking is in the project’s deployment log.' },
  'landing.hero.trace_aria': { ko: 'push에서 배포까지의 터미널 기록', en: 'Terminal record from push to deployment' },

  // capabilities — four cards, in the order the owner named them: models, agents, run, deploy
  'landing.cap.title': { ko: '노드 하나가 하는 네 가지 일', en: 'Four things one node does' },
  'landing.cap.sub': { ko: '아래 네 카드는 모두 같은 API 키와 같은 노드로 이어집니다. 각 카드의 코드는 문서에서 그대로 가져온 것이며, 링크를 누르면 바로 그 화면이 열립니다.', en: 'All four run on the same node with the same API key. The code on each card is lifted from the docs, and each link opens the screen it names.' },

  'landing.cap.models.kicker': { ko: '모델', en: 'Models' },
  'landing.cap.models.title': { ko: 'API 키 하나로 채팅·판단·이미지·음성 모델을 부릅니다', en: 'Call chat, decision, image and speech models with one API key' },
  'landing.cap.models.desc': { ko: '`ainize.connect()`는 이미 쓰고 있는 LLM 클라이언트를 그대로 돌려줍니다. 여기에 `client.decide()` 하나가 더 있어, Cloudflare Clef 판단 모델에 상황과 질문을 주면 문장 대신 확률을 받습니다.', en: '`ainize.connect()` returns the LLM client you already use, plus one extra method: `client.decide()` asks the Cloudflare Clef decision model typed questions about a situation and gets probabilities back, not prose.' },
  'landing.cap.models.cta': { ko: '모델 보기', en: 'Open Models' },
  'landing.cap.models.docs': { ko: '내 코드에서 모델 부르기', en: 'Call the model from your code' },
  'landing.cap.models.docs2': { ko: '판단 모델(Clef) 쓰기', en: 'Use a decision model (Clef)' },

  'landing.cap.agents.kicker': { ko: '에이전트', en: 'Agents' },
  'landing.cap.agents.title': { ko: 'A2A 에이전트에 공개 주소와 카드를 줍니다', en: 'Give an A2A agent a public address and a card' },
  'landing.cap.agents.desc': { ko: '이미 돌고 있는 에이전트는 한 줄로 노드에 등록하고, 없다면 노드가 서빙하는 모델 위에 프롬프트·툴·핸들러 중 하나로 새로 만듭니다. 어느 쪽이든 `/agents/<id>`에서 카드를 서빙하고 마켓플레이스에 올라가며, 연결된 다른 노드에서도 보입니다.', en: 'Register an agent you already run in one line, or create one on a model the node serves — a prompt, tools or a handler. Either way it serves a card at `/agents/<id>`, is listed on the marketplace, and appears on connected nodes too.' },
  'landing.cap.agents.cta': { ko: '에이전트 마켓플레이스', en: 'Agent marketplace' },
  'landing.cap.agents.docs': { ko: '에이전트를 노드에 올리기', en: 'Put an agent on a node' },
  'landing.cap.agents.docs2': { ko: '모델로 에이전트 만들기', en: 'Create an agent from a model' },

  'landing.cap.run.kicker': { ko: '실행', en: 'Run' },
  'landing.cap.run.title': { ko: 'git 저장소의 스크립트를 샌드박스에서 돌립니다 — 키는 자동으로 들어갑니다', en: 'Run a script from a git repo in a sandbox — your key is injected for you' },
  'landing.cap.run.desc': { ko: 'aindrive에서 .py·.js 파일 옆의 ▶ Run을 누르거나 프로젝트의 Runs 탭에서 실행하면, 읽기 전용 컨테이너에 `AINIZE_URL`과 로그인한 사람의 `AINIZE_API_KEY`가 환경 변수로 들어갑니다. 저장소에는 비밀이 들어가지 않고, 표준 출력이 그대로 기록이 됩니다.', en: 'Press ▶ Run beside a .py or .js file in aindrive, or use a project’s Runs tab: the script runs in a read-only container with `AINIZE_URL` and the signed-in person’s `AINIZE_API_KEY` in its environment. No secret goes in the repo, and standard output becomes the record.' },
  'landing.cap.run.cta': { ko: '실행과 입력값 문서', en: 'Runs and inputs in the docs' },
  'landing.cap.run.docs': { ko: 'aindrive 열기', en: 'Open aindrive' },

  'landing.cap.deploy.kicker': { ko: '배포', en: 'Deploy' },
  'landing.cap.deploy.title': { ko: '`ainize.json` 하나로 push마다 배포됩니다', en: 'One `ainize.json`, and every push deploys' },
  'landing.cap.deploy.desc': { ko: 'aindrive 드라이브 안의 저장소 루트에 `ainize.json`을 두면 push마다 노드가 그 커밋을 받아 빌드하고 격리된 샌드박스에서 띄웁니다. 스크립트, Dockerfile 서비스, Next.js 앱, A2A 에이전트 네 종류이고, 배포 목록·로그·이전 배포 유지는 `/<org>/<repo>`에서 봅니다.', en: 'Put `ainize.json` at the root of a repo in an aindrive drive and every push makes the node clone that commit, build it and run it in an isolated sandbox. Four kinds — a script, a Dockerfile service, a Next.js app, an A2A agent — with deployments, logs and the previous deployment kept at `/<org>/<repo>`.' },
  'landing.cap.deploy.cta': { ko: 'ainize.json으로 배포하기', en: 'Deploy a repo with ainize.json' },
  'landing.cap.deploy.docs': { ko: '예시 프로젝트: comcom/clef-artwork-search', en: 'Example project: comcom/clef-artwork-search' },

  // example in 60 seconds — the clef-artwork-search story, which uses all four
  'landing.example.title': { ko: '60초짜리 예시', en: 'An example in 60 seconds' },
  'landing.example.sub': { ko: 'clef-artwork-search는 작품 묘사 한 줄을 받아 Clef 판단 모델로 그림을 순위 매기는 파이썬 파일 세 개입니다. 저장소에는 키가 없고, 서버 설정도 없습니다.', en: 'clef-artwork-search is three Python files that rank artworks against a one-line description with the Clef decision model. There is no key in the repo and nothing configured on a server.' },
  'landing.example.s1.title': { ko: 'push 한 번', en: 'Push' },
  'landing.example.s1.desc': { ko: 'aindrive 드라이브의 저장소에 `ainize.json`과 함께 push합니다. 첫 push가 프로젝트를 만들고, 그 push부터 배포가 시작됩니다.', en: 'Push to the repo in an aindrive drive with `ainize.json` beside the code. The first push creates the project and is itself the first deployment.' },
  'landing.example.s2.title': { ko: '실행', en: 'It runs' },
  'landing.example.s2.desc': { ko: '노드가 그 커밋을 받아 `art_search.py`를 샌드박스에서 돌립니다. 스크립트는 환경 변수의 키로 `client.decide("clef-flash", …)`를 호출합니다.', en: 'The node clones that commit and runs `art_search.py` in the sandbox. The script calls `client.decide("clef-flash", …)` with the key from its environment.' },
  'landing.example.s3.title': { ko: '기록', en: 'The record' },
  'landing.example.s3.desc': { ko: '순위가 표준 출력으로 나오고, 그대로 배포 로그가 됩니다. 프로젝트 페이지에서 배포마다 로그를 다시 열 수 있습니다.', en: 'The ranking goes to standard output and becomes the deployment log. The project page keeps one per deployment, ready to open again.' },
  'landing.example.cta': { ko: '프로젝트 보기', en: 'Open the project' },
  'landing.example.repo': { ko: 'aindrive에서 저장소 보기', en: 'Repo on aindrive' },

  // what only ainize does — teach, and one identity
  'landing.only.title': { ko: 'Ainize만 하는 두 가지', en: 'Two things only Ainize does' },
  'landing.only.teach.kicker': { ko: '가르치기', en: 'Teach' },
  'landing.only.teach.title': { ko: '모델을 고치면, 그 지식이 팔립니다', en: 'Correct the model, and the correction sells' },
  'landing.only.teach.desc': { ko: '라이브 테스트에서 틀린 답을 바로잡거나 질문 파일을 올리면 노드가 그것을 모델 메모리에 직접 쓰는 지식 패치로 굽습니다. 다른 노드 두 곳이 실제 모델에 넣어 채점해야 판매가 열리고, 출처로 밝힌 지식과 나눌 몫이 팔릴 때마다 기록에 남습니다.', en: 'Correct a wrong answer in Live test or upload a file of questions, and the node bakes it into a knowledge patch written straight into the model’s memory. It goes on sale only after two other nodes load it into the real model and score it, and every sale records the split with the knowledge it names as its source.' },
  'landing.only.teach.cta': { ko: '가르치기 시작', en: 'Start teaching' },
  'landing.only.teach.l1': { ko: '지식 패치란', en: 'What a knowledge patch is' },
  'landing.only.teach.l2': { ko: '계보와 로열티', en: 'Lineage and royalties' },
  'landing.only.teach.l3': { ko: '검증이 드는 비용', en: 'What verifying costs' },
  'landing.only.identity.kicker': { ko: '하나의 신원', en: 'One identity' },
  'landing.only.identity.title': { ko: 'AIN 계정 하나, 네 제품', en: 'One AIN account, four products' },
  'landing.only.identity.desc': { ko: 'Ainize, aindrive, AIN Teams, ainmem은 같은 AIN SSO를 씁니다. 드라이브에 push할 수 있는 사람이 곧 배포할 수 있는 사람이고, 조직에 공유한 에이전트는 AIN Teams 워크스페이스에 그대로 들어옵니다. 지갑(MetaMask)이나 Google 계정으로도 로그인할 수 있고, CLI는 `ainize login`으로 같은 계정에 묶입니다.', en: 'Ainize, aindrive, AIN Teams and ainmem share one AIN SSO. Whoever can push to the drive can deploy, and an agent shared with your organization appears in the AIN Teams workspace as it is. A wallet (MetaMask) or a Google account signs in too, and `ainize login` binds the CLI to the same account.' },
  'landing.only.identity.cta': { ko: '로그인', en: 'Sign in' },
  'landing.only.identity.l1': { ko: '조직으로 운영하기', en: 'Run your team as an organization' },
  'landing.only.identity.l2': { ko: 'AIN Teams용 에이전트 만들기', en: 'Build an agent for AIN Teams' },

  // lifecycle — ONE time-ordered diagram of the ecosystem (owner review 2026-09: the one-line commands were grouped
  // by role and read as a menu, not a sequence). Every note here is a promise the shipped product keeps: where a
  // step has no command it says so, and where a step needs an earlier step it names it. README.md carries the same
  // eight steps and test/lifecycle.test.ts fails if the wording of a command or a route drifts apart.
  'landing.flow.title': { ko: '위 그림을 한 걸음씩', en: 'The same picture, one step at a time' },
  'landing.flow.sub': { ko: '위 그림은 네트워크 전체를 한 장에 담은 것이고, 여기는 그 안을 한 사람이 실제 순서대로 걸어가는 길입니다. 여덟 단계마다 명령 한 줄과 눌러서 갈 수 있는 화면이 있고, 마지막 단계가 내가 공개한 지식을 다음 사람에게 넘기면서 다시 처음으로 돌아갑니다.', en: 'The picture above is the whole network at once. This is one person walking through it, in the order it actually happens: eight steps, each a single command and a page you can click — and the last one hands what you published to the next person, so it starts again.' },
  'landing.flow.legend': { ko: '단계마다 움직이는 사람이 바뀝니다:', en: 'Who is acting changes as it goes:' },
  'landing.flow.actor.you': { ko: '나', en: 'You' },
  'landing.flow.actor.node': { ko: '내 노드', en: 'Your node' },
  'landing.flow.actor.network': { ko: '네트워크', en: 'The network' },
  'landing.flow.actor.other': { ko: '다른 사람', en: 'Someone else' },
  'landing.flow.ui_label': { ko: '이 노드에서', en: 'On this node' },
  'landing.flow.loop': { ko: '이제 그들이 공개한 지식이 다음 사람이 만나는 지식입니다 — 그 사람은 맨 위에서 자기 노드를 띄우고 {n}번 단계에서 이 지식을 만납니다.', en: 'What they published is now what the next person finds: they start their own node at the top, and meet it at step {n}.' },
  'landing.flow.readme': { ko: 'README에도 똑같은 여덟 단계가 똑같은 명령과 화면 경로로 적혀 있습니다.', en: 'The README carries the same eight steps, with the same commands and the same routes.' },
  'landing.flow.more': { ko: '자세한 API·CLI 문서', en: 'Full API & CLI reference' },

  'landing.flow.s1.title': { ko: '노드를 띄웁니다', en: 'Run a node' },
  'landing.flow.s1.note': { ko: 'npm install -g ainize로 설치하고 노드를 시작하세요. config.json의 개인 키를 안전하게 백업하세요.', en: 'Install with npm install -g ainize, then start a node. Securely back up the private key in config.json.' },
  'landing.flow.s1.path': { ko: '/ — 이 페이지를 노드가 직접 띄웁니다', en: '/ — the node serves this page itself' },

  'landing.flow.s2.title': { ko: '기본 모델이 답합니다', en: 'The base model answers' },
  'landing.flow.s2.note': { ko: '호환 런타임과 패치 훅이 필요합니다. 라이브 테스트로 지식 적용 전후 답변을 비교하세요.', en: 'Connect a compatible runtime and patch hook. Live test compares answers before and after applying knowledge.' },
  'landing.flow.s2.path': { ko: '/ → 라이브 테스트', en: '/ → Live test' },

  'landing.flow.s3.title': { ko: '남의 지식을 찾아서 씁니다', en: 'Find someone’s knowledge and use it' },
  'landing.flow.s3.note': { ko: '가격과 검증 근거를 확인한 뒤 운영자로 로그인하여 구매·다운로드·적용합니다.', en: 'Review the price and verification evidence, then sign in as an operator to buy, download and apply.' },
  'landing.flow.s3.path': { ko: '/ → 지식 둘러보기 → 지식 상세 → 구매', en: '/ → Explore knowledge → a knowledge page → Buy' },

  'landing.flow.s4.title': { ko: '틀리는 것을 가르칩니다', en: 'Teach it something it gets wrong' },
  'landing.flow.s4.note': { ko: '질문과 정답을 올려 학습하고 검사 결과를 확인하세요. 가르치기 키를 백업하세요.', en: 'Upload questions and answers, train, and inspect the checks. Back up your teaching key.' },
  'landing.flow.s4.path': { ko: '/ → 가르치기 → 데이터셋 올리기', en: '/ → Teach → Upload your dataset' },

  'landing.flow.s5.title': { ko: '공개합니다', en: 'Publish it' },
  'landing.flow.s5.note': { ko: '준비된 수업은 ainize teach publish 또는 브라우저에서 공개합니다. 아래 명령은 기존 지식 파일을 게시하는 운영자용입니다.', en: 'Publish a ready lesson with ainize teach publish or in the browser. The command below publishes an existing knowledge file as an operator.' },
  'landing.flow.s5.path': { ko: '/teach → 내 데이터셋과 수업 → 수업 → 공개하기', en: '/teach → My datasets and lessons → the lesson → Publish' },

  'landing.flow.s6.title': { ko: '다른 노드가 검증해야 팔립니다', en: 'Other nodes verify it before it sells' },
  'landing.flow.s6.note': { ko: '다른 노드의 검증으로 정족수를 충족해야 판매됩니다. 파일 무결성과 실제 답변 채점은 별도로 확인하세요.', en: 'Sales require a quorum of independent attestations. Check file integrity and measured answer quality separately.' },
  'landing.flow.s6.path': { ko: '/ → 네트워크 — 검증에 참여하는 노드들', en: '/ → Network — the nodes that verify' },

  'landing.flow.s7.title': { ko: '다른 사람이 내 지식을 씁니다', en: 'Someone else uses yours' },
  'landing.flow.s7.note': { ko: '구매자는 x402로 결제합니다. 판매 노드는 파일을 유지하고 접속 가능해야 합니다.', en: 'Buyers pay through x402. Keep the seller node reachable and retain the file.' },
  'landing.flow.s7.path': { ko: '/ → 공개 기록 — 서명되어 영구히 남는 판매 기록', en: '/ → Public record — the sale, signed and permanent' },

  'landing.flow.s8.title': { ko: '거기에 더 얹어서 다시 공개합니다', en: 'They add to it and publish again' },
  'landing.flow.s8.note': { ko: '부모 지식을 확보한 뒤 허용된 질문 데이터를 받아 새 수업을 만드세요. 파생 기능과 라이선스를 먼저 확인하세요.', en: 'Acquire the parent knowledge and an accessible dataset before training a derivative. Check lineage support and the licence first.' },
  'landing.flow.s8.path': { ko: '/ → 지식 둘러보기 → 지식 상세 → 출처와 파생', en: '/ → Explore knowledge → a knowledge page → Origins & derivatives' },


  // footer — finding 99: the landing no longer keeps a link list of its own. `components/ui/Footer.tsx` renders the
  // same destinations under the same names on both chromes (dark skin here, purple bar elsewhere), so the
  // `landing.footer.*` keys that used to name Terms / Network / Public record differently from `footer.*` are gone.
};

export const listing: Dict = {
  // sort
  'explore.sort.popular': { ko: '인기순', en: 'Most popular' },
  'explore.sort.latest': { ko: '등록순', en: 'Newest' },
  // Item 267: "Newest" is when the FILE was registered; a daily consumer is asking which DATA is freshest.
  'explore.sort.fresh': { ko: '데이터 최신순', en: 'Freshest data' },
  'explore.sort.price': { ko: '가격순', en: 'Price' },
  'explore.sort.rows': { ko: '지식 크기순', en: 'Knowledge size' },

  // explore
  'explore.title': { ko: '지식 둘러보기', en: 'Explore knowledge' },
  'explore.sub': { ko: '검증 상태와 정답률을 보고 고르세요. 사기 전에 라이브 테스트로 직접 확인할 수 있습니다.', en: 'Choose by verification status and accuracy. You can check any of it with a live test before buying.' },
  'explore.filter.model': { ko: '대상 모델', en: 'Model' },
  'explore.filter.schema': { ko: '주제', en: 'Topic' },
  // Item 188 — one chip per benchmark schema, uncapped, was 136 chips on a teaching node.
  'explore.filter.schema_taught': { ko: '가르친 수업 {n}종', en: 'Taught lessons ({n})' },
  'explore.filter.schema_more': { ko: '+{n}개 더', en: '+{n} more' },
  'explore.filter.schema_help': { ko: '같은 주제의 지식은 같은 질문 묶음으로 채점됩니다.', en: 'Knowledge on the same topic is scored with the same question set.' },
  'explore.filter.all': { ko: '전체', en: 'All' },
  'explore.search': { ko: '이름·질문·주제·만든 이 검색', en: 'Search names, questions, topics, creators' },
  // Items 25 + 206: the search box reaches the questions a knowledge answers, so the card says which one matched.
  /**
   * Item 356 — one label for AIN, decided by the chain the node is actually attached to (utils/useNetwork). The
   * flat `price.ain_note` in common.ts stays for callers that have no node info to read.
   */
  'price.ain_note.local_chain': { ko: 'AIN = AI Network 토큰 · 이 노드는 로컬 개발 체인에 붙어 있어 실제 가치가 없습니다', en: 'AIN = AI Network token · this node is attached to a local development chain, so it has no market value' },
  'price.ain_note.testnet': { ko: 'AIN = AI Network 토큰 · 테스트넷이라 실제 가치가 없습니다', en: 'AIN = AI Network token · this is a test network, so it has no market value' },
  'price.ain_note.mainnet': { ko: 'AIN = AI Network 메인넷 토큰', en: 'AIN = AI Network token, on the mainnet' },
  'price.ain_note.unknown': { ko: 'AIN = AI Network 토큰 · 이 노드는 어느 체인에 붙어 있는지 밝히지 않았습니다', en: 'AIN = AI Network token · this node does not say which chain it is attached to' },
  'explore.filter.track': { ko: '트랙', en: 'Track' },
  'explore.filter.show': { ko: '표시', en: 'Show' },
  'explore.filter.current': { ko: '최신 버전만', en: 'Current only' },
  'explore.filter.all_versions': { ko: '모든 버전', en: 'All versions' },
  'explore.filter.show_help': { ko: '"최신 버전만"은 더 새로운 버전으로 대체된 지식과 검증에 실패한 지식을 숨깁니다.', en: '"Current only" hides knowledge that a newer version replaced and knowledge that failed verification.' },
  'explore.hidden': { ko: '이전 버전 {n}개가 숨겨져 있습니다', en: '{n} older versions hidden' },
  'explore.hidden_one': { ko: '이전 버전 1개가 숨겨져 있습니다', en: '1 older version hidden' },
  'explore.hidden_show': { ko: '보기', en: 'show' },
  'explore.count': { ko: '지식 {n}개', en: '{n} knowledge' },
  'explore.updating': { ko: '새로고침 중…', en: 'updating…' },
  // Finding 70 — the hero says "verified"; this line used to say only how many rows it was showing, so a visitor
  // told there was 1 verified knowledge and then shown 4 could not tell which page was wrong. Both pages count in
  // the same word now, and this count is of what is ON SCREEN, never a node-wide figure that would not match.
  'explore.count_verified': { ko: '그중 {term} {n}개', en: '{n} of them {term}' },
  'explore.count_all_verified': { ko: '모두 {term}', en: 'all of them {term}' },
  'explore.count_all_verified_one': { ko: '{term}', en: '{term}' },
  // Finding 81 — the first result was the 19th focusable element on the page.
  'explore.skip': { ko: '검색 결과로 건너뛰기', en: 'Skip to results' },
  'explore.results': { ko: '전체 지식', en: 'All knowledge' },
  // Finding 76 — the catalogue used to fail with the raw exception text and nothing to do about it.
  'explore.unreachable': { ko: '이 노드의 지식 목록을 불러오지 못했습니다. 노드가 잠시 응답하지 않거나 네트워크가 끊겼을 수 있습니다.', en: 'Could not reach this node’s catalogue. The node may be briefly down, or the network unreachable.' },
  'explore.retry': { ko: '다시 시도', en: 'Try again' },
  'explore.error_detail': { ko: '기술 정보', en: 'Technical detail' },
  'explore.empty': { ko: '조건에 맞는 지식이 없습니다. 다른 모델·주제·검색어를 시도해 보세요.', en: 'No knowledge matches. Try another model, topic or search term.' },

  // Agents in the marketplace. A node sells two kinds of thing — memory a model loads, and a process that does
  // the work — and until now only the first was listed here. The two are separate lists rather than one merged
  // one because nothing a knowledge is sorted or filtered by (model, topic, rows, price) applies to an agent.
  'explore.kind.knowledge': { ko: '지식', en: 'Knowledge' },
  'explore.kind.agent': { ko: '에이전트', en: 'Agents' },
  'explore.kind.label': { ko: '무엇을', en: 'Show' },
  'explore.agents.title': { ko: '에이전트', en: 'Agents' },
  // The heading has to follow the view: a page headed "Explore knowledge" that is listing agents tells the
  // reader they are in the wrong place, which is exactly the doubt the two-way chip exists to remove.
  'explore.title_agent': { ko: '에이전트 둘러보기', en: 'Explore agents' },
  'explore.agents.sub': { ko: '이 노드와, 이 노드가 아는 노드들이 운영하는 A2A 에이전트입니다. 지식은 모델 안에 넣는 기억이고, 에이전트는 일을 대신 해 주는 프로세스입니다. 각 주소는 그 에이전트를 실제로 돌리는 노드의 주소라, 호출은 그 노드로 바로 갑니다.', en: 'A2A agents operated by this node and by the nodes it knows. Knowledge is memory you load into a model; an agent is a process that does the work for you. Every address belongs to the node that actually runs the agent, so a call goes straight there.' },
  'explore.agents.count': { ko: '에이전트 {n}개', en: '{n} agents' },
  'explore.agents.count_one': { ko: '에이전트 1개', en: '1 agent' },
  'explore.agents.empty': { ko: '이 노드도, 이 노드가 아는 노드들도 아직 에이전트를 운영하지 않습니다. 이미 돌고 있는 에이전트가 있다면 `ainize agent add <id> --upstream http://127.0.0.1:9200` 한 줄로 공개 주소가 생깁니다 — 재시작 없이.', en: 'Neither this node nor the nodes it knows operates an agent yet. If you already run one, `ainize agent add <id> --upstream http://127.0.0.1:9200` gives it a public address — no restart.' },
  'explore.agents.empty_search': { ko: '검색어에 맞는 에이전트가 없습니다.', en: 'No agent matches that search.' },
  'explore.agents.unreachable': { ko: '에이전트 목록을 불러오지 못했습니다.', en: 'Could not load the agent list.' },
  'explore.agents.also': { ko: '이 노드는 에이전트 {n}개도 운영합니다', en: 'This node also operates {n} agents' },
  'explore.agents.also_one': { ko: '이 노드는 에이전트 1개도 운영합니다', en: 'This node also operates 1 agent' },
  'explore.agents.also_link': { ko: '보기', en: 'see them' },

  // one agent, as a row
  'agent.state.up': { ko: '응답 중', en: 'Answering' },
  'agent.state.down': { ko: '응답 없음', en: 'Not answering' },
  'agent.state.unknown': { ko: '확인 전', en: 'Not checked' },
  'agent.skill_more': { ko: '+{n}개 더', en: '+{n} more' },
  'agent.protocol': { ko: 'A2A {v}', en: 'A2A {v}' },
  'agent.a2ui': { ko: '화면으로 답함', en: 'Draws its answer' },
  'agent.a2ui_help': { ko: '이 에이전트는 답을 문장뿐 아니라 화면(A2UI)으로도 보냅니다. 그릴 수 있는 곳에서는 표와 점수판으로 보입니다.', en: 'This agent describes its answer as a surface (A2UI) as well as text, so a client that can draw it shows a table or a score card instead of a paragraph.' },
  'agent.calls_label': { ko: '호출', en: 'Calls' },
  'agent.calls': { ko: '이 노드를 거쳐 {n}회', en: '{n} through this node' },
  'agent.calls_one': { ko: '이 노드를 거쳐 1회', en: '1 through this node' },
  'agent.provider': { ko: '운영', en: 'Operated by' },
  'agent.on_node': { ko: '{name} 노드', en: 'on {name}' },
  'agent.remote_note': { ko: '다른 노드의 에이전트입니다 — 호출은 그 노드로 바로 갑니다', en: 'Runs on another node — calls go straight there' },
  'agent.copy': { ko: '주소 복사', en: 'Copy' },
  // The card, not the JSON-RPC endpoint: this is the address a person can open and a workspace is given.
  // The endpoint itself is POST-only and answers a browser with 404, which reads as a broken link.
  'agent.card_label': { ko: '에이전트 카드', en: 'Agent card' },
  'agent.free': { ko: '무료', en: 'Free' },
  'agent.public_note': { ko: 'A2A는 인증을 보내지 않습니다 — 이 주소에 닿을 수 있으면 누구나 호출합니다', en: 'A2A sends no authentication — whoever can reach this address can call it' },
  'agent.try': { ko: '라이브 테스트', en: 'Live test' },

  // benchmark (same-topic) page
  'bench.title': { ko: '같은 주제의 지식', en: 'Knowledge on this topic' },
  // Finding 24 — the form the questions were asked in is part of what the score means
  'item.format': { ko: '문항 형식 {formats}', en: 'asked as {formats}' },
  'item.format_help': { ko: '검증 질문을 어떤 형식으로 물었는지입니다. 형식이 다르면 같은 지식이라도 다른 시험이라 점수를 나란히 비교할 수 없습니다.', en: 'The form the benchmark questions were asked in. A different form is a different exam, so the scores cannot be lined up side by side.' },
  'item.seal_sealed': { ko: '검증 정족수를 채운 현재 버전입니다.', en: 'Passed the verifier quorum and is the current version.' },
  'item.seal_retired': { ko: '검증은 통과했지만 최신 버전으로 대체된 지식입니다.', en: 'Passed verification, but a newer version has replaced it.' },
  'item.seal_pending': { ko: '검증이 아직 진행 중입니다.', en: 'Verification is still arriving.' },
  // Finding 29: "{listed} verified" next to four cards each labelled "Verified" read as "three failed verification".
  // These are the current versions on sale; verification is what the badge on each card says.
  'bench.stats': { ko: '지식 {total}개 · 현재 버전 {listed}개 · 문제 묶음 {sets}개 · 대상 모델: {models}', en: '{total} knowledge · {listed} current version(s) · {sets} question set(s) · models: {models}' },
  // Finding 24: the four items here carry three different benchmark_hashes, so the old promise ("scored with the
  // same question set, so it can be compared") was not true of the list it sat above.
  'bench.explain': { ko: '점수는 같은 문제 묶음 안에서만 비교할 수 있습니다. 아래는 검증에 쓰인 문제 묶음별로 묶어 놓았습니다 — 묶음이 다르면 시험이 다른 것이라 점수를 나란히 비교할 수 없습니다. 내용이 겹치면 더 새로운 검증 완료 지식이 이전 것을 대체합니다("최신 버전 있음").', en: 'Scores are comparable only within one question set. The list below is grouped by the question set the verifiers used — a different set is a different exam, and those numbers cannot be lined up against each other. When contents overlap, the newer verified knowledge replaces the older one ("Newer version available").' },
  'bench.group.title': { ko: '문제 묶음 · {format} · 질문 {n}개', en: 'Question set · {format} · {n} questions' },
  'bench.group.title_noformat': { ko: '문제 묶음 · 질문 {n}개', en: 'Question set · {n} questions' },
  'bench.group.note': { ko: '이 {n}개는 같은 문제 묶음으로 채점돼 서로 비교할 수 있습니다.', en: 'These {n} were scored on this same question set, so they can be compared with each other.' },
  'bench.group.alone': { ko: '이 문제 묶음으로 채점된 지식은 이것뿐이라 비교 대상이 없습니다.', en: 'The only knowledge scored on this question set — nothing here to compare it with.' },
  // Finding 74 — the page whose whole job is "which of these should I buy?" rendered the same prose cards as
  // /explore, so four prices, three accuracies and four sizes were never adjacent. Inside one question set they
  // are a table; these are its columns.
  'bench.col.name': { ko: '지식', en: 'Knowledge' },
  'bench.col.status': { ko: '판매 상태', en: 'Listing' },
  'bench.col.accuracy': { ko: '정답률', en: 'Accuracy' },
  'bench.col.verified': { ko: '독립 검증', en: 'Verifiers' },
  'bench.col.facts': { ko: '담긴 사실', en: 'Facts' },
  'bench.col.rows': { ko: '기억 항목', en: 'Memory entries' },
  'bench.col.size': { ko: '크기', en: 'Size' },
  'bench.col.downloads': { ko: '내려받기', en: 'Downloads' },
  'bench.col.unscored': { ko: '채점 전', en: 'not scored' },
  'bench.back': { ko: '지식 둘러보기로 돌아가기', en: 'Back to Explore' },
  'bench.empty': { ko: '이 주제의 지식이 아직 없습니다.', en: 'No knowledge on this topic yet.' },
  'bench.notfound': { ko: '"{schema}" 주제로 등록된 지식이 없습니다.', en: 'No knowledge is registered under the topic "{schema}".' },

  // Finding 80 — the words this list is made of, defined ON the page instead of only inside hover `title`
  // attributes that no phone and no keyboard could ever reach. One line per list, never one per card.
  'explore.legend.verified': { ko: '다른 모델 서버가 실제 모델에 넣어 채점했습니다', en: 'other model servers loaded it into the real model and scored it' },
  'explore.legend.facts': { ko: '이 지식이 답할 수 있는 질문 수', en: 'how many questions it can answer' },
  'explore.legend.rows': { ko: '모델 기억에서 바뀌는 항목 수', en: 'how many entries it changes in the model’s memory' },
  'explore.legend.accuracy': { ko: '지식을 넣은 모델이 검증 질문을 맞힌 비율', en: 'the share of the benchmark questions the model got right with it loaded' },
  'explore.legend.livetest': { ko: '사기 전에 넣기 전·후 답을 무료로 비교', en: 'compare the before and after answers, free, before you buy' },

  // list item
  'item.verified_by': { ko: '검증 완료 (독립 검증 {passed}/{quorum})', en: 'Verified ({passed}/{quorum} independent verifiers)' },
  'item.verified_extra': { ko: '(+{n}건 더)', en: '(+{n} more)' },
  'item.verified_challenged': { ko: '검증 {passed}/{quorum} — 이의 제기됨, 재검증 대기', en: 'Verified {passed}/{quorum} — challenged, re-verification pending' },
  'item.verifying_by': { ko: '검증 중 (독립 검증 {passed}/{quorum})', en: 'Verifying ({passed}/{quorum} independent verifiers)' },
  'item.integrity_only': { ko: '무결성만 확인 {n}', en: 'integrity-only checks: {n}' },
  'item.integrity_help': { ko: '파일이 손상되지 않았는지만 확인한 검증입니다. 정답률을 재지 않았으므로 검증 완료 수에 넣지 않습니다.', en: 'Checked only that the file is intact — no accuracy was measured, so it does not count toward verification.' },
  'item.accuracy': { ko: '정답률 {pct}%', en: '{pct}% accuracy' },
  // The denominator is the attestation's own ('26/26'), never the anchor's benchmark.queries — the verifiers
  // scored 26 questions, not the 2,761 the knowledge covers.
  'item.accuracy_checked': { ko: '정답률 {pct}% ({raw} 채점)', en: '{pct}% ({raw} checked)' },
  'item.accuracy_raw': { ko: '검증 질문 {raw} 정답', en: '{raw} benchmark questions correct' },
  // Item 267: the browse cards carried no date at all, so a bake from three weeks ago and this morning's looked
  // identical, and the only place a data day lived was the name the publisher invented for it.
  'item.as_of': { ko: '데이터 기준일 {date}', en: 'Data as of {date}' },
  'item.registered_on': { ko: '{date} 등록', en: 'registered {date}' },
  // Item 201 — the number is settle records: sales. It was labelled "downloads" on every card.
  'item.sales': { ko: '판매 {n}건', en: '{n} sales' },
  'item.sales_recent': { ko: '판매 {n}건 (최근 30일 {r}건)', en: '{n} sales ({r} in the last 30 days)' },
  'item.downloads': { ko: '내려받기 {n}회', en: '{n} downloads' },
  'item.size': { ko: '크기 {size}', en: 'Size {size}' },
  'item.topic': { ko: '주제', en: 'Topic' },
  'item.price_free': { ko: '무료', en: 'Free' },
  'item.price_ain': { ko: '{n} AIN', en: '{n} AIN' },
  'item.price_credit': { ko: '{n} 노드 크레딧', en: '{n} node credits' },
  'item.price_usdc': { ko: '{n} USDC', en: '{n} USDC' },
  'item.price_note_usdc': { ko: 'USDC = 달러 연동 스테이블코인', en: 'USDC = dollar-pegged stablecoin' },

  // Finding 282 — nothing on the browse surfaces said a knowledge was an add-on, so a buyer comparing a 5-credit
  // base with a 3-credit item built on it could not tell which was which until the fourth tab of the detail page.
  // `base.stack` is the table state the body was trained against: without it underneath, the rows mean nothing.
  // Item 308: the lessons table's money column is the SALE total; "Your share" is the other table's word for the
  // teacher's own cut, and both are shown per lesson so the two numbers cannot be mistaken for each other.
  // (The rest of the teacher page's strings live with the teach dictionary; these two belong to this pair.)
  'teacher.h.sales_total': { ko: '판매 합계', en: 'Sales total' },
  'teacher.h.sales_total_help': { ko: '이 수업이 팔린 금액의 합계입니다. 가르친 사람이 받는 몫은 오른쪽 열입니다.', en: 'What this lesson sold for in total. What the teacher receives is the column on the right.' },
  'item.match': { ko: '검색어와 맞는 질문: “{prompt}” → {expect}', en: 'Matching question: “{prompt}” → {expect}' },
  'item.match_help': { ko: '이 지식이 답할 수 있는 질문 중 검색어와 맞는 것입니다. 이름이나 설명이 아니라 내용이 맞았습니다.', en: 'One of the questions this knowledge can answer that matches your search — the content matched, not the name or description.' },
  'item.addon': { ko: '애드온 · {names} 위에서 동작', en: 'Add-on · runs on {names}' },
  'item.addon_help': { ko: '이 지식만으로는 동작하지 않습니다. {names}를 함께 가지고 있어야 하고, 모델에 넣을 때도 그 아래에 먼저 들어가야 합니다. 가격 비교를 할 때는 두 지식의 값을 함께 보세요.', en: 'This does not work on its own: you have to hold the knowledge it names as well, and load that underneath it. Compare its price together with what its base costs.' },
  'item.built_on': { ko: '{names} 위에 만든 지식', en: 'Built on {names}' },
  'item.built_on_help': { ko: '이 지식은 앞선 지식에서 갈라져 나왔습니다. 따로 동작하지만, 팔릴 때마다 원작자에게도 수익이 나뉩니다.', en: 'This one grew out of the knowledge it names. It works on its own, and every sale shares revenue with that creator.' },
  // Finding 200 — the two facts a creator needs before building on someone's knowledge, on the card where they
  // are comparing. Both are absent from every anchor written before the lineage fields, and absent means absent:
  // no chip is drawn rather than a default that would be a claim this node cannot make.
  'item.license': { ko: '라이선스 {name}', en: 'Licence {name}' },
  'item.license_help': { ko: '이 지식과 학습 데이터에 붙은 이용 조건입니다. 위에 얹어 새 지식을 만들려면 이 조건을 따라야 합니다.', en: 'The terms attached to this knowledge and its training set. Anything you build on top has to follow them.' },
  'item.dataset_public': { ko: '학습 데이터 공개', en: 'Training set: public' },
  'item.dataset_derivative': { ko: '학습 데이터: 파생 제작자에게 공개', en: 'Training set: open to people building on it' },
  'item.dataset_private': { ko: '학습 데이터 비공개', en: 'Training set: private' },
  'item.dataset_help': { ko: '이 지식을 만든 질문·정답 묶음을 누가 읽을 수 있는지입니다. 읽을 수 있어야 그 위에 더 가르쳐서 새 지식을 만들 수 있습니다.', en: 'Who may read the questions and answers this was trained from. You need that access to teach on top of it.' },
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
  'terms.s2.p3': { ko: '검증 결과는 독립된 검증 노드가 자기 노드 키로 서명해 게시합니다. 걸어 둔 보증금은 없으며, 잘못된 검증에는 누구나 이의를 제기할 수 있고 이의가 제기되면 재검증까지 판매가 멈춥니다. 지식을 등록한 노드가 스스로 남긴 검증은 집계에 넣지 않습니다. 각 결과에는 어떤 환경에서 측정했는지가 기록됩니다. "무결성만 확인"으로 표시된 결과는 파일이 손상되지 않았는지만 확인한 것이며 정답률을 보증하지 않습니다.\n"검증 완료"는 지식이 항상 옳다거나 부작용이 전혀 없음을 보장하지 않습니다. 실제 서비스에 넣기 전에는 본인의 질문으로 라이브 테스트를 다시 해 보시기 바랍니다.', en: 'Verification results are published by independent verifier nodes, each signed with the node\u2019s own identity key. No deposit is escrowed: instead any node can challenge a result, and a challenge takes the knowledge off sale until it is re-verified. An attestation by the node that published the knowledge is never counted. Each result records the environment it was measured in. Results marked "integrity-only" confirm only that the file is intact and do not vouch for accuracy.\n"Verified" does not guarantee that knowledge is always correct or free of side effects. Re-run a live test with your own questions before loading it into production.' },
  'terms.s2.h4': { ko: '2.4 결제', en: '2.4 Payments' },
  'terms.s2.p4': { ko: '결제는 자동으로 처리됩니다. AI Network 위에서는 AIN 토큰 전송이며 실행되면 되돌릴 수 없습니다. 다만 노드가 개발용 로컬 체인이나 테스트넷에 붙어 있으면 그 AIN은 시장 가치가 없습니다 — 어느 체인인지는 각 노드가 /api/info로 공개하며, 화면의 금액 아래에도 표시됩니다. 로컬 기록 모드의 "노드 크레딧"은 개발용 가상 화폐로 실제 가치가 없습니다. 판매 노드는 결제를 확인한 뒤에만 거래를 정산하며, 환불은 판매자의 재량이고 프로토콜이 중재하지 않습니다.', en: 'Payments are automatic. On the AI Network a payment is an AIN token transfer and is final once executed. Where the node is attached to a development chain or a test network, that AIN has no market value — each node publishes which chain it uses, and every amount on screen is labelled with it. "Node credits" in local-record mode are development play money with no real value. The selling node settles a trade only after it has confirmed payment; refunds are at the seller\'s discretion and are not mediated by the protocol.' },
  'terms.s2.h5': { ko: '2.5 금지 행위', en: '2.5 Prohibited use' },
  'terms.s2.list': { ko: '다른 사람의 지식을 출처 표시 없이 베껴 등록하는 행위 (겹침 검사로 탐지되며 재검증을 요청받을 수 있습니다)\n지식이 실제로 답하는 내용과 다른 정답을 붙인 검증 질문 묶음을 등록하는 행위\n실제로 측정하지 않은 정답률을 검증 결과로 게시하는 행위\n귀하의 관할권에서 불법인 콘텐츠를 네트워크로 유통하는 행위', en: 'Registering knowledge copied from someone else\'s without attribution (detectable by the overlap check and subject to re-verification)\nRegistering question sets whose stated answers are not what the knowledge actually answers\nPublishing accuracy that was not actually measured as a verification result\nUsing the network to distribute content that is unlawful in your jurisdiction' },
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
  // §3.5 — what teaching stores (linked from the /teach trust strip, ux-critique-owner O-10); every sentence is what the code does
  'terms.s3.h5': { ko: '3.5 모델을 가르칠 때 저장되는 것', en: '3.5 What a node stores when you teach it' },
  'terms.s3.p5': { ko: '라이브 테스트에서 바로잡은 내용이나 올린 파일은 질문과 정답의 데이터셋으로 이 노드에 저장되고, 그 데이터셋으로 만든 수업(지식 파일)도 함께 저장됩니다. 파일은 학습이 끝나면 바로 삭제하도록 선택할 수 있고, 그렇지 않으면 올릴 때 화면에 표시되는 기간 동안 보관됩니다. 공개하지 않은 초안은 내 데이터셋과 수업에서 언제든 직접 지울 수 있으며, 노드가 정한 기간이 지나면 자동으로 지워집니다.\n공개하기 전까지는 이 노드의 운영자만 그 내용을 볼 수 있습니다. 운영자에게는 비공개가 아닙니다. 개인정보나 공유할 권리가 없는 내용은 올리지 마세요.\n가르치기 키는 브라우저에서 만들어져 브라우저에만 보관됩니다. 노드는 그 키의 공개 주소(수업에 서명하고 판매 수익을 받는 곳)만 저장하며, 비밀키는 어떤 노드에도 전송되지 않습니다. 브라우저 저장소를 지우면 키가 사라지므로 백업을 내려받아 두세요.\n공개는 별도의 단계입니다. 내 키로 서명하고 두 가지 동의(영구 공개 기록이 된다는 것, 공유할 권리가 있다는 것)를 표시한 뒤에만 이 노드가 수업을 공개 기록에 올립니다. 공개된 질문·정답·표시 이름·정산 주소는 다른 노드로 복제되며 수정하거나 삭제할 수 없습니다.', en: 'What you correct in Live test or upload as a file is stored on this node as a dataset of questions and answers, together with the lesson (the knowledge file) trained from it. You can choose to have the file deleted as soon as training finishes; otherwise it is kept for the period shown on the upload page. A draft you have not published can be deleted by you at any time from My datasets and lessons, and is deleted automatically after the period this node sets.\nUntil you publish, only the operator of this node can see that content. It is not private from the operator. Do not upload personal data or anything you do not have the right to share.\nYour teaching key is created in the browser and kept only there. The node stores the key\'s public address (which signs your lessons and receives your share of sales); the private key is never sent to any node. Clearing the browser\'s storage loses the key, so download a backup.\nPublishing is a separate step. Only after you sign with your key and tick both consents (that it becomes a permanent public record, and that you have the right to share it) does this node put the lesson on the public record. Published questions, answers, display name and payout address are replicated to other nodes and cannot be edited or deleted.' },
  'terms.s4.title': { ko: '4. 문의', en: '4. Contact' },
  'terms.s4.p1': { ko: '약관에 관한 문의:', en: 'Questions about these terms:' },
};
