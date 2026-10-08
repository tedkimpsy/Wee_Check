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
export type TimeSlot = { start: string; end: string }
export type OpeningSettings = { method: 'manual' | 'schedule'; week: TimeSlot[][] }
export const OPENING_KEY = 'wee-check-opening-v1'
export const weekdays = ['일', '월', '화', '수', '목', '금', '토']
export const emptyOpening = (): OpeningSettings => ({ method: 'manual', week: Array.from({ length: 7 }, () => []) })
export function validateSlots(slots: TimeSlot[]): string {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start))
  for (let i = 0; i < sorted.length; i++) {
    const slot = sorted[i]
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.end)) return '여는 시간과 닫는 시간을 입력해야 합니다.'
    if (slot.start >= slot.end) return '닫는 시간은 여는 시간보다 늦어야 합니다. 자정을 넘는 시간은 요일별로 나눕니다.'
    if (i && sorted[i - 1].end > slot.start) return '개방 시간이 서로 겹칩니다.'
  }
  return ''
}
export function readOpening(): OpeningSettings {
  try {
    const value = JSON.parse(localStorage.getItem(OPENING_KEY) || 'null')
    if (value && (value.method === 'manual' || value.method === 'schedule') && Array.isArray(value.week) && value.week.length === 7 && value.week.every((slots: unknown) => Array.isArray(slots) && slots.every(slot => slot && typeof slot.start === 'string' && typeof slot.end === 'string') && !validateSlots(slots))) return value
  } catch { /* Use manual mode until configured. */ }
  return emptyOpening()
}
export function effectiveMode(mode: OperationMode, opening: OpeningSettings, now = new Date()): OperationMode {
  if (opening.method === 'manual' || mode !== 'open') return mode
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value || ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday'))
  const time = `${value('hour')}:${value('minute')}`
  return opening.week[day]?.some(slot => slot.start <= time && time < slot.end) ? 'open' : 'closed'
}
