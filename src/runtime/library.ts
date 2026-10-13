// 하네스 라이브러리(이 저장소)의 위치. 실행 위치가 아니라 소스 위치 기준이어야 sandbox 프로젝트에서도 동작한다.
import { join } from 'node:path'

export function libraryRoot(): string {
  return process.env.GOTECHY_LIB ?? join(import.meta.dir, '..', '..')
}
