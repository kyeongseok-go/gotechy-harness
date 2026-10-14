# gotechy 명령 참조 (자동 생성)

<!-- scripts/gen-docs.ts가 만든다. 손으로 고치지 않는다. -->

## gotechy

```text
Usage: gotechy [options] [command]

파일 계약 기반 에이전트 작업 위임 (하네스 v2)

Options:
  -V, --version                           output the version number
  -h, --help                              display help for command

Commands:
  init [options]                          현재 폴더에 계약 골격(orchestration/), AGENTS.md 라우터, 팩을 깐다 (팩은 apm, contract.md 10.7절)
  task                                    작업 명세
  handoff                                 HANDOFF
  text                                    사람용 문서
  inbox                                   HANDOFF를 결정 필요, 실패, 완료 순의 3초 카드로 보여 준다 (contract.md 8.1절)
  render [taskId]                         읽기 전용 HTML 화면을 .gotechy/view/에 만든다 (contract.md 8.2절)
  run [options] <taskId>                  작업 하나를 워커에게 맡기고 검증한다 (contract.md 2절, 6.6절)
  keys                                    오너 키: Secure Enclave 키와 Touch ID로 결정에 서명한다 (contract.md 6.3절)
  decide <gateId> <choice> [instruction]  게이트를 결정한다. 대화형 터미널에서만 (contract.md 6.4절)
  serve [options]                         화면에서 게이트를 결정하는 로컬 서버를 연다 (contract.md 8.3절)
  loop [options]                          autonomy L2 이상인 작업을 예산과 멈춤 규칙 안에서 차례로 돌리고 아침 보고서를 만든다 (contract.md 11절)
  guard                                   Claude Code PreToolUse hook: 리드의 부작용 명령을 막는다. 표준 입력의 hook JSON을 읽는다 (contract.md 12절)
  status [options]                        열린 결정 수를 보여 준다. --line은 Claude Code 상태 줄용 한 줄 (contract.md 12절)
  accept <taskId>                         승인한 작업 브랜치를 메인에 병합한다 (contract.md 9.4절)
  gate                                    게이트
  doctor [options]                        설치 상태가 train과 같은지, 정책과 라이브러리 규칙을 검사한다 (contract.md 10.2절)
  setup [options]                         train의 정책을 전역 설정에 넣는다. 바꾸기 전에 백업한다 (contract.md 10.3절)
  test                                    라이브러리 테스트를 돌리고 커버리지 기준(전체 80%, 핵심 모듈 95%)을 본다 (contract.md 10.6절)
  help [command]                          display help for command
```

## gotechy init

```text
Usage: gotechy init [options]

현재 폴더에 계약 골격(orchestration/), AGENTS.md 라우터, 팩을 깐다 (팩은 apm, contract.md 10.7절)

Options:
  --packs <list>  설치할 팩 (쉼표 구분) (default: "owner")
  -h, --help      display help for command
```

## gotechy task new

```text
Usage: gotechy task new [options] <title>

Arguments:
  title               작업 제목 (80자 이내)

Options:
  --verify <cmd>      리드가 완료를 판정할 셸 명령
  --ownership <list>  워커가 바꿀 수 있는 경로 (쉼표 구분)
  --tier <tier>       라우팅 등급 T0~T3 (default: "T0")
  --agent <name>      claude | codex | fake
  --model <id>        워커 모델 (예: claude-opus-5-5, gpt-6.1-sol)
  --effort <level>    low | medium | high | xhigh | max
  --packs <list>      팩 (쉼표 구분) (default: "owner")
  -h, --help          display help for command
```

## gotechy task lint

```text
Usage: gotechy task lint [options] <files...>

Options:
  -h, --help  display help for command
```

## gotechy handoff lint

```text
Usage: gotechy handoff lint [options] <files...>

Options:
  -h, --help  display help for command
```

## gotechy text lint

```text
Usage: gotechy text lint [options] <files...>

문체 규칙(contract.md 7절, AI 티) 검사

Options:
  -h, --help  display help for command
```

## gotechy inbox

```text
Usage: gotechy inbox [options]

HANDOFF를 결정 필요, 실패, 완료 순의 3초 카드로 보여 준다 (contract.md 8.1절)

Options:
  -h, --help  display help for command
```

## gotechy render

```text
Usage: gotechy render [options] [taskId]

읽기 전용 HTML 화면을 .gotechy/view/에 만든다 (contract.md 8.2절)

Arguments:
  taskId      이 작업 화면의 주소를 출력 (없으면 인박스 화면)

Options:
  -h, --help  display help for command
```

## gotechy run

```text
Usage: gotechy run [options] <taskId>

작업 하나를 워커에게 맡기고 검증한다 (contract.md 2절, 6.6절)

Options:
  --adapter <name>  claude | codex | fake (작업의 agent보다 우선)
  --fixture <dir>   fake 어댑터가 재생할 녹화 폴더
  -h, --help        display help for command
```

## gotechy keys init

```text
Usage: gotechy keys init [options]

오너 키가 없으면 만든다. 서명 도구가 없으면 swiftc로 빌드한다

Options:
  -h, --help  display help for command
```

## gotechy keys rotate

```text
Usage: gotechy keys rotate [options]

새 오너 키로 바꾸고 이전 키를 지운다. 이전 키로 한 결정은 다시 결정해야 한다

Options:
  -h, --help  display help for command
```

## gotechy decide

```text
Usage: gotechy decide [options] <gateId> <choice> [instruction]

게이트를 결정한다. 대화형 터미널에서만 (contract.md 6.4절)

Arguments:
  gateId
  choice       선택지 중 하나
  instruction  워커에게 줄 다음 지시

Options:
  -h, --help   display help for command
```

## gotechy serve

```text
Usage: gotechy serve [options]

화면에서 게이트를 결정하는 로컬 서버를 연다 (contract.md 8.3절)

Options:
  --port <번호>  포트 (기본은 빈 포트) (default: "0")
  -h, --help   display help for command
```

## gotechy loop

```text
Usage: gotechy loop [options]

autonomy L2 이상인 작업을 예산과 멈춤 규칙 안에서 차례로 돌리고 아침 보고서를 만든다 (contract.md 11절)

Options:
  --budget <달러>       이번 루프의 예산(시작한 작업 budget_usd의 합) (default: "5")
  --max-attempts <N>  작업마다 시도 상한 (default: "3")
  --reset             이어 가기 상태를 비우고, 루프가 멈춘 작업도 다시 시도한다
  -h, --help          display help for command
```

## gotechy guard

```text
Usage: gotechy guard [options]

Claude Code PreToolUse hook: 리드의 부작용 명령을 막는다. 표준 입력의 hook JSON을 읽는다 (contract.md
12절)

Options:
  -h, --help  display help for command
```

## gotechy status

```text
Usage: gotechy status [options]

열린 결정 수를 보여 준다. --line은 Claude Code 상태 줄용 한 줄 (contract.md 12절)

Options:
  --line      한 줄로
  -h, --help  display help for command
```

## gotechy accept

```text
Usage: gotechy accept [options] <taskId>

승인한 작업 브랜치를 메인에 병합한다 (contract.md 9.4절)

Options:
  -h, --help  display help for command
```

## gotechy gate verify

```text
Usage: gotechy gate verify [options] [gateIds...]

결정 서명과 판본을 검증한다 (contract.md 6.5절)

Options:
  -h, --help  display help for command
```

## gotechy doctor

```text
Usage: gotechy doctor [options]

설치 상태가 train과 같은지, 정책과 라이브러리 규칙을 검사한다 (contract.md 10.2절)

Options:
  --history   현재 저장소의 git 이력 전체를 gitleaks로 검사
  -h, --help  display help for command
```

## gotechy setup

```text
Usage: gotechy setup [options]

train의 정책을 전역 설정에 넣는다. 바꾸기 전에 백업한다 (contract.md 10.3절)

Options:
  --dry-run          바꿀 내용만 보여 주고 아무것도 쓰지 않는다
  --restore <stamp>  이 시각의 백업으로 되돌린다
  -h, --help         display help for command
```

## gotechy test

```text
Usage: gotechy test [options]

라이브러리 테스트를 돌리고 커버리지 기준(전체 80%, 핵심 모듈 95%)을 본다 (contract.md 10.6절)

Options:
  -h, --help  display help for command
```
