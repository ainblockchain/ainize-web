---
source: en/how-to/stream-speech.md
source_sha256: 3fec99f8b7eafe538f3daaae68781c6da33b9937895b8e3a4a5eef5d6dd68792
---

# 네이티브 모델로 음성 스트리밍하기

`confucius4-r2t2`의 네이티브 스트리밍 디코더에 WebSocket으로 16 kHz 모노 PCM16 음성을 연속 전송합니다. 모델은 발화 상태를 유지하며 말이 끝나기 전부터 확정된 텍스트를 반환합니다. WebM 파일을 몇 초마다 올려 오프라인 인식을 반복하는 API가 아닙니다.

## 서버에서 세션 발급

모델 API 키는 애플리케이션 서버에 보관하고, 다음 요청의 응답만 브라우저에 전달합니다.

```bash
curl https://ainize.ai/v1/audio/transcription-sessions \
  -H "Authorization: Bearer $AINIZE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"confucius4-r2t2","language":"ko","origin":"https://your-app.example","context":""}'
```

`language`는 한국어 `ko`, 영어 `en`, 자동 감지 `null`입니다. `context`는 1,000자 이내의 주제·용어 힌트입니다. `origin`은 소켓을 여는 브라우저의 정확한 HTTPS 출처이며 개발용 localhost HTTP도 허용합니다.

HTTP 201 응답에는 `id`, `websocket_url`, `token`, `expires_at`, PCM 형식과 최대 연결 시간이 들어 있습니다. 토큰은 15초 안에 한 번만 연결할 수 있고, 연결은 최대 두 시간 유지됩니다. API 키를 브라우저·소켓 URL·로그에 넣지 않습니다.

## 음성 연속 전송

```javascript
const socket = new WebSocket(session.websocket_url,
  ['ainize.asr.v1', session.token]);
socket.onmessage = ({data}) => {
  const event = JSON.parse(data);
  if (event.type === 'ready') startPcmCapture();
  if (event.type === 'transcript') render(event.text, event.final);
  if (event.type === 'error') stopPcmCaptureAndShowError(event.code);
};
function sendPcm(pcm16ArrayBuffer) {
  if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 64000)
    throw new Error('음성 전송이 지연되고 있습니다');
  socket.send(pcm16ArrayBuffer);
}
```

16,000 Hz `AudioContext`와 `AudioWorklet`으로 모노, 리틀 엔디언, 부호 있는 16비트 샘플을 만듭니다. 160ms 프레임 하나는 2,560개 샘플, 5,120바이트입니다. 더 작은 프레임은 20ms인 640바이트의 배수여야 합니다. `MediaRecorder`의 WebM 조각은 PCM이 아니므로 처리되지 않습니다. 녹음 파일을 한꺼번에 보내지 말고 실제 수집 속도로 보냅니다.

## 중간 결과와 종료

| 이벤트 | 내용 |
|---|---|
| `ready` | `mode: "native_streaming"`. 모델이 준비됐으므로 PCM 전송을 시작합니다. |
| `transcript` | `utterance`는 발화 번호, `text`는 현재 발화의 누적 확정 접두어, `delta`는 새 텍스트, `final`은 발화 경계입니다. 다음 발화에서는 누적 텍스트가 새로 시작합니다. |
| `done` | 정상 종료를 마쳤습니다. |
| `error` | `code`에 원인이 있습니다. 수집을 중지하고 실패를 표시합니다. |

정상 종료 시 정확한 텍스트 프레임 `{"type":"finish"}`를 보냅니다. 마지막 결과를 마무리하고 `done` 뒤 연결을 닫습니다. 취소할 때는 즉시 소켓을 닫습니다. 대기 음성은 폐기되며 강제로 인식 완료하지 않습니다. AudioWorklet과 연결 노드는 정리하되, 통화가 소유한 마이크 트랙을 종료하지 않습니다.

음성 미전송, 잘못된 PCM, 전송 지연, 모델 장애, 권한 회수 시 연결을 끝냅니다. 음성을 조용히 버리거나 파일 인식으로 몰래 전환하지 않습니다. 재시도를 선택한 뒤 새 세션을 발급합니다.

## 제한과 오류

노드는 모델 연결 두 개를 동시에 처리합니다. 세션 발급 오류는 `401 invalid_api_key`, `400 invalid_stream_request`·`invalid_origin`, 원본 서명 오류 `403 invalid_source_proof`, 용량 초과 `429 stream_capacity`입니다. WebSocket은 만료·재사용·잘못된 출처의 토큰을 거부합니다. 실행 중에는 `invalid_or_late_audio`, `authorization_or_backpressure`, `model_unavailable`, `model_disconnected`, `model_or_commit_failed` 등이 반환됩니다.

모델 서비스 로그에는 음성과 인식 문장을 보관하지 않습니다. 이 이벤트는 정밀한 단어별 시간 정렬 결과가 아닙니다.

## AIN Call의 동의 확인

Teams 서버가 실제 사용자·미팅·AI epoch·revision을 묶어 서명합니다. 고정된 서버 간 권한 경로가 음성을 받기 전과 결과 저장 전에 현재 대화 접근, 실제 RTC 참여, 녹음 상태와 동의를 다시 확인합니다. 저장하는 문장은 모델 서버가 보낸 결과뿐이며 브라우저가 주장하는 전사문을 받지 않습니다. 동의가 바뀌면 연결을 끊고 대기 음성을 폐기합니다.

[Confucius4-R2T2 공식 구현](https://github.com/netease-youdao/Confucius4-R2T2#streaming-transcription)을 사용합니다. 정확도와 첫 결과 지연은 언어·마이크·소음·부하에 따라 다르며, 스트리밍 지원 자체가 정확도를 보장하지는 않습니다.
