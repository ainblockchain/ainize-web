---
source: en/how-to/google-ax.md
source_sha256: 5a89c8ee0631b3ae849059ffe485da64395863f9f6d076db68dc2337bb44be85
---

# Google AX로 에이전트 실행하기

[Google AX](https://github.com/google/ax)는 Kubernetes 위의 Agent Substrate를 통해 에이전트 작업을 실행합니다.
**모든 Ainize peer 호스트를 하나의 Kubernetes 클러스터로 묶습니다.** Kubernetes와 Agent Substrate가
모두 필요하며, peer 프로세스마다 클러스터를 만들지 않습니다. Ainize peer는 공통 릴리스와 설정 형식을
사용하고 AX는 클러스터의 실행 워커에 작업을 배치합니다. `@ax-llm/ax` TypeScript 라이브러리와는 별개입니다.

## 공통 클러스터 준비

먼저 호스트, 실제 실행 중인 peer 신원, 기존 배포와 영구 데이터를 조사합니다.
[공통 클러스터 안내](https://github.com/ainblockchain/ainize-node/blob/main/deploy/cluster/README.md)에 따라
kubeadm 초기화 구성 하나와 동일 API 주소·고정된 클러스터 CA를 사용하는 워커 참여 구성을 만듭니다.
지원 구성은 Kubernetes v1.37.1이며 Substrate에 필요한 인증서 기능을 활성화합니다. 구성 생성기는 기존
네트워크 대역, 중복 신원, 전체 호스트 참여 여부를 확인합니다. 구성 생성만으로 운영 워크로드가 이관되지는 않습니다.

모든 호스트가 Ready 상태가 되면 영구 저장소, NetworkPolicy를 적용하는 클러스터 네트워크, 모든 워커가
접근할 수 있는 이미지 레지스트리, Substrate 운영자 설치 문서를 준비합니다.
[AX 설치 안내](https://github.com/ainblockchain/ainize-node/blob/main/deploy/ax/README.md)에 따라
`KUBECONFIG`, `AINIZE_SUBSTRATE_CONFIG`, `AX_IMAGE_REPO`, `AX_SNAPSHOTS_BUCKET`,
`AINIZE_AX_STORAGE_CLASS`를 설정하고 ainize-node 소스에서 실행합니다.

```bash
bash deploy/ax/install.sh /secure/ainize-inventory.json
```

설치 스크립트는 공통 클러스터의 전체 호스트 목록을 확인한 뒤 Substrate v0.5.0과
AX `0f085aa063db6de888e37def7a8943f7901e6c1e`를 설치합니다. 기존 클러스터 안에 AX 제어면, gVisor 워커,
영구 Redis 저장소를 만듭니다. 스냅샷 저장소는 모든 워커에서 접근할 수 있어야 합니다. 호스트별 독립 클러스터를
만들거나 기존 peer 데이터를 자동 이관하지 않습니다.

`ainize-peers` 네임스페이스의 Ainize peer Pod에 `app.kubernetes.io/name: ainize-node` 라벨과 다음 환경을 설정합니다.

```text
AINIZE_AX_ADDRESS=ax-server.ax-system.svc.cluster.local:8080
AINIZE_AX_ATESPACE=ainize
AINIZE_AX_ROUTER_ADDRESS=atenet-router.ate-system.svc.cluster.local:80
```

AX 서비스는 외부에 공개하지 않습니다. AX 제어 API 자체에는 Ainize 사용자 인증이 적용되지 않으므로 아래
Ainize 운영자 API를 사용합니다. 임시 로컬 점검은 관리자가
`kubectl -n ax-system port-forward --address 127.0.0.1 svc/ax-server 18080:8080`을 실행한 뒤 로컬 Ainize
노드에서 `127.0.0.1:18080`을 사용하면 됩니다.

## 인증과 연결 확인

자신의 노드에서 지갑 로그인으로 발급받은 **노드 운영자 세션 토큰**을 사용합니다. 추론 API 키는 AX 관리 권한을
부여하지 않습니다. `AINIZE_OPERATOR_TOKEN`에 세션 토큰을 설정하고 소스에 커밋하지 마세요.

```bash
export AINIZE_URL=http://127.0.0.1:3402
curl --fail-with-body "$AINIZE_URL/api/ax" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

연결된 노드는 `available: true`, atespace, 고정한 AX 리비전을 반환합니다. 403은 운영자 세션이 아니라는 뜻이며,
503은 AX 설정이나 연결에 문제가 있다는 뜻입니다. 이 요청은 AX API 연결을 확인합니다. 실제 실행 환경 생성은
아래 작업 상태로 확인합니다.

## 작업 생성

다음을 `task.json`으로 저장합니다. Ainize 설치 스크립트가 만드는 기본 이미지에는 Python,
업스트림 AX 작업 실행기, 실제 결과를 기록하는 명령 실행 래퍼가 포함되어 있습니다.

```json
{
  "apiVersion": "ax.io/v1alpha1",
  "kind": "Task",
  "metadata": { "name": "ainize-hello" },
  "spec": {
    "command": ["python3", "/usr/local/bin/ainize-ax-run.py", "--run-id", "hello-1", "--timeout-seconds", "60", "--", "python3", "-u", "-c", "print('Hello from AX')"],
    "resources": { "limits": { "cpu": "1", "memory": "512Mi" } },
    "debug": true
  }
}
```

```bash
curl --fail-with-body "$AINIZE_URL/api/ax/tasks" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' --data-binary @task.json
curl --fail-with-body "$AINIZE_URL/api/ax/tasks/ainize-hello" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

생성에 성공하면 201을 반환합니다. 같은 이름이 있으면 409이므로 기존 작업을 조회하거나 삭제한 뒤 생성합니다.
`status.phase`와 `status.conditions`에서 실행 환경 생성 오류를 확인하세요. 실행 환경이 준비되었다고 명령까지
성공한 것은 아닙니다. AX 기본 실행기는 명령 종료 후에도 살아 있습니다. `debug: true`는 AX CLI의 프로세스·파일
접근을 허용합니다. 점검이 필요 없는 작업은 이 설정을 끄세요.

실행 래퍼는 `/workspace/.ainize-runs/hello-1/` 아래에 `result.json`, `stdout`, `stderr`를
저장합니다. 공통 클러스터의 kubeconfig와 설치 스크립트가 빌드한 AX CLI로 실제 결과를 확인합니다.

```bash
AX_CLI="${AINIZE_AX_ROOT:-$HOME/.local/share/ainize-ax}/ax"
"$AX_CLI" -a ainize ssh ainize-hello -- cat /workspace/.ainize-runs/hello-1/result.json
"$AX_CLI" -a ainize ssh ainize-hello -- cat /workspace/.ainize-runs/hello-1/stdout
```

성공은 `state: "exited"`이면서 `code: 0`인 경우입니다. 다른 상태로 `running`, `timed_out`,
`interrupted`, `launch_failed`가 있습니다. 출력 파일은 각각 최대 1 MiB이며 결과에 전체 바이트 수와
잘림 여부가 기록됩니다. 이 파일은 작업 코드가 수정할 수 있는 작업 출력입니다. 아직 Ainize 프로젝트
실행 결과로 수집되지는 않으며 `/api/run`은 기존 실행 백엔드를 사용합니다.

노드의 운영자 API로도 이 파일을 조회할 수 있습니다.

```bash
curl --fail-with-body "$AINIZE_URL/api/ax/tasks/ainize-hello/runs/hello-1" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
curl --fail-with-body "$AINIZE_URL/api/ax/tasks/ainize-hello/runs/hello-1/output/stdout" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

결과 조회에는 `AINIZE_AX_ROUTER_ADDRESS`, `Running` 상태의 작업, `debug: true`가 필요합니다.
응답은 작업이 생성한 데이터를 `trusted: false`로 표시합니다. 첫 번째 요청은 파싱된 `result`를,
두 번째는 UTF-8 `text`와 바이트 수를 반환합니다. 표준 오류는 `stderr`로 조회합니다.
파일이 없으면 404, 작업 상태가 맞지 않으면 409, 크기 제한을 넘으면 413, 결과 JSON이 잘못되면 502입니다.
조회와 일시중지를 동시에 수행하지 않도록 조정하세요. 최초 상태 확인 후 작업이 중지되면
Substrate 라우터가 조회 과정에서 다시 재개할 수 있습니다.

## 일시중지·재개·삭제

```bash
curl --fail-with-body -X POST "$AINIZE_URL/api/ax/tasks/ainize-hello/suspend" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
curl --fail-with-body -X POST "$AINIZE_URL/api/ax/tasks/ainize-hello/resume" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
curl --fail-with-body -X DELETE "$AINIZE_URL/api/ax/tasks/ainize-hello" \
  -H "Authorization: Bearer $AINIZE_OPERATOR_TOKEN"
```

일시중지·재개는 수 분 걸릴 수 있습니다. 재개 시 작업 디렉터리를 복원하고 새 프로세스로 시작합니다.
실행 래퍼는 기록된 실행 ID를 반복 실행하지 않습니다. 완료된 결과는 유지하고 미완료 실행은 `interrupted`로
표시합니다. 외부 시스템에 이미 반영된 변경을 확인한 뒤 새 실행 ID로 명시적으로 재시도하세요.
이 보호는 작업 디렉터리의 스냅샷을 유지해야 동작합니다. 결과와 출력을 내보낸 뒤 작업을 삭제하여 실행 자원을 반환합니다.

## 워크스페이스와 모델

`/api/ax/workspaces`에 `Workspace` 리소스를 POST하면 Git 리포지터리, 파일, MCP 서버, 스킬을 설정할 수 있습니다.
Task의 `spec.workspace.name`으로 연결합니다. `/api/ax/models`에 `Model` 리소스를 POST하면 Kubernetes 시크릿
참조를 이용해 AX 자체의 Google 또는 Anthropic 모델을 설정합니다. GET은 목록 조회이며 `/:name`을 붙인 GET과
DELETE는 개별 조회·삭제입니다. 모든 리소스는 노드에 설정된 atespace를 사용하며 다른 atespace를 지정하면 거절됩니다.
필드는 [AX 매니페스트 안내](https://github.com/google/ax/blob/0f085aa063db6de888e37def7a8943f7901e6c1e/docs/manifests.md)를 참고하세요.

작업 안의 에이전트 코드는 [기존 SDK 연결 방법](./call-the-model.md)으로 Ainize 모델 API를 호출할 수 있습니다.
AX의 `Model` 리소스는 AX 초기 환경 준비에 사용할 모델을 설정하며, 자동으로 Ainize 추론 제공자를 등록하지 않습니다.
작업 안에서는 호스트의 `127.0.0.1` 대신 클러스터에서 접근 가능한 Ainize URL을 사용하세요.

Substrate는 명시적인 `EgressPolicy`가 없으면 작업의 외부 연결을 차단합니다. URL 설정만으로 연결이
허용되지는 않으며 현재 AX 컨트롤러는 이 정책을 생성하지 않습니다. 원격 모델 호출이나 리포지터리
다운로드를 활성화하기 전에 Substrate에서 해당 작업의 허용 목적지를 설정하고 검증하세요.
고정 버전의 [외부 연결 정책 안내](https://github.com/agent-substrate/substrate/blob/v0.5.0/docs/network-egress.md)를 참고하세요.
설치 스크립트는 `AINIZE_AX_ATESPACE`로 지정한 Kubernetes namespace(기본 `ainize`)에서만 모델 시크릿을
읽도록 권한을 부여합니다. 참조하는 모델 시크릿을 이 namespace에 저장하세요.

### 허용 목적지 관리

운영자 요청을 처리하는 신뢰된 peer에서 `GET /api/ax/tasks/:name/egress`와
`PUT /api/ax/tasks/:name/egress`를 사용할 수 있습니다. 별도의 Substrate 접근 설정이 필요합니다.
`AINIZE_SUBSTRATE_ADDRESS=api.ate-system.svc.cluster.local:443`,
`AINIZE_SUBSTRATE_AUTHORITY=api.ate-system.svc`를 설정하고,
`AINIZE_SUBSTRATE_CA_FILE`과 `AINIZE_SUBSTRATE_TOKEN_FILE`이 가리키는 파일을 마운트하세요.
서비스 DNS CA와 audience가 `api.ate-system.svc`인 projected token을 사용합니다.
peer의 Substrate 권한과 제공된 네트워크 정책에 필요한 Pod 레이블
`ainize.ai/substrate-policy-access: "true"`도 설정해야 합니다. 호출마다 토큰을 다시 읽으며
TLS 서버 인증서를 검증합니다. 설정하지 않으면 이 API는 503을 반환합니다.

운영자 인증을 사용한 PUT 요청에 다음과 같은 본문을 보내 정책을 생성합니다.

```json
{"rules":[{"tlsPassthrough":{"hostnames":["api.example.com"],"ports":{"numbers":[443]}}}]}
```

`api.example.com`을 승인된 목적지로 바꾸세요. 쓰기 API는 `http` 또는 `tlsPassthrough`의
정확한 소문자 DNS 이름과 명시적인 포트만 지원합니다. 교체할 때는 먼저 GET으로 조회한 뒤
메타데이터의 `uid`와 문자열 `version`을 `expected` 객체에 담아 PUT 본문에 추가합니다.
중복 생성이나 오래된 버전의 갱신은 409를 반환합니다. 빈 `rules`는 새 연결을 차단하며,
정책 변경으로 기존 연결이 종료되지는 않습니다.

AX는 작업 명령을 즉시 시작합니다. 명령이 네트워크에 접근하기 전에 정책 설정 성공을 기다리도록
구성하세요. 이 API가 프로젝트 시작 순서를 자동 조정하거나 AX 프로젝트 실행 백엔드를 활성화하지는 않습니다.
