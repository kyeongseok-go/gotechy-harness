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
const commands = [...top.matchAll(/^ {2}([a-z]+)(?: \[[^\]]+\]| <[^>]+>)*\s{2,}/gm)].map((m) => m[1] as string)
const groups: Record<string, string[]> = { task: ['new', 'lint'], handoff: ['lint'], text: ['lint'], keys: ['init', 'rotate'], gate: ['verify'] }
const sections = [`## gotechy\n\n\`\`\`text\n${top}\n\`\`\``]
for (const c of commands.filter((x) => x !== 'help')) {
  for (const sub of groups[c] ?? [''])
    sections.push(`## gotechy ${c}${sub ? ` ${sub}` : ''}\n\n\`\`\`text\n${help(sub ? [c, sub] : [c])}\n\`\`\``)
}
writeFileSync(
  join(ROOT, 'docs', 'generated', 'cli.md'),
  `# gotechy 명령 참조 (자동 생성)\n\n<!-- scripts/gen-docs.ts가 만든다. 손으로 고치지 않는다. -->\n\n${sections.join('\n\n')}\n`,
)
console.log(`docs/generated/cli.md: 명령 ${sections.length}개`)
