---
title: Claude Code에서 Ainize 쓰기
summary: 조직 API 키를 .ainize_key에 두고 ainize 스킬을 넣으면, Claude Code에게 저장소 배포나 QA 에이전트 생성을 말로 시킬 수 있습니다. 스킬이 하는 일, 사용자에게 묻는 것, 하지 않는 일을 정리했습니다.
source: en/how-to/claude-code-skill.md
source_sha256: 22be440bec611f1d43e4095109888aea438d0f8d8f13ef5b3583ea33f40da9d7
aincode: false
---

# Claude Code에서 Ainize 쓰기

Claude Code로 작업하면서 화면을 눌러 가는 대신 "배포해줘", "이 저장소에 대한 QA 에이전트를 만들어줘"라고 말하고 싶은
경우입니다. **ainize 스킬**은 지시 파일 두 개와 도우미 스크립트 하나입니다. 이 파일들과 API 키가 있으면 Claude Code가
화면이 쓰는 것과 같은 HTTP API를 호출합니다.

## 준비

1. **키를 만듭니다.** ainize의 **API keys**에서 **조직** 키를 만들고, 작업하는 디렉터리에 저장합니다.

   ```bash
   printf '%s' 'ainize-sk-…' > .ainize_key && chmod 600 .ainize_key
   echo .ainize_key >> .gitignore
   ```

2. **스킬을 넣습니다.** 프로젝트 안에 두거나, 모든 프로젝트에서 쓰려면 `~/.claude/skills/ainize/`에 둡니다.

   ```bash
   mkdir -p .claude/skills/ainize && cd .claude/skills/ainize
   curl -fsSLO https://ainize.ai/static/skills/ainize/SKILL-ainize.md
   curl -fsSLO https://ainize.ai/static/skills/ainize/SKILL-ainize-qa-agent.md
   curl -fsSLO https://ainize.ai/static/skills/ainize/ain_session.py
   mv SKILL-ainize.md SKILL.md
   ```

   `SKILL.md`는 프로젝트 배포와 운영을 다룹니다. `SKILL-ainize-qa-agent.md`는 QA 에이전트를 다루며, QA 에이전트를
   요청할 때 읽힙니다.

조직이 먼저 있어야 합니다. Ainize 조직은 같은 사람들의 AIN SSO 조직이며, auth.comcom.ai에서 SSO 소유자가 만듭니다.
키로는 조직을 만들 수 없습니다. [조직](./organizations.md)을 참고하세요.

## 시킬 수 있는 일

| 이렇게 말하면 | 일어나는 일 | 사용자가 줄 것 |
|---|---|---|
| "배포해줘" | GitHub 저장소를 가져옵니다. AinDrive 저장소, 프로젝트, 첫 배포가 만들어지고, 이후 머지마다 배포됩니다. Claude Code가 프로젝트 페이지, 배포 상태, 주소를 알려 줍니다. | GitHub에 있는 저장소. Next.js 앱이 아니면 [`ainize.json`](./deploy-with-ainize-json.md)이 필요하고, 없으면 Claude Code가 씁니다. |
| "배포 상태 알려줘", "로그 보여줘" | 최신 배포와 실행 중인 서비스의 로그를 읽습니다. | 없음 |
| "DATABASE_URL 시크릿 설정해줘" | 프로젝트 시크릿을 설정합니다(쓰기 전용). | 값. 지어내거나 다시 출력하지 않습니다. |
| "이 repo에 대한 qa agent를 만들어줘" | [QA 에이전트](./qa-agent.md)를 만듭니다: 채널, 보드, 에이전트, 자격 증명. | 브라우저에서 기기 로그인 승인 한 번, 그리고 운영자가 QA를 허가한 조직. |

## 하지 않는 일

- 조직을 만들거나, 조직에 QA나 관리형 저장소 사용을 허가하는 일. SSO 소유자와 노드 운영자가 결정합니다.
- 시키지 않은 프로젝트·에이전트 삭제.
- 키나 토큰을 출력하거나 커밋하는 일.

## 함께 보기

- [GitHub 리포 배포하기](./deploy-from-github.md) — 같은 가져오기를 손으로 하는 방법
- [저장소에 QA 에이전트 붙이기](./qa-agent.md)
- [CI/CD: 푸시가 배포되는 과정](./ci-cd.md)
