---
source: en/how-to/google-ax.md
source_sha256: 824424c736cab88aa5eded97bc7c41605941ad60e449d62d55cf14454889e559
aincode: false
---

# Google AX로 에이전트 실행하기

> **머지됐지만 ainize.ai에서는 아직 꺼져 있습니다.** AX 통합은 2026-10-30
> [PR #251](https://github.com/ainblockchain/ainize-node/pull/251)로 ainize-node `main`에 머지되었습니다.
> 운영자가 `AINIZE_AX_ADDRESS`를 설정하기 전까지는 비활성 상태이며, 그전에는 `/api/ax` 경로가 503을 돌려줍니다.
> 운영자 경로는 kind 클러스터에서 끝까지 검증했습니다(`deploy/ax/dev-kind.sh` + `deploy/ax/sample-task.sh`):
> Python 명령이 gVisor 샌드박스에서 실행되고 그 결과가 노드를 통해 돌아왔습니다. Substrate 워커는
> Linux 커널 6.5 이상이 필요해서, 공유 운영 클러스터는 그런 커널을 가진 워커 호스트가 준비될 때까지 기다립니다.
> 코드에는 명시적인 프로젝트 실행 승인, 위임된 모델 호출, AinDrive 파일 읽기가 포함되어 있습니다.

[Google AX](https://github.com/google/ax)는 Kubernetes 위의 Agent Substrate를 통해 에이전트 작업을 실행합니다.
**AX 실행을 제공하는 호스트들을 신뢰하는 관리자가 운영하는 하나의 Kubernetes 클러스터로 묶습니다.** Kubernetes와 Agent Substrate는
AX 실행을 제공할 때 필요하며, Ainize peer network에 참여하는 조건은 아닙니다. 독립 운영자는 자신의
ainize-node를 실행하고 기존 peer 프로토콜로 통신합니다. 이 클러스터에 가입하거나 그 자격 증명을 받을
필요는 없습니다. 한 운영자가 논리적 ainize-node 서비스 하나로 여러 워커를 관리할 수 있지만, 네트워크
전체의 독립 peer들을 대체하지 않습니다. AX는 실행 워커에 작업을 배치하며, 이 통합은 `@ax-llm/ax`
TypeScript 라이브러리와 별개입니다.
여러 조직이 독립된 peer 식별자와 권한을 유지하며 이 클러스터를 공유할 수도 있습니다. Namespace, RBAC,
네트워크, 저장소, 사용량 제한과 샌드박스 격리를 함께 검증해야 합니다. 현재 준비용 배포 파일만으로는
그 격리가 보장되지 않습니다.

Ainize-node는 peer 식별자와 상태를 유지하고, 사용자 인증, 다른 peer와의 통신, 모델·프로젝트 API를
담당하는 애플리케이션입니다. Kubernetes는 그 Pod를 배치하고 재시작하며, AX와 Substrate는 에이전트
실행 환경을 제공합니다. 여기서 설명하는 운영자용 AX API는 연결되어 있지만, 기존 Ainize 프로젝트
실행은 AX를 명시적으로 선택하고 서명된 SSO 승인을 받은 스크립트에 한해 프로젝트 워커로 연결됩니다.
기존 실행의 백엔드가 자동으로 변경되지는 않습니다.
기존 Docker 앱 호스트를 옮기려면 Next.js용 Kubernetes 빌드·배포 백엔드도 구현해야 합니다.
준비된 Pod만으로는 이 기능을 제공하지 않습니다. 기존 peer를 통합하기 전에 소유권, 잔액, 데이터,
배포 참조를 조사해야 합니다. 통합은 같은 운영자의 peer를 대상으로 검토하며 독립 참여자는 유지합니다.
이관 검증이 끝날 때까지 기존 식별자와 상태를 보존하세요. 같은 식별자의
프로세스를 동시에 복제하려면 현재 SQLite와 프로세스 내부 상태 관리도 바꿔야 합니다.

다른 운영자에게 보내는 요청은 인증된 Ainize peer 인터페이스와 해당 제공자의 수락 규칙을 거칩니다.
peer 발견이 Kubernetes 호스트 등록으로 이어지지는 않습니다. 아래 운영자 전용 AX API는 공개 peer 실행
엔드포인트가 아닙니다. peer 간 AX 실행 전달과 운영 검증은 아직 남아 있습니다.

## Ainize-node와 Node.js·Docker·Kubernetes의 관계

**Ainize-node는 peer network에 참여하는 애플리케이션입니다.** Node.js는 이 애플리케이션을
실행하고, Docker는 작업을 담을 컨테이너를 제공하며, Kubernetes는 여러 호스트에 컨테이너 작업을
배치하고 관리합니다. Ainize-node를 실행한다고 반드시 Kubernetes를 설치할 필요는 없습니다.

| 설치 환경 | Ainize-node가 실행되는 곳 | 작업 실행 방식 | Kubernetes 필요 여부 |
| --- | --- | --- | --- |
| Node.js만 있음 | 내 컴퓨터나 서버의 일반 프로세스 | 권한이 있는 다른 실행 peer에 지원되는 작업 요청. 로컬 Docker·AX 샌드박스는 없음 | 불필요 |
| Node.js와 Docker가 있음 | 보통 호스트의 일반 프로세스. peer 자체의 컨테이너 포장은 선택 사항 | 로컬 Docker로 지원되는 빌드·앱 배포 수행 | 불필요 |
| Kubernetes 클러스터가 있음 | 클러스터 안의 Pod | 클러스터 실행 서비스 이용. AX는 그 안의 Agent Substrate 이용 | 이 배포 방식에서 필요 |

### 1. Node.js만 있는 경우: 참여하고 작업 요청하기

Docker가 없는 노트북에서도 Node.js 프로세스로 Ainize-node를 실행하고 다른 peer에 연결해,
지원되는 원격 API를 이용할 수 있습니다. 네트워크에 참여하는 것만으로 로컬 Docker 샌드박스를
제공하게 되지는 않습니다. 예를 들어 필요한 실행 기능을 제공하는 peer에 권한이 확인된 요청을
보낼 수 있습니다. 실제로 이용할 수 있는 제공자가 있는지, 실행 권한이 있는지 모두 확인해야 합니다.

### 2. Docker가 있는 경우: 로컬 실행 자원도 제공하기

서버에서 Ainize-node를 Node.js 프로세스로 실행하고, 그 프로세스가 Docker를 호출해 지원되는
작업을 빌드·실행할 수 있습니다. 기존 애플리케이션 배포도 이 경로를 사용합니다.
**프로젝트를 Docker 컨테이너로 실행하는 것과 Ainize-node 자체를 컨테이너로 실행하는 것은 별개입니다.**
peer 자체를 컨테이너로 포장하려면 실행 의존성, 영구 데이터, 호스트 실행 서비스 접근까지
구성해야 합니다. 현재 준비된 Kubernetes용 peer 이미지만으로 Docker 호스트 배포가 완성되지는 않습니다.

### 3. Kubernetes가 있는 경우: 공통 클러스터에서 실행하기

공통 클러스터 배포에서는 Ainize-node가 Pod로 실행됩니다. 허가된 작업 요청은 통제된 API 경로로
클러스터 실행 서비스에 전달합니다. Kubernetes는 적절한 worker에 작업을 배치하고,
AX와 Agent Substrate는 에이전트 실행 환경을 제공합니다. peer Pod마다 별도 클러스터를 만들지
않으며, 모든 peer에 클러스터 관리자 자격 증명을 주지도 않습니다.

Kubernetes용 앱 배포 백엔드는 Next.js 빌드·배포를 유지하도록 구현할 예정입니다.
이 앱 배포 백엔드는 아직 남아 있으며, peer를 Pod에 옮기는 것만으로 Next.js 호스팅이 제공되지는 않습니다.
AX를 선택한 스크립트 실행은 아래와 같이 별도로 구성합니다.

### 전용 모델 호스트는 Docker를 유지할 수 있음

GPU 8장을 하나의 장기 실행 모델에 전용으로 할당한 서버는 Docker 배포를 유지하고,
AX와 공용 앱 작업은 Kubernetes에서 실행할 수 있습니다. 기존에 네이티브 프로세스로 실행하는
모델은 별도 컨테이너 이관을 검증하기 전까지 현재 방식을 유지합니다. 실제 GPU 할당,
모델 저장소, 재시작 요구를 확인해서 결정하며 GPU 개수만으로 이관 대상을 정하지 않습니다.

유지할 호스트는 클러스터 목록의 `externalHosts`에 실제 실행 방식인 `docker` 또는 `process`와
유지 이유를 기록합니다. `hosts`에 있는 호스트에만 클러스터 가입 구성을 만듭니다.
두 그룹 모두 같은 peer network에 참여합니다.

### GPU 8장을 사용해도 다른 앱을 배포할 수 있음

GPU와 CPU·메모리는 별도 자원입니다. 모델이 GPU 8장을 모두 사용해도 CPU와 RAM이 남으면
같은 서버에 Next.js·TA·API를 배포할 수 있습니다. 먼저 모델이 필요한 CPU·RAM, 운영체제와
순간적인 부하의 여유분을 예약하고 남은 자원만 제공해야 합니다. 동시 실행 시 디스크와
네트워크 경합도 확인합니다.

모델과 앱을 모두 Docker로 운영하거나, 모델은 Docker에 유지하고 같은 호스트를 Kubernetes에
참여시켜 CPU 전용 앱을 실행할 수 있습니다. 혼합 구성에서는 호스트를 `hosts`에 두고
`retainedWorkload`에 외부 GPU 소유와 CPU·메모리 예약량을 명시합니다. 구성 생성기는 kubelet의
예약 인자를 만들고, 검증기는 예약 누락이나 Kubernetes에 노출된 NVIDIA GPU 자원을 거절합니다.
운영자는 모델의 cgroup 제한, GPU device plugin의 해당 호스트 제외, Pod의 장치 접근 제한을
별도로 구성해야 합니다. 운영에 적용하기 전 실제 환경에서 검증해야 합니다.

`externalHosts`는 Kubernetes에 전혀 참여하지 않는 호스트에만 사용합니다.
GPU 8장을 모두 사용한다는 이유만으로 서버 전체를 제외하지 않습니다.

Docker를 유지하는 호스트에서는 미리보기 브랜치의
`AINIZE_PROJECT_HOST_RESERVATIONS=/etc/ainize/host-reservations.json` 설정도 사용할 수 있습니다.
운영자 JSON에 `cpuCores`, `memoryHeadroomMiB`, `gpuUuids`를 지정합니다. 메모리는 현재
사용량 외에 확보할 추가 여유분이며, GPU는 유휴 상태라도 모델 소유라면 모두 나열합니다.
파일이 없거나 잘못되면 새 배포를 거부합니다. 이 peer별 예산이 cgroup 제한을 적용하거나 같은
호스트의 여러 peer를 조정하지는 않습니다.
[호스트 예약 예제](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/cluster/README.md#share-cpu-and-memory-while-retaining-a-gpu-model)를 참고하세요.

### Peer 참여와 실행 자원은 별개

세 배포 방식 모두 같은 peer network에 참여합니다. 로컬 샌드박스가 없는 peer는 해당 기능을
제공한다고 광고하거나, 대신 호스트에서 신뢰되지 않은 작업을 직접 실행하면 안 됩니다.
원격 실행에는 선택한 제공자의 지원 API, 실행 권한, 가용 자원이 필요합니다.
원격 AX 프로젝트 자동 실행은 아직 연결 중이며, AX를 제공하는 peer를 발견하는 것만으로
프로젝트 실행 요청이 자동 전달되지는 않습니다.

한 조직에 여러 노드 기여자가 참여할 수 있습니다. 예를 들어 하나의
GenAI-Leader-Finance-ComCom 조직에 한양대·인하대·숙명여대가 각각 peer를 기여할 수 있습니다.
구성원은 조직의 공동 프로젝트 실행·재배포 권한을 유지합니다. 기여자 구분은 노드 운영,
제공 자원, 사용량·기여량 정산에 사용하며 학교별 접근 경계를 새로 만들지 않습니다.

## 공통 클러스터 준비

먼저 호스트, 실제 실행 중인 peer 신원, 기존 배포와 영구 데이터를 조사합니다.
[공통 클러스터 안내](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/cluster/README.md)에 따라
kubeadm 초기화 구성 하나와 동일 API 주소·고정된 클러스터 CA를 사용하는 워커 참여 구성을 만듭니다.
지원 구성은 Kubernetes v1.37.1이며 Substrate에 필요한 인증서 기능을 활성화합니다. 구성 생성기는 기존
네트워크 대역, 중복 신원, 선택한 클러스터 호스트의 참여 여부를 확인합니다. 구성 생성만으로 운영 워크로드가 이관되지는 않습니다.

선택한 클러스터 호스트가 모두 Ready 상태가 되면 영구 저장소, NetworkPolicy를 적용하는 클러스터 네트워크, 모든 워커가
접근할 수 있는 이미지 레지스트리, Substrate 운영자 설치 문서를 준비합니다.
[AX 설치 안내](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md)에 따라
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
AINIZE_DEPLOYMENT_MANAGER=kubernetes
```

AX 서비스는 외부에 공개하지 않습니다. AX 제어 API 자체에는 Ainize 사용자 인증이 적용되지 않으므로 아래
Ainize 운영자 API를 사용합니다. 임시 로컬 점검은 관리자가
`kubectl -n ax-system port-forward --address 127.0.0.1 svc/ax-server 18080:8080`을 실행한 뒤 로컬 Ainize
노드에서 `127.0.0.1:18080`을 사용하면 됩니다.

## 기존 peer의 클러스터 배포 준비

노드 패키지는 `deploy/cluster/peers.mjs`와 `peers.example.json`을 포함합니다.
스키마 버전 2의 비공개 배포 파일에서 `peers`에는 배포를 준비할 식별자만 기록하고, 각각 복원한 PVC,
실행 UID/GID, 리소스 제한을 지정합니다. 하나의 digest 고정 이미지를 사용하세요. 나머지 모든 식별자는
`deferredPeers`에 `address`와 미해결 이관 작업을 설명하는 빈 문자열이 아닌 `reason`으로 기록합니다.
예제는 서비스 하나를 선택합니다. 보류 항목은 Pod를 생성하지 않으며, 기존 프로세스 중지나 데이터 병합을
수행하지 않고 이관 완료를 증명하지도 않습니다.
생성기는 기본적으로 AX 연결을 넣지 않습니다. 신뢰된 제어용 peer에만 선택적 `ax` 객체의 `address`,
`atespace`, 선택적 `routerAddress`를 설정하세요. atespace 설정은 클라이언트 요청 범위이며 서버 측
조직 인증이 아닙니다. AX/Substrate 직접 접근은 비공개로 유지하세요.
커밋된 노드 체크아웃에서 공통 이미지를 빌드하고
로컬에서 검증하세요.

```bash
bash deploy/cluster/build-peer.sh registry.example.com/ainize-node:release
PEER_TEST_IMAGE=registry.example.com/ainize-node:release node --test --import tsx test/peer-image.integration.test.ts
```

빌드 스크립트는 커밋된 입력, 잠긴 의존성, 고정된 Node 기반 이미지를 사용합니다. 이미지에 소스 커밋을
기록하고 `/opt/ainize`에 빌드된 패키지를 제공합니다. 테스트는 격리된 컨테이너에서 시험용 peer 데이터를
검증합니다. 실제 모델과 프로젝트 의존성은 별도 검증이 필요합니다. 이미지를 레지스트리에 올리고
레지스트리 manifest digest를 배포 파일에 지정하세요. 각 peer 홈을 `/var/lib/ainize`에 복원하고 설정의 절대 데이터 경로를
수정하세요. 보존 정책이 `Retain`이고 접근 모드가 `ReadWriteOncePod`인 CSI 파일시스템 볼륨을
사용하며, PVC에 `ainize.ai/peer-address` 주석을 지정합니다. 실제 저장소를 확인하고 정지된
배포 구성을 생성합니다.

```bash
umask 077
kubectl -n ainize-peers get pvc -o json > /secure/peer-pvcs.json
kubectl get pv -o json > /secure/peer-pvs.json
node deploy/cluster/peers.mjs verify-storage /secure/ainize-inventory.json /secure/peer-rollout.json /secure/peer-pvcs.json /secure/peer-pvs.json
node deploy/cluster/peers.mjs render /secure/ainize-inventory.json /secure/peer-rollout.json > /secure/peer-workloads.json
kubectl apply --dry-run=server -f /secure/peer-workloads.json
```

검증한 공통 클러스터 context를 사용하세요. 생성된 StatefulSet은 실행 수가 0이고 업데이트 방식은
`OnDelete`입니다. 적용해도 peer는 시작하지 않습니다. 기존 쓰기 프로세스를 중지하고 백업 복원을
검증한 뒤 canary peer부터 활성화하세요. 실행 중인 peer에 실행 수 0인 준비 파일을 다시 적용하지
마세요. 기존 Docker 프로젝트 실행, 모델 서버, 공개 트래픽은 별도의 이전 검증이 필요합니다.
생성된 Pod에는 Docker 소켓 마운트나 GPU 할당이 없습니다.

Kubernetes 관리 모드는 기존 `node.update`와 호스트 모델 배포·중지·다운로드 명령을 비활성화하며,
인증된 운영자에게도 `409 cluster_managed`를 반환합니다. 공통 이미지와 StatefulSet을 갱신하고,
이전한 모델 워크로드는 클러스터에서 관리하세요. 전환할 때 기존 호스트 서비스와 cron 작업도
중지해야 합니다. 이 설정이 해당 작업을 중지하지는 않습니다. 상태 응답에는 `deploymentManager`와
빌드 커밋이 포함되지만, 이 값만으로 실제 클러스터 참여가 증명되지는 않습니다. 제어 상태는 호스트
작업이 비활성화됐다고 보고하며, 비어 있는 GPU·모델 목록은 Kubernetes 워크로드 목록이 아닙니다.

## AX로 프로젝트 스크립트 실행하기 (미리보기)

이 절차는 프로젝트 소유자 또는 조직 구성원의 세션을 사용합니다. 다음 절의 운영자 API와는
별도 인터페이스입니다. 조직 구성원은 조직의 공동 권한에 따라 다른 구성원의 프로젝트를
실행할 수 있습니다. 노드를 기여하는 것만으로 다른 조직의 프로젝트 권한이 생기지는 않습니다.

### 운영자 설정

[테넌트 설정 안내](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#bind-a-controller-to-a-tenant)에
따라 조직 테넌트를 등록하고 프로젝트를 연결합니다. `AINIZE_AX_TENANT_REGISTRY=true`,
`AINIZE_AX_PROJECT_ADMISSION=true`를 설정하고 AIN SSO, `AINIZE_AX_CLUSTER_UID`, 정확한
HTTPS 주소인 `AINIZE_AX_PROJECT_ORIGIN`을 구성합니다. `AINIZE_AX_PROJECT_EXECUTOR_FILE`은
운영자가 관리하는 실행기 JSON을 가리킵니다. 여기에 digest로 고정한 Python/Node 이미지,
CPU·메모리 한도, 등록된 테넌트의 외부 통신 정책을 지정합니다.
[실행기 설정 안내](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#configure-the-project-executor)에
따라 AX, guest-router, 인증된 Substrate 연결도 구성합니다. 실행기 없이 승인 기능만 켜면 실행은 대기합니다.

### 실행 생성과 승인

1. 프로젝트 세션으로 `/api/projects/<projectId>/ax-runs`에
   `{"target":"commit","sha":"<전체-커밋-SHA>","entry":"main.py"}`를 POST합니다.
   시작할 때 파일이 필요한 프로그램은 `dataRequired: true`도 추가합니다.
   응답에는 `runId`와 `approvalPath`가 포함됩니다.
2. 해당 실행에 대한 AIN SSO `invoke` 위임과, `AINIZE_AX_PROJECT_ORIGIN + approvalPath`로
   POST하기 위한 소유 증명을 발급받습니다. 로그인 세션만으로 실행 위임을 대신할 수는 없습니다.
3. 같은 프로젝트 세션으로 `approvalPath`에
   `{"token":"<위임-토큰>","proof":"<소유-증명>"}`을 POST합니다.
   응답은 실행 수락이며 실행 성공을 뜻하지 않습니다. 파일이 필요한 실행은 아래 4단계까지 기다립니다.

워커는 소스를 복제하기 전에 승인을 확인하고, 작업의 외부 통신 정책을 검증한 후 시작을 허가합니다.
출력과 종료 결과는 정리 전에 저장합니다. 게스트 응답을 기다리는 동안에도 별도로 권한을 확인하며,
권한이 없어지면 읽기를 취소하고 작업 정리 또는 복구를 위한 정지를 시도합니다.
컨트롤러나 네트워크 장애 중의 종료까지 보장하는 것은 아닙니다.
현재 연결된 것은 스크립트 실행입니다. 이 절차로 Next.js 서비스를 배포하거나 임의의 프로젝트
비밀정보를 전달하거나 다른 peer로 AX 실행을 자동 전달할 수는 없습니다.

### 모델 호출 (선택 사항)

운영자는 `AINIZE_AX_BROKER_MODELS_FILE`에 지원 모델 ID와 정확한 SSO 리소스 식별자의
JSON 매핑을 지정합니다. `AINIZE_AX_BROKER_ISSUER`와 `AINIZE_AX_BROKER_JWKS_URL`은
Substrate 작업 신원 확인용이며 AIN SSO 사용자 신원과 별개입니다. 실행기 JSON에
`broker.origin`(프로젝트 origin과 동일)과 `broker.caBundleFile`을 추가합니다.
PEM 묶음에는 게이트웨이 중계 CA와 필요한 공개 CA가 포함되어야 합니다.
[모델 중계 설정](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#model-broker)을 참고하세요.

실행 위임에는 선택한 모델 리소스의 `invoke` 권한도 필요합니다. 실행기가
`OPENAI_BASE_URL`, 임시 표시값인 `OPENAI_API_KEY`, CA 설정을 주입합니다.
OpenAI 호환 클라이언트에서 이 환경변수와 `stream: false`를 사용할 수 있습니다.
게이트웨이가 Authorization 헤더를 짧은 수명의 actor JWT로 교체하므로 게스트에는 내부 계정 키를
주지 않습니다. 호출 시 현재 실행 승인과 기존 계정·모델·사용량 규칙을 확인합니다.

### AinDrive 파일 읽기 (선택 사항)

운영자는 `AINIZE_AX_AINDRIVE_ORIGIN`에 정확한 HTTPS AinDrive origin도 지정합니다.
위의 모델 중계 구성이 필요합니다. `dataRequired` 실행에서는 다음 순서로 진행합니다.

1. `/api/projects/<projectId>/deployments/<runId>/ax-data/key`에 `{}`를 POST합니다.
   응답의 `publicJwk`, `agent`, `audience`로 별도의 SSO 데이터 위임을 발급받습니다.
   실행 승인과 같은 사용자·조직이며 정확한 파일 리소스의 `read` 권한이 있어야 합니다.
2. 데이터 토큰, 선택한 `resources`, 정확한 `files`를 `.../ax-data/grants`에 POST합니다.
   [요청 형식](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#optional-aindrive-data-access)을
   따르세요. 실제 AinDrive 경로 기반 파일 ID를 사용하고, origin이 제공하는 경우에만 revision을
   넣습니다. 응답에는 변경 불가능한 파일 참조 ID가 포함됩니다.
3. 필요한 다른 위임도 등록합니다. 실행 호출 권한만으로 파일을 읽을 수는 없습니다.
4. `.../ax-data/ready`에 `{"grantIds":["<위임-ID>"]}`를 POST해 선택을 확정하고 실행을
   대기열에 넣습니다. 위임 64개, 전체 파일 64개까지입니다. 선택을 바꾸려면 새 실행이 필요합니다.

게스트는 `AINIZE_AX_DATA_MANIFEST`가 가리키는, 토큰이 없는 파일 목록을 읽습니다.

```python
import json, os, urllib.request

with open(os.environ["AINIZE_AX_DATA_MANIFEST"]) as source:
    files = json.load(source)["files"]
request = urllib.request.Request(files[0]["url"], headers={
    "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]
})
with urllib.request.urlopen(request) as response:
    file_data = json.load(response)  # content, encoding, mime, bytes
```

`content`를 사용하기 전에 `encoding`을 확인하세요. 바이너리는 base64입니다. 각 읽기에서 현재
실행, 데이터 위임, AinDrive ACL을 확인합니다. 저장된 위임 하나를 막으려면 `.../ax-data/revoke`에
`{"delegationId":"<ID>"}`를 POST합니다. 이 로컬 조치는 다른 서비스의 SSO 토큰을 철회하거나
이미 반환한 데이터를 회수하지 않습니다. 현재 AinDrive 파일 읽기만 연결되어 있으며 디렉터리 목록,
AIN Teams·AIN Mem·AINA 데이터 어댑터는 미완성입니다. 실제 게이트웨이 TLS, 운영 AinDrive 접근,
공통 클러스터 격리는 아직 검증하지 않았습니다.

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
잘림 여부가 기록됩니다. 이 파일은 작업 코드가 수정할 수 있는 작업 출력입니다. 운영자가 직접 만든
작업은 프로젝트 실행이 아닙니다. 프로젝트 실행기는 AX를 선택한 실행의 결과를 별도로 저장하며,
`/api/run`은 기존 실행 백엔드를 사용합니다.

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

프로젝트 제어 코드와의 연결을 위해 실행 감독 프로그램은 `--` 앞의
`--wait-for-release-seconds N` 옵션도 지원합니다. 이번 실행에 새로 생성된 값과 일치하는 허가를
받을 때까지 명령을 시작하지 않습니다. 이전 실행의 허가로 재시작된 대기를 해제할 수는 없습니다.
이는 시작 순서를 조정하는 기능이며 조직 권한 검사 자체는 아닙니다. 신뢰된 제어 코드가 작업 소유권,
네트워크 정책, 파일 접근 권한을 먼저 확인해야 합니다. 내부 실행 제어용 클라이언트는 guest 프로토콜로
검사된 허가를 전달할 수 있습니다. 구성된 프로젝트 실행기는 승인, 정책 검사, 시작 허가 순서를 처리합니다.
[시작 대기 프로토콜](https://github.com/ainblockchain/ainize-node/blob/feat/google-ax/deploy/ax/README.md#gate-a-command-until-policy-setup-finishes)을 참고하세요.

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
