// contract.md 10.2절 doctor의 순수 판정: 버전 읽기, 셸 스크립트, 스킬 frontmatter.
import { describe, expect, test } from 'bun:test'
import {
  parseVersion,
  scriptProblems,
  settingsEnvProblems,
  skillProblems,
} from '../../src/core/doctor'

describe('버전 읽기', () => {
  test.each([
    ['v24.21.0', '24.21.0'],
    ['2.1.296 (Claude Code)', '2.1.296'],
    ['2026.10.8 macos-arm64 (2026-10-11)', '2026.10.8'],
    ['gh version 2.102.0 (2026-09-30)\nhttps://github.com/cli/cli', '2.102.0'],
  ])('%s', (out, v) => {
    expect(parseVersion(out)).toBe(v)
  })
  test('버전이 없으면 undefined', () => {
    expect(parseVersion('command not found')).toBeUndefined()
  })
})

describe('셸 스크립트 검사', () => {
  test('#!/bin/sh 스크립트의 POSIX 밖 문법을 잡는다', () => {
    const text = '#!/bin/sh\nif [[ -f x ]]; then echo; fi\nread a <<< "b"\n'
    expect(scriptProblems(text).join(' ')).toContain('[[')
    expect(scriptProblems(text).join(' ')).toContain('<<<')
  })
  test('bash 스크립트는 bash 3.2에 없는 문법만 잡는다', () => {
    expect(scriptProblems('#!/usr/bin/env bash\nif [[ -f x ]]; then :; fi\n')).toEqual([])
    expect(scriptProblems('#!/usr/bin/env bash\ndeclare -A m\n').join(' ')).toContain('declare -A')
  })
  test('GNU 전용 명령은 둘 다 잡는다', () => {
    expect(scriptProblems('#!/bin/sh\nsha256sum x\n').join(' ')).toContain('sha256sum')
    expect(scriptProblems('#!/usr/bin/env bash\ndate -d yesterday\n').join(' ')).toContain(
      'date -d',
    )
  })
  test('주석 안의 글자는 보지 않는다', () => {
    expect(scriptProblems('#!/bin/sh\n# [[ 는 쓰지 않는다\necho ok\n')).toEqual([])
  })
})

describe('스킬 frontmatter 검사', () => {
  const skill = (fm: string, lines = 3) => `---\n${fm}\n---\n${'본문\n'.repeat(lines)}`
  test('name과 description이 있고 길이가 맞으면 통과', () => {
    expect(skillProblems(skill('name: a\ndescription: 짧은 설명'))).toEqual([])
  })
  test('description이 없거나 400자를 넘으면 실패', () => {
    expect(skillProblems(skill('name: a')).join(' ')).toContain('description')
    expect(skillProblems(skill(`name: a\ndescription: ${'가'.repeat(401)}`)).join(' ')).toContain(
      '400',
    )
  })
  test('본문이 150줄을 넘으면 실패', () => {
    expect(skillProblems(skill('name: a\ndescription: b', 151)).join(' ')).toContain('150')
  })
})

describe('프로젝트 설정 env (보안 감사 15차 중간 2)', () => {
  test('PATH, NODE_ENV, GOTECHY_, GITLEAKS_ 변수를 찾는다', () => {
    expect(
      settingsEnvProblems(
        JSON.stringify({
          env: { PATH: '/x', NODE_ENV: 'test', GOTECHY_GITLEAKS: '/usr/bin/true', FOO: '1' },
        }),
      ),
    ).toEqual(['PATH', 'NODE_ENV', 'GOTECHY_GITLEAKS'])
    expect(settingsEnvProblems(JSON.stringify({ permissions: {} }))).toEqual([])
    expect(settingsEnvProblems('깨짐')).toEqual([])
  })
})
