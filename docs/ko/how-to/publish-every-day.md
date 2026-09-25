---
source: en/how-to/publish-every-day.md
source_sha256: 14edd37fe1f58e70d7dbd909d8b48bad3ee381fd43e17ca6c1d5afef18dc42ce
---

# 매일 공개하기

설정한 학습기에서 수동 수업을 먼저 통과시킨 뒤 자동화하세요.
전용 가르치기 키·제한된 대기 시간·명시적인 공개 동의를 사용합니다.
입력 파일에는 공개 권한이 있는 자료만 포함해야 합니다.

## 학습 후 공개

아래 스크립트에는 `jq`가 필요합니다. 날짜별 입력 파일명을 환경에 맞게 바꾸세요.

```bash
#!/usr/bin/env bash
set -euo pipefail
DAY=$(date +%F)
ainize --json teach dataset "./questions-$DAY.csv" --train --wait --timeout 45 \
  --name "Daily facts $DAY" > lesson.json
JOB=$(jq -er '.job.job.id' lesson.json)
ainize teach publish "$JOB" --name "Daily facts $DAY" --price 0 \
  --consent-permanent --consent-rights
```

`--wait`가 성공해야 공개합니다. 시간 초과가 실행 중인 수업을 취소하지는 않습니다.
재제출 전에 `ainize teach jobs`를 확인하세요. 작업 ID와 표준 오류를 스케줄러 로그에 보관하고,
실패한 명령의 종료 코드를 파이프로 숨기지 마세요.

## 이전 버전 종료

노드가 반환한 실제 ID를 사용합니다.

```bash
ainize patch announce <new-id> --supersede <old-id>
ainize patch retire <old-id> --reason "Replaced by the current version"
```

대체와 판매 종료는 별도 작업입니다. 사용 중인 지식을 종료하기 전에 카탈로그 상태를 확인하세요.
영구 공개 기록은 유지됩니다.
