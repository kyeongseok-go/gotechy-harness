// docs/generated/cli.md를 만든다(`npm run gen:docs`). 손으로 고치지 않는다. CLI의 도움말이 원천이다.
// 완료 게이트는 이 명령 뒤 `git diff docs/generated/`가 비어 있는지 본다(문서가 코드와 어긋나지 않음).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const CLI = join(ROOT, 'src', 'cli.ts')
const help = (args: string[]) => {
  const r = Bun.spawnSync({
    cmd: [process.execPath, CLI, ...args, '--help'],
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? ROOT, NO_COLOR: '1' },
  })
  return r.stdout.toString().trim()
}
const top = help([])
// 설명 없는 명령 뒤의 줄바꿈까지 먹지 않게 공백은 같은 줄에서만 센다(doc-gardener 2026-10-15)
const commands = [...top.matchAll(/^ {2}([a-z]+)(?: \[[^\]]+\]| <[^>]+>)*(?:[ \t]{2,}|$)/gm)].map(
  (m) => m[1] as string,
)
// 하위 명령은 각 명령 도움말의 Commands 절에서 읽는다. 손으로 적은 목록은 새 하위 명령을 빠뜨렸다(keys pin, 2026-10-15)
const subcommands = (c: string) => {
  const block = help([c]).split(/^Commands:$/m)[1] ?? ''
  const subs = [...block.matchAll(/^ {2}([a-z]+)(?: \[[^\]]+\]| <[^>]+>)*(?:[ \t]{2,}|$)/gm)]
    .map((m) => m[1] as string)
    .filter((x) => x !== 'help')
  return subs.length > 0 ? subs : ['']
}
const sections = [`## gotechy\n\n\`\`\`text\n${top}\n\`\`\``]
for (const c of commands.filter((x) => x !== 'help')) {
  for (const sub of subcommands(c))
    sections.push(`## gotechy ${c}${sub ? ` ${sub}` : ''}\n\n\`\`\`text\n${help(sub ? [c, sub] : [c])}\n\`\`\``)
}
writeFileSync(
  join(ROOT, 'docs', 'generated', 'cli.md'),
  `# gotechy 명령 참조 (자동 생성)\n\n<!-- scripts/gen-docs.ts가 만든다. 손으로 고치지 않는다. -->\n\n${sections.join('\n\n')}\n`,
)
console.log(`docs/generated/cli.md: 명령 ${sections.length}개`)
