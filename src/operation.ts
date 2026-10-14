export type OperationMode = 'open' | 'closed' | 'meeting' | 'counseling' | 'class' | 'trip' | 'meal' | 'away'
export const OPERATION_KEY = 'wee-check-operation-v1'
export const operationModes: Record<OperationMode, { label: string; message: string }> = {
  open: { label: '개방', message: 'Wee클래스에서 쉬거나 놀고 갈 수 있어요.' },
  closed: { label: '닫힘', message: '지금은 Wee클래스가 쉬는 시간이에요. Wee클래스가 열리면 다시 만나요.' },
  meeting: { label: '회의 중', message: '지금은 회의 중이라 들어올 수 없어요. 회의가 끝난 뒤 다시 찾아와 주세요.' },
  counseling: { label: '상담 중', message: '지금은 상담 중이라 들어올 수 없어요. 상담이 끝난 뒤 다시 찾아와 주세요.' },
  class: { label: '수업 중', message: '지금은 수업 중이에요. 수업이 끝나면 다시 만나요.' },
  trip: { label: '출장 중', message: '선생님이 학교 밖에서 일을 보고 있어요. 돌아오면 다시 만나요.' },
  meal: { label: '식사 중', message: '지금은 식사 중이에요. 식사가 끝나면 다시 만나요.' },
  away: { label: '부재 중', message: '선생님이 잠시 자리를 비웠어요. 돌아오면 다시 만나요.' },
}
export function readOperationMode(): OperationMode {
  try {
    const value = localStorage.getItem(OPERATION_KEY)
    return value && Object.hasOwn(operationModes, value) ? value as OperationMode : 'open'
  } catch { return 'open' }
}
export const isSpecialMode = (mode: OperationMode) => mode !== 'open' && mode !== 'closed'
export type CapacitySettings = { enabled: boolean; limit: number; manualMaxPlayMinutes: number }
export type TimeSlot = { start: string; end: string; grades: string[]; maxPlayMinutes: number }
export type OpeningSettings = { method: 'manual' | 'schedule'; week: TimeSlot[][]; capacity: CapacitySettings }
export const OPENING_KEY = 'wee-check-opening-v1'
export const weekdays = ['일', '월', '화', '수', '목', '금', '토']
export const defaultCapacity = (): CapacitySettings => ({ enabled: true, limit: 10, manualMaxPlayMinutes: 30 })
export const normalizeSlot = (slot: Partial<TimeSlot>): TimeSlot => ({
  start: typeof slot.start === 'string' ? slot.start : '09:00',
  end: typeof slot.end === 'string' ? slot.end : '10:00',
  grades: Array.isArray(slot.grades) ? slot.grades.filter(grade => typeof grade === 'string') : [],
  maxPlayMinutes: Number.isInteger(slot.maxPlayMinutes) && Number(slot.maxPlayMinutes) >= 5 && Number(slot.maxPlayMinutes) <= 180 ? Number(slot.maxPlayMinutes) : 30,
})
export const normalizeOpening = (value?: Partial<OpeningSettings> | null): OpeningSettings => ({
  method: value?.method === 'schedule' ? 'schedule' : 'manual',
  week: Array.from({ length: 7 }, (_, day) => Array.isArray(value?.week?.[day]) ? value!.week![day].map(normalizeSlot) : []),
  capacity: {
    enabled: value?.capacity?.enabled !== false,
    limit: Number.isInteger(value?.capacity?.limit) && Number(value?.capacity?.limit) >= 1 && Number(value?.capacity?.limit) <= 99 ? Number(value?.capacity?.limit) : 10,
    manualMaxPlayMinutes: Number.isInteger(value?.capacity?.manualMaxPlayMinutes) && Number(value?.capacity?.manualMaxPlayMinutes) >= 5 && Number(value?.capacity?.manualMaxPlayMinutes) <= 180 ? Number(value?.capacity?.manualMaxPlayMinutes) : 30,
  },
})
export const emptyOpening = (): OpeningSettings => normalizeOpening(null)
export function validateSlots(slots: TimeSlot[]): string {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start))
  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[i]
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end)) return '여는 시간과 닫는 시간을 입력해야 합니다.'
    if (slot.start >= slot.end) return '닫는 시간은 여는 시간보다 늦어야 합니다. 자정을 넘는 시간은 요일별로 나눕니다.'
    if (i && sorted[i - 1].end > slot.start) return '개방 시간이 서로 겹칩니다.'
    if (!Number.isInteger(slot.maxPlayMinutes) || slot.maxPlayMinutes < 5 || slot.maxPlayMinutes > 180) return '최대 놀이시간은 5분부터 180분까지 입력해야 합니다.'
  }
  return ''
}
export function readOpening(): OpeningSettings {
  try {
    const value = JSON.parse(localStorage.getItem(OPENING_KEY) || 'null')
    const normalized = normalizeOpening(value)
    if (value && Array.isArray(value.week) && value.week.length === 7 && normalized.week.every(slots => !validateSlots(slots))) return normalized
  } catch { /* Use manual mode until configured. */ }
  return emptyOpening()
}
export function currentOpeningSlot(opening: OpeningSettings, now = new Date()): { day: number; slot: TimeSlot } | null {
  if (opening.method !== 'schedule') return null
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value || ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'))
  const time = `${value('hour')}:${value('minute')}`
  const slot = opening.week[day]?.find(item => item.start <= time && time < item.end)
  return slot ? { day, slot } : null
}
export function effectiveMode(mode: OperationMode, opening: OpeningSettings, now = new Date()): OperationMode {
  if (opening.method === 'manual' || mode !== 'open') return mode
  return currentOpeningSlot(opening, now) ? 'open' : 'closed'
}
