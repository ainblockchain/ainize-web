---
source: en/get-started/quickstart.md
source_sha256: e25b373bc0938a1a4cc20da17651d862b288d7de83629225980121ef8da16fa3
---

# 빠른 시작

로컬 노드를 실행하고 확인한 뒤 호환 모델에 연결합니다. 먼저 [CLI](./install.md)를 설치하세요.
아래 명령은 별도의 홈을 사용하므로 기존 노드를 변경하지 않습니다.

## 노드 실행

```bash
export AINIZE_HOME="$HOME/ainize-quickstart"
ainize init --name quickstart --port 3694 --roles seller
ainize start -d
ainize status
ainize login
ainize wallet
```

로컬 원장의 초기 CREDIT은 테스트용이며 AIN 메인넷 잔액이 아닙니다.
노드 머신에서 `ainize login`을 실행하면 해당 노드 키로 서명합니다.

## 모델 연결

지식 적용에는 호환 런타임과 **패치 훅**이 모두 필요합니다. 채팅 API만으로는 충분하지 않습니다.
Qwen3.8 런타임의 서빙 컨테이너는 `ENGRAM_HOOK=1`, `MTP=0`으로 실행하세요.
패치 디렉터리를 컨테이너에 마운트하고 `runtime.patchDir`과 일치시켜야 합니다.
아래 경로를 실제 런타임 소스와 패치 디렉터리로 바꾸세요.

```bash
ainize config set runtime.api http://127.0.0.1:8000
ainize config set runtime.repo /path/to/qwen3.8
ainize config set runtime.patchDir /path/to/patch-mailbox
ainize config set roles seller,serving
ainize stop
ainize start -d
ainize status --check
```

런타임이 `available`이고 훅이 동작할 때 라이브 테스트를 진행하세요.
모델 목록 조회 성공만으로 지식 적용 가능 여부를 판단할 수 없습니다.

## 지식 찾기와 사용

```bash
ainize peers add https://ainize.ai
ainize patch ls --status VERIFIED
ainize chat --list
```

카탈로그의 실제 ID를 선택하고 모델·검증 근거·가격·라이선스를 확인합니다.

```bash
ainize patch get <id>
ainize chat <id> "질문"
ainize use <id>
ainize patch stack
```

라이브 테스트는 노드에 파일이 있어야 가능합니다. `use`는 구매·다운로드·적용을 수행하므로
견적을 확인한 뒤 승인하세요. 적용이 실패해도 구매는 완료됐을 수 있습니다.
재시도 전 `ainize wallet`과 `ainize purchases`를 확인하세요.

## 종료

```bash
ainize stop
```

키와 데이터는 홈 디렉터리에 유지됩니다.
다음: [파일로 가르치기](../tutorials/teach-from-a-file.md), [구매와 적용](../tutorials/buy-and-apply.md).
