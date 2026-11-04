# Stream speech into a native ASR model

Use a persistent WebSocket to send 16 kHz mono PCM16 audio to the native streaming decoder of `confucius4-r2t2`. The decoder retains an utterance's state and emits stable text while speech is still arriving. This endpoint does not upload WebM files or call the offline transcription endpoint for each chunk.

## Create a session on your server

Keep your model API key on your server. Return only this response to the browser:

```bash
curl https://ainize.ai/v1/audio/transcription-sessions \
  -H "Authorization: Bearer $AINIZE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"confucius4-r2t2","language":"ko","origin":"https://your-app.example","context":""}'
```

`language` is `ko`, `en` or `null` (automatic detection). `context` is an optional topic/hotword hint, at most 1,000 characters. `origin` must be the exact HTTPS origin that will open the socket; localhost HTTP is accepted for development.

A successful response is HTTP 201:

```json
{"id":"SESSION_UUID","websocket_url":"wss://ainize.ai/v1/audio/transcription-sessions/SESSION_UUID","token":"ONE_USE_TOKEN","expires_at":1790000015000,"format":{"encoding":"pcm_s16le","sample_rate":16000,"channels":1,"frame_ms":160},"max_duration_sec":7200}
```

The token must be used within 15 seconds and cannot open a second connection. The connected session lasts at most two hours. Never put the model API key in a browser, WebSocket URL or log.

## Connect and send continuous audio

```javascript
const socket = new WebSocket(session.websocket_url,
  ['ainize.asr.v1', session.token]);
socket.onmessage = ({data}) => {
  const event = JSON.parse(data);
  if (event.type === 'ready') startPcmCapture();
  if (event.type === 'transcript') render(event.text, event.final);
  if (event.type === 'error') stopPcmCaptureAndShowError(event.code);
};
// Called by your AudioWorklet after ready, once per 160 ms:
function sendPcm(pcm16ArrayBuffer) {
  if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 64000)
    throw new Error('Audio connection is falling behind');
  socket.send(pcm16ArrayBuffer);
}
```

Use an `AudioContext` at 16,000 Hz and an `AudioWorklet` to produce mono, little-endian signed 16-bit samples. One 160 ms frame contains 2,560 samples, or 5,120 bytes. Smaller frames must be multiples of 20 ms (640 bytes). `MediaRecorder` WebM fragments are not PCM and must not be sent here. Send at the capture rate, rather than uploading a recording in a burst.

## Read results and finish

Server events are JSON text frames:

| Type | Fields | Meaning |
|---|---|---|
| `ready` | `mode: "native_streaming"` | The model is connected; start sending PCM. |
| `transcript` | `utterance`, `text`, `delta`, `final` | `text` is the current utterance's cumulative stable prefix; `delta` is newly committed text. `final` marks its boundary. A new utterance starts a new cumulative text. |
| `done` | — | Normal finish completed. |
| `error` | `code` | Capture failed; stop sending and show the failure. |

To finish normally, send the exact text frame `{"type":"finish"}`. The server flushes the last utterance, then sends `done` and closes. To cancel, close the socket immediately; pending audio is discarded and is not flushed. Stop the AudioWorklet and disconnect its nodes, but do not stop a microphone track owned by another feature such as a call.

An idle audio connection, invalid PCM, a slow consumer, an unavailable model or lost authorization ends the session. Do not silently drop audio or silently switch to file transcription. Create a new session after an explicit retry.

## Limits and errors

The node admits two active model connections. Session creation returns `401 invalid_api_key`, `400 invalid_stream_request` / `invalid_origin`, `403 invalid_source_proof` for an invalid source-bound grant, or `429 stream_capacity`. The WebSocket rejects expired, reused or wrong-origin credentials. Runtime errors include `invalid_or_late_audio`, `authorization_or_backpressure`, `model_unavailable`, `model_disconnected` and `model_or_commit_failed`.

Audio and recognized text are not retained in model-service logs. This API emits approximate recognition events, not forced-alignment word timestamps.

## AIN Call source authorization

AIN Teams creates a server-signed source binding containing the actual user, call, AI epoch and revision. A fixed server-to-server authority checks current conversation access, live RTC participation, recording state and consent before accepting audio and before committing results. Only model-server text is saved through the existing transcript write path; browser-provided text is never accepted as a transcript. Consent changes close the stream and invalidate queued speech.

The native decoder is documented in the [Confucius4-R2T2 official source](https://github.com/netease-youdao/Confucius4-R2T2#streaming-transcription). Accuracy and time to the first result depend on the language, microphone, noise and workload; streaming support alone is not an accuracy guarantee.
