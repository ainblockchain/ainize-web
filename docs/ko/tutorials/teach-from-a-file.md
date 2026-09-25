---
source: en/tutorials/teach-from-a-file.md
source_sha256: f099e29c8b98c0550e5c4eddefd11d86ad271ad367e2a49ee8545cbb56c182ae
---

# 질문 파일로 가르치기

가르치기 키가 데이터셋과 수업을 소유합니다. 키를 백업하세요. 같은 키를 가져오지 않는 한
브라우저와 CLI의 키는 서로 다릅니다. 운영자는 업로드 데이터를 읽을 수 있으므로 공유 가능한 자료만 사용하세요.

## 준비 상태 확인

```bash
ainize teach status
```

가르치기가 활성화되고 학습기·서빙 런타임이 준비되어 있어야 합니다. 운영자는 `teach.enabled`,
`teach.backend`와 학습기를 설정합니다. [노드 참여](../how-to/join-from-your-own-node.md)를 참고하세요.
시뮬레이션 백엔드의 결과를 실제 학습 결과로 사용하지 마세요.

## 업로드

`questions.jsonl`에 질문과 정답을 한 줄씩 작성합니다.

```json
{"prompt":"지원 데스크 코드는?","answer":"ASTER-42"}
{"prompt":"릴리스 회의실 이름은?","answer":"Blue Finch"}
```

```bash
ainize teach dataset upload ./questions.jsonl --name "Team handbook"
ainize teach dataset ls
```

반환된 데이터셋 ID를 사용합니다. 학습 전에 허용·중복·거절된 행을 확인하세요.
CSV·TSV·JSON·Q/A 텍스트도 지원합니다. 용량과 일일 한도는 노드 정책에서 확인합니다.

## 학습과 결과 확인

```bash
ainize teach train <dataset-id> --effort quick --wait
ainize teach jobs
```

CLI가 수업 ID를 출력합니다. 실패하거나 추가 데이터가 필요할 수 있으므로 측정된 검사를 확인하세요.
공개에는 `READY` 상태가 필요합니다. 학습 프로세스가 끝났다고 검사를 통과한 것은 아닙니다.

## 비공개 유지 또는 공개

비공개로 유지할 수 있습니다. 공유 권한이 있고 영구 공개 기록에 동의하는 경우에만 공개하세요.

```bash
ainize teach publish <job-id> --name "Team handbook" --price 0 \
  --consent-permanent --consent-rights
```

CLI와 수업 화면 모두 공개를 지원합니다. 공개 후에도 독립 검증을 거쳐야 판매할 수 있습니다.
데이터셋 접근 범위와 라이선스를 지정하세요. 옵션은 `--help`에서 확인합니다.

브라우저 [가르치기](https://ainize.ai/teach)도 업로드·검토·설정·학습·결과 순서로 진행합니다.
파일 없이 수정하려면 [대화로 가르치기](./teach-in-chat.md)를 참고하세요.
