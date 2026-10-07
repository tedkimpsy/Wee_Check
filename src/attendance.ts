export type AttendanceRecord = {
  id: string
  grade: string
  schoolClass: string
  name: string
  direction: 'in' | 'out'
  timestamp: string
}

export const STORAGE_KEY = 'wee-check-attendance-v1'
export const dateKey = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
export const timeLabel = (timestamp: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp))
export const studentKey = (record: Pick<AttendanceRecord, 'grade' | 'schoolClass' | 'name'>) => JSON.stringify([record.grade, record.schoolClass, record.name])

export function readRecords(): AttendanceRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is AttendanceRecord => item && typeof item.id === 'string' && typeof item.grade === 'string' && typeof item.schoolClass === 'string' && typeof item.name === 'string' && (item.direction === 'in' || item.direction === 'out') && typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp)))
  } catch { return [] }
}

export function dailySummary(records: AttendanceRecord[], day: string) {
  const daily = records.filter(record => dateKey(new Date(record.timestamp)) === day).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  const latest = new Map<string, AttendanceRecord>()
  const arrivals = new Set<string>()
  const departures = new Set<string>()
  daily.forEach(record => {
    const key = studentKey(record)
    latest.set(key, record)
    if (record.direction === 'in') arrivals.add(key)
    else departures.add(key)
  })
  return { daily, latest: [...latest.values()].reverse(), arrivals: arrivals.size, departures: departures.size, present: [...latest.values()].filter(record => record.direction === 'in').length }
}
