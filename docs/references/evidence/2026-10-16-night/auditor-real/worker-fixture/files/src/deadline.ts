// 공문 본문에서 회신 마감을 찾는다
export type Deadline = { date: string; time: string; evidence: string }

const FULL = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./
const SHORT = /(\d{1,2})\.\s*(\d{1,2})\.\s*\(/

export function findDeadline(text: string, issuedAt: Date): Deadline | undefined {
  for (const line of text.split('\n')) {
    if (!line.includes('까지')) continue
    const full = FULL.exec(line)
    if (full)
      return { date: `${full[1]}-${pad(full[2])}-${pad(full[3])}`, time: timeOf(line), evidence: line.trim() }
    const short = SHORT.exec(line)
    if (short) {
      // 연도가 없으면 올해로 둔다
      const year = new Date().getFullYear()
      return { date: `${year}-${pad(short[1])}-${pad(short[2])}`, time: timeOf(line), evidence: line.trim() }
    }
  }
  return undefined
}

function timeOf(line: string): string {
  const m = /(\d{1,2}):(\d{2})/.exec(line)
  return m ? `${pad(m[1])}:${m[2]}` : '23:59'
}

const pad = (s = '') => s.padStart(2, '0')
