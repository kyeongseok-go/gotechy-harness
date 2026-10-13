import { claudeAdapter } from './claude'
import { codexAdapter } from './codex'
import { fakeAdapter } from './fake'
import type { WorkerAdapter } from './types'

export const adapters: Record<WorkerAdapter['name'], WorkerAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
  fake: fakeAdapter,
}
