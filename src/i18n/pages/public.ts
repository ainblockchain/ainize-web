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
  'landing.nav.signin': { ko: '로그인', en: 'Sign in' },
  'landing.nav.aria': { ko: '주요 메뉴', en: 'Main' },
  'landing.nav.signin_help': { ko: '노드 운영자·개발자용 콘솔입니다. 지식을 사서 쓰는 데는 로그인이 필요 없습니다.', en: 'Console for node operators and developers. You do not need to sign in to use knowledge.' },

  // hero
  'landing.hero.title': { ko: '기억을 굽는다', en: 'Bake your own memory' },
  'landing.hero.sub': { ko: '찾아본 것을 아는 것으로 바꾸세요. 지식은 문서가 아니라 내 노드에서 도는 모델의 메모리에 직접 써 넣은 것이고,\n재시작 없이 올렸다 내렸다 하며, 다른 노드가 채점해야 올라오고, 팔릴 때마다 출처로 밝힌 지식과 나눌 몫이 기록에 남습니다.', en: 'Turn what you look up into what you know. A knowledge here is written straight into the memory rows of the model running on your own node, not retrieved —\nloaded and removed with no restart, on sale only after other model servers score it, and every sale is recorded as a split with the knowledge it names.' },
  // Finding 77: the hero's headline is a fact from this node, and an unreachable node rendered it as a grey bar for
  // ever. When there is no answer the card says so instead of pretending to be loading.
  'landing.hero.offline': { ko: '이 노드에 연결하지 못했습니다', en: 'This node is not answering' },
  'offline.what.landing': { ko: '이 노드가 가진 지식 목록', en: 'The knowledge this node lists' },
  'landing.hero.count': { ko: '검증 완료 지식 {n}개', en: '{n} verified knowledge' },
  // `knowledge` is a mass noun, so the count form has to carry the noun itself at n=1 — "1 verified knowledge"
  // was the reviewer's second complaint about this line (finding 13).
  'landing.hero.count_one': { ko: '검증 완료 지식 1개', en: 'One verified knowledge' },
  'landing.hero.count_verifying': { ko: '검증 중 {n}개', en: '{n} being verified' },
  'landing.hero.count_help': { ko: '다른 모델 서버 두 곳이 실제 모델에 넣어 정답률과 부작용까지 확인한 지식의 수입니다. 주소나 회사가 아니라 서로 다른 모델 서버를 셉니다.', en: 'Knowledge that two other model servers loaded into the real model and checked for accuracy and side effects. The count is over distinct model servers, not over addresses or companies.' },
  // Finding 13 — a count is only a headline once there is a market to count. Under `NAME_LISTED_BELOW` the hero
  // names the knowledge that is actually here instead of shouting "1 verified knowledge", and with nothing listed
  // it says what the node is doing (verifying) rather than advertising an empty shelf.
  'landing.hero.lead_one': { ko: '‘{name}’ — {model}에서 검증 완료', en: '“{name}” — verified on {model}' },
  // Never two names side by side: a knowledge name runs to 80 characters, and two of them at 28 px bold filled the
  // whole card on a phone (measured: 150 characters, 8 wrapped lines). One name carries the concreteness; the rest
  // are a count.
  'landing.hero.lead_more': { ko: '‘{name}’ 외 {n}개 — 실제 모델에서 검증 완료', en: '“{name}” and {n} more — verified on the real model' },
  'landing.hero.lead_sub': { ko: '다른 모델 서버 두 곳이 실제 모델에 넣어 채점한 뒤에 판매가 열린 지식입니다.', en: 'Two other model servers loaded each one into the real model and scored it before it went on sale.' },
  'landing.hero.lead_verifying': { ko: '지금 검증 중인 지식 {n}개', en: '{n} knowledge in verification right now' },
  'landing.hero.lead_verifying_one': { ko: '지금 지식 1개가 검증 중입니다', en: 'One knowledge is in verification right now' },
  'landing.hero.lead_verifying_sub': { ko: '다른 모델 서버가 하나씩 실제 모델에 넣어 채점하고 있습니다. 통과한 지식만 판매가 열립니다.', en: 'Other model servers are loading each one into the real model and scoring it. Whatever passes goes on sale here.' },
  'landing.hero.lead_empty': { ko: '이 노드에는 아직 올라온 지식이 없습니다', en: 'No knowledge is listed on this node yet' },
  'landing.hero.lead_empty_sub': { ko: '지식은 다른 모델 서버가 실제 모델에 넣어 채점한 뒤에만 판매가 열립니다.', en: 'Knowledge goes on sale here only after other model servers load it into the real model and score it.' },
  'landing.hero.primary': { ko: '지식 둘러보기', en: 'Explore knowledge' },
  'landing.hero.secondary': { ko: '라이브 테스트 해보기', en: 'Try a live test' },
  /** Keeps the dashed half of the hero diagram honest: combining is built and off by default. */
  'landing.hero.art_legend': { ko: '질문 하나가 지나갈 때, 세 사람이 각자 써 넣은 메모리 행이 차례로 켜집니다. 답 하나가 여러 사람의 기여로 만들어지는 자리입니다.\n실선은 노드가 오늘 실제로 하는 일이고, 점선은 지식 두 개를 합치는 기능인데 만들어져 있고 노드마다 켜야 씁니다.', en: 'One question crosses the table and three people’s memory rows light in turn: one answer being made out of several contributions.\nSolid lines are what a node does today; dotted is combining two knowledges, which is built and switched on per node.' },
  'landing.hero.note': { ko: '회원가입 없음 · 결제는 지갑(AIN) 또는 노드 크레딧으로 자동 처리 · 언제든 뺄 수 있음', en: 'No sign-up · pays automatically with a wallet (AIN) or node credit · removable any time' },

  // audience
  'landing.audience.title': { ko: '어떤 분이신가요?', en: 'Which one are you?' },
  'landing.audience.sub': { ko: '위 그림의 선에는 저마다 주인이 있습니다. 그 세 사람입니다.', en: 'Every line in the picture above belongs to somebody. These are the three of them.' },
  'landing.audience.user.s1': { ko: '돈을 내는 쪽입니다. 내 주제와 내 모델에 맞으면서 다른 모델 서버 두 곳이 이미 채점한 지식을 찾습니다.', en: 'You are the one paying: find knowledge two other model servers already scored, for your topic and your model.' },
  'landing.audience.user.s2': { ko: '같은 질문을 넣기 전/후 모델에 물어 답이 달라지는지 직접 봅니다.', en: 'Ask the same question before and after loading it and see the answer change.' },
  'landing.audience.user.s3': { ko: '마음에 들면 결제 후 몇 초 만에 모델에 넣고, 언제든 뺍니다.', en: 'If you like it, pay and load it in seconds — unload any time.' },
  'landing.audience.user.cta': { ko: '지식 둘러보기', en: 'Explore knowledge' },
  // creator card = teach mode (spec §5.1): the visitor teaches the model in Live test; registering a file is the operator's route
  'landing.audience.creator.title': { ko: '모델에게 가르치고 싶어요', en: 'I want to teach the model something' },
  'landing.audience.creator.s1': { ko: '라이브 테스트에서 물어보고, 틀리면 바로잡습니다.', en: 'Ask the model in Live test and correct it when it is wrong.' },
  'landing.audience.creator.s2': { ko: '이 노드가 내 바로잡기를 지식으로 학습합니다. 로그인도 내 서버도 필요 없습니다.', en: 'This node trains your corrections into knowledge — no sign-in, no server of your own.' },
  'landing.audience.creator.s3': { ko: '나만 쓰거나, 공개해서 팔릴 때마다 정산받습니다.', en: 'Keep it private, or publish it and get paid on every sale.' },
  'landing.audience.creator.s4': { ko: '노드가 켜 둔 곳에서는 남이 만든 지식 위에 얹어 만들고 그 지식을 출처로 밝힐 수 있습니다. 그러면 내 지식이 팔릴 때마다 그 사람 몫도 함께 기록됩니다.', en: 'Where a node switches it on, you can build on someone else’s knowledge instead of starting over and name it as your source — then they get a share of every sale of yours.' },
  'landing.audience.creator.cta': { ko: '모델 가르치기', en: 'Teach the model' },
  'landing.audience.creator.operator_link': { ko: '이미 지식 파일(.npz)이 있고 노드를 운영하나요? 파일 등록 →', en: 'Already have a knowledge file (.npz) and run a node? Register a file →' },
  'landing.audience.creator.off': { ko: '이 노드는 지금 수업을 받지 않습니다. 라이브 테스트는 그대로 쓸 수 있습니다.', en: 'This node is not accepting lessons right now. Live test still works.' },
  'landing.audience.operator.s1': { ko: '노드를 띄워 지식을 팔고 검증에 참여합니다.', en: 'Run a node to sell knowledge and take part in verification.' },
  'landing.audience.operator.s2': { ko: '검증 결과는 노드 키로 서명되어 공개 기록에 남습니다. 잘못된 검증에는 누구나 이의를 제기할 수 있고, 그때 판매가 멈춥니다.', en: 'Every verification you publish is signed with your node key and stays on the public record. Any node can challenge a wrong one, and a challenge stops the sale.' },
  'landing.audience.operator.s3': { ko: 'HTTP API로 AI 에이전트가 지식을 직접 사고 넣도록 자동화합니다.', en: 'Automate with the HTTP API so AI agents buy and load knowledge themselves.' },
  'landing.audience.operator.cta': { ko: '운영자 콘솔 열기', en: 'Open the operator console' },


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
  'landing.flow.s1.note': { ko: '이 프로세스 하나가 마켓 웹사이트이자 CLI입니다. 먼저 저장소를 클론하고 `npm install && npm run build`를 하세요 — 공개 npm 패키지는 아직 없습니다. `init`이 config.json에 쓰는 키가 곧 노드입니다. 이 노드가 공개한 모든 지식과 잔액이 그 키의 것이고, 사본은 그 파일 하나뿐입니다.', en: 'The same process is the marketplace site and the CLI. Clone the repo first and run `npm install && npm run build` — there is no public npm package yet. The key `init` writes into config.json is the node: it owns everything the node publishes and its balance, and that file is the only copy.' },
  'landing.flow.s1.path': { ko: '/ — 이 페이지를 노드가 직접 띄웁니다', en: '/ — the node serves this page itself' },

  'landing.flow.s2.title': { ko: '기본 모델이 답합니다', en: 'The base model answers' },
  'landing.flow.s2.note': { ko: '아직 아무 지식도 넣지 않은 답이 라이브 테스트의 “넣기 전” 칸입니다. 모델만 따로 부르는 명령은 없습니다 — `chat`은 언제나 넣기 전과 후를 함께 답해서, 설명 대신 차이를 직접 보게 합니다. 브라우저의 라이브 테스트는 무료이고, 구매가 아닙니다.', en: 'With nothing loaded yet, that answer is the “before” column of a live test. No command asks the bare model on its own — `chat` always answers before and after, so you see the difference instead of a claim about it. In the browser the live test is free, and it is not a purchase.' },
  'landing.flow.s2.path': { ko: '/ → 라이브 테스트', en: '/ → Live test' },

  'landing.flow.s3.title': { ko: '남의 지식을 찾아서 씁니다', en: 'Find someone’s knowledge and use it' },
  'landing.flow.s3.note': { ko: '둘째 줄 한 줄로 검증 여부 확인 → 결제 → 내려받기 → 재시작 없이 실행 중인 모델에 넣기까지 끝납니다. 구매는 노드 운영자의 몫이라 `ainize login`이 먼저이고, 검증을 마쳐 판매 중인 지식만 살 수 있습니다. 브라우저에서는 무료로 라이브 테스트만 되고 구매는 되지 않습니다.', en: 'The second line checks it is verified, pays, downloads and loads it into the running model with no restart. Buying is the node operator’s action, so `ainize login` comes first, and only knowledge that finished verification is on sale. In the browser you can live-test it free, but not buy it.' },
  'landing.flow.s3.path': { ko: '/ → 지식 둘러보기 → 지식 상세 → 구매', en: '/ → Explore knowledge → a knowledge page → Buy' },

  'landing.flow.s4.title': { ko: '틀리는 것을 가르칩니다', en: 'Teach it something it gets wrong' },
  'landing.flow.s4.note': { ko: '내 질문과 정답이 수업이 되고, 노드가 학습한 뒤 상관없는 질문들을 다시 물어 다른 답이 망가지지 않았는지 확인합니다. 가르치기는 운영자가 켜 둔 노드에서만 되고 기본값은 꺼짐입니다. 계정은 없습니다 — 브라우저나 `<AINIZE_HOME>/teaching-key.json`에 있는 teaching key가 신원 전부라, 백업을 잃으면 수업도 그 수익도 잃습니다.', en: 'Your questions and their right answers become a lesson: the node trains it, then re-asks unrelated questions to prove nothing else moved. Teaching only works on a node whose operator switched it on — it is off by default. There is no account: a teaching key, in your browser or at `<AINIZE_HOME>/teaching-key.json`, is the whole identity, and losing the backup loses the lesson and its earnings.' },
  'landing.flow.s4.path': { ko: '/ → 가르치기 → 데이터셋 올리기', en: '/ → Teach → Upload your dataset' },

  'landing.flow.s5.title': { ko: '공개합니다', en: 'Publish it' },
  'landing.flow.s5.note': { ko: '데이터 제공자는 브라우저에서 공개합니다 — 이 경로의 CLI는 아직 없습니다. 위 명령은 노드 컴퓨터에 이미 지식 파일이 있는 운영자용입니다. 공개는 파일이 아니라 경로를 보내므로, 지식을 파는 노드는 그 파일을 들고 있는 노드입니다. 검증 문항은 필수이고 질문과 정답이 함께 공개됩니다 — 그래야 누구든 검증자의 채점을 다시 해 볼 수 있습니다.', en: 'A data provider publishes in the browser — there is no CLI for that path yet; the line above is the operator’s route for a knowledge file already on the node’s machine. Publishing sends a path, not bytes, so the node that sells the knowledge is the node holding the file. A benchmark is required and its questions and expected answers become public — that is what makes a verifier’s score checkable by anyone.' },
  'landing.flow.s5.path': { ko: '/teach → 내 데이터셋과 수업 → 수업 → 공개하기', en: '/teach → My datasets and lessons → the lesson → Publish' },

  'landing.flow.s6.title': { ko: '다른 노드가 검증해야 팔립니다', en: 'Other nodes verify it before it sells' },
  'landing.flow.s6.note': { ko: '공개했다고 판매가 시작되지 않습니다. 검증자 역할을 가진 다른 모델 서버 두 곳이 실제 모델에 넣어 채점해야 하고, 채점 결과는 지식 상세의 “검증” 탭에 남습니다. 내 노드가 스스로 낸 검증은 거부되고 절대 세지 않습니다. 그래서 피어가 없는 노드는 아무것도 판매 상태가 되지 못하는데 이 저장소에는 기본 피어 목록이 없습니다 — 피어를 직접 추가하거나 노드를 하나 더 띄우세요.', en: 'Publishing is not selling. Two other model servers with the verifier role have to load it into the real model and score it, and the score lands on the knowledge page under Verification. Your own attestation is refused and never counted, so a node with no peers lists nothing — and this repo ships no bootstrap peer list. Add a peer, or run a second node yourself.' },
  'landing.flow.s6.path': { ko: '/ → 네트워크 — 검증에 참여하는 노드들', en: '/ → Network — the nodes that verify' },

  'landing.flow.s7.title': { ko: '다른 사람이 내 지식을 씁니다', en: 'Someone else uses yours' },
  'landing.flow.s7.note': { ko: '첫 줄은 그 사람이, 둘째 줄은 판매를 확인하려는 내가 실행하는 명령입니다. 결제는 x402로 지갑(AIN) 또는 노드 크레딧에서 이뤄지고, 파일은 내 노드에서 나갑니다 — 지식을 들고 있는 노드가 파는 노드이기 때문입니다. 그래서 내 노드는 계속 접속 가능해야 하고 파일도 그대로 갖고 있어야 합니다. 어떤 검증자든 이의를 제기하면 다시 검증될 때까지 판매가 멈춥니다.', en: 'The first line is theirs; the second is what you run to see the sale. They pay over x402 from a wallet (AIN) or node credit, and the file comes from your node, because the node holding the knowledge is the node selling it. So your node has to stay reachable and still hold the body. Any verifier can challenge it, and a challenge stops the sale until it is re-run.' },
  'landing.flow.s7.path': { ko: '/ → 공개 기록 — 서명되어 영구히 남는 판매 기록', en: '/ → Public record — the sale, signed and permanent' },

  'landing.flow.s8.title': { ko: '거기에 더 얹어서 다시 공개합니다', en: 'They add to it and publish again' },
  'landing.flow.s8.note': { ko: '내 지식을 확보하는 일은 저절로 따라오지 않는 별도의 단계입니다 — 그 위에 가르치려면 상대 노드가 파일을 들고 있어야 하므로 첫 줄이 먼저 성공해야 합니다. 둘째 줄은 내가 공개할 때 질문을 읽을 수 있게(전체 공개, 또는 파생 지식을 만드는 사람에게만) 정해 둔 경우에만 됩니다. 새 수업은 내 지식을 부모로 기록하고 팔릴 때마다 수익을 나눠 주며, 자식은 부모와 계속 묶여 있습니다 — 부모 없이 자식만 사는 것도, 부모를 밑에 올리지 않고 적용하는 것도 거부됩니다.', en: 'Acquiring your knowledge is a step of its own, not an implication: to teach on top of it their node must hold the body, so the first line has to succeed first. The second line only works if you published the questions as readable — by anyone, or by people building on it. The new lesson records yours as its parent and shares revenue with you on every sale, and the child stays tied to the parent: buying it without the parent is refused, and so is loading it without the parent underneath.' },
  'landing.flow.s8.path': { ko: '/ → 지식 둘러보기 → 지식 상세 → 출처와 파생', en: '/ → Explore knowledge → a knowledge page → Origins & derivatives' },

  // how it works
  'landing.how.title': { ko: '이렇게 됩니다', en: 'How it works' },
  'landing.how.sub': { ko: '위 그림에서 지식 하나만 확대한 것입니다. 세 단계면 끝나고, 재학습도 재시작도 없습니다.', en: 'A close-up of one knowledge from the picture above. Three steps. No retraining, no restart.' },
  'landing.how.step1.title': { ko: '검증', en: 'Verified' },
  'landing.how.step1.desc': { ko: '등록된 지식은 다른 노드 두 곳이 실제 모델에 넣어 채점합니다. 정답률뿐 아니라 다른 지식이 망가지거나 환각이 늘지 않는지(부작용 검사)까지 보고, 이 둘은 주소가 아니라 서로 다른 모델 서버로 셉니다.', en: 'Two other nodes load each registered knowledge into the real model and score it — accuracy, plus a side-effect check that nothing else breaks and hallucination does not rise. The two are counted as distinct model servers, not as addresses.' },
  'landing.how.step2.title': { ko: '라이브 테스트', en: 'Live test' },
  'landing.how.step2.desc': { ko: '사기 전에 직접 물어보세요. 같은 질문을 지식을 넣기 전과 후의 모델에 던져 답이 어떻게 달라지는지 나란히 봅니다.', en: 'Ask before you buy. Put the same question to the model before and after the knowledge is loaded and compare the answers side by side.' },
  'landing.how.step3.title': { ko: '모델에 넣기', en: 'Load into model' },
  'landing.how.step3.desc': { ko: '결제는 자동으로 처리되고, 지식은 몇 초 만에 내 노드에서 도는 모델에 들어갑니다. 겹침·충돌 검사가 먼저 돌고, 마음이 바뀌면 언제든 뺄 수 있습니다.', en: 'Payment is automatic and the knowledge is in the model on your own node in seconds. An overlap check runs first, and you can unload whenever you change your mind.' },

  // trending
  'landing.trending.title': { ko: '지금 많이 찾는 검증 완료 지식', en: 'Popular verified knowledge' },
  'landing.trending.sub': { ko: '검증을 통과해 바로 모델에 넣을 수 있는 지식입니다. 어떤 지식을 출처로 밝혔거나 이 지식을 출처로 밝힌 지식이 있으면 카드에 함께 적힙니다.', en: 'Passed verification and ready to load. Where a knowledge names another as its source, or something names it, the card says so.' },
  'landing.trending.built_on': { ko: '‘{name}’을(를) 출처로 밝힘', en: 'Names “{name}” as its source' },
  'landing.trending.built_on_count': { ko: '이 지식을 출처로 밝힌 지식 {n}개', en: '{n} knowledge names this as its source' },
  'landing.trending.empty': { ko: '아직 검증 완료된 지식이 없습니다. 검증 노드들이 채점하는 중이니 잠시 후 다시 확인해 주세요.', en: 'No knowledge has completed verification yet. Verifier nodes are scoring — check back in a moment.' },
  'landing.trending.empty_count': { ko: '지금 검증 중인 지식 {n}개', en: '{n} knowledge currently being verified' },
  'landing.trending.more': { ko: '더 보기', en: 'See all' },
  'landing.trending.accuracy_pending': { ko: '정답률 채점 전', en: 'Accuracy not scored yet' },
  'landing.trending.accuracy_sample': { ko: '{pct}% — {facts}문항 중 {tested}문항 표본', en: '{pct}% on a {tested}-question sample of {facts}' },
  'landing.trending.accuracy_checked': { ko: '{pct}% ({raw} 채점)', en: '{pct}% ({raw} checked)' },

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
  'landing.why.ain.desc': { ko: '누가 어떤 지식을 등록·검증·구매했는지는 AI Network에 공개 기록으로 남습니다. 판매도 누구에게 얼마가 갈지 적힌 기록으로 남고, 파는 쪽이 그 뒤에 출처로 밝힌 지식들에게 보냅니다.', en: 'Who registered, verified and bought which knowledge is a public record on the AI Network. Every sale is recorded there as a split: the record says who is owed what, and the seller sends it on afterwards.' },
  'landing.why.tagline': { ko: '팔릴 때마다 출처로 밝힌 지식과 나눌 몫이 기록되고, 쓰는 사람은 다른 노드가 채점한 지식만 봅니다.', en: 'Every sale is recorded as a split with the knowledge it names. Users only ever see knowledge other nodes scored.' },

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
