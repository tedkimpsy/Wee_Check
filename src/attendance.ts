export const moodOptions = [
  { value: 'sunny-full', label: '햇살 가득' },
  { value: 'sunny-soft', label: '햇살 조금' },
  { value: 'cloudy', label: '구름 가득' },
  { value: 'drizzle', label: '빗방울' },
  { value: 'heavy-rain', label: '거센 비' },
] as const

export type MoodValue = typeof moodOptions[number]['value']

export type AttendanceRecord = {
  id: string
  grade: string
  schoolClass: string
  name: string
  direction: 'in' | 'out'
  timestamp: string
  mood?: MoodValue | null
}

export const STORAGE_KEY = 'wee-check-attendance-v1'
export const dateKey = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(date)
export const timeLabel = (timestamp: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp))
export const studentKey = (record: Pick<AttendanceRecord, 'grade' | 'schoolClass' | 'name'>) => JSON.stringify([record.grade, record.schoolClass, record.name])
export const isMoodValue = (value: unknown): value is MoodValue => moodOptions.some(option => option.value === value)
export const moodLabel = (value: MoodValue | null) => value === null ? '선택하지 않음' : moodOptions.find(option => option.value === value)?.label || ''

export function readRecords(): AttendanceRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is AttendanceRecord => item && typeof item.id === 'string' && typeof item.grade === 'string' && typeof item.schoolClass === 'string' && typeof item.name === 'string' && (item.direction === 'in' || item.direction === 'out') && typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp)) && (!('mood' in item) || item.mood === null || isMoodValue(item.mood)))
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

export function dailyMoodSummary(records: AttendanceRecord[], day: string) {
  const entries = records
    .filter(record => record.direction === 'in' && dateKey(new Date(record.timestamp)) === day)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  const responses = entries.filter(record => 'mood' in record)
  const counts = Object.fromEntries(moodOptions.map(option => [option.value, responses.filter(record => record.mood === option.value).length])) as Record<MoodValue, number>
  return {
    entries,
    responses,
    counts,
    skipped: responses.filter(record => record.mood === null).length,
    legacy: entries.length - responses.length,
  }
}
