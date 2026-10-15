// 리드가 프로젝트 안에 쓰는 파일의 공용 쓰기. 남의 저장소가 같은 이름의 링크를 심어 두어도 따라가지 않는다(보안 감사 13차 높음 1).
import { randomBytes } from 'node:crypto'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** 같은 폴더의 무작위 이름 임시 파일에 새로 만들어 쓰고(wx: 있으면 실패, 링크도 따라가지 않음) 이름을 바꾼다. 자리에 링크가 있으면 링크 자체가 바뀐다 */
export function writeAtomic(file: string, data: string | Buffer): void {
  const dir = dirname(file)
  mkdirSync(dir, { recursive: true })
  const tmp = join(dir, `.tmp-${randomBytes(6).toString('hex')}`)
  try {
    writeFileSync(tmp, data, { flag: 'wx' })
    renameSync(tmp, file)
  } finally {
    rmSync(tmp, { force: true })
  }
}
