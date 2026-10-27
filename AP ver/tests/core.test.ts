import { describe, expect, it } from 'vitest'
import { effectiveMode, emptyOpening, normalizeOpening, validateSlots } from '../src/operation'
import { requestPriority, validDetails } from '../src/counseling'

describe('운영 시간표', () => {
  it('수동 상태를 그대로 적용한다', () => expect(effectiveMode('closed', emptyOpening())).toBe('closed'))
  it('자동 시간표보다 임시 상태를 우선한다', () => expect(effectiveMode('meeting', normalizeOpening({ method: 'schedule', week: Array.from({ length: 7 }, () => [{ start: '00:00', end: '23:59', grades: [], maxPlayMinutes: 20 }]) }))).toBe('meeting'))
  it('겹치는 시간대를 거부한다', () => expect(validateSlots([{ start: '09:00', end: '11:00', grades: [], maxPlayMinutes: 15 }, { start: '10:00', end: '12:00', grades: [], maxPlayMinutes: 20 }])).not.toBe(''))
  it('기존 시간표에 정원과 최대 놀이시간 기본값을 보완한다', () => {
    const opening = normalizeOpening({ method: 'schedule', week: [[{ start: '09:00', end: '10:00' } as any]] })
    expect(opening.capacity).toEqual({ enabled: true, limit: 10, manualMaxPlayMinutes: 30 })
    expect(opening.week[0][0]).toMatchObject({ grades: [], maxPlayMinutes: 30 })
  })
  it('최대 놀이시간 범위를 검증한다', () => expect(validateSlots([{ start: '09:00', end: '10:00', grades: [], maxPlayMinutes: 4 }])).toContain('5분'))
})

describe('상담 안전 확인', () => {
  const base = { contact: '', contactOwner: 'teacher' as const, noContact: true, topics: ['feelings'] as const, screening: { immediate: 'no' as const, selfHarm: 'no' as const, unsafe: 'no' as const } }
  it('즉시 도움이 필요한 답변을 긴급으로 분류한다', () => expect(requestPriority({ ...base, topics: [...base.topics], screening: { ...base.screening, immediate: 'yes' } })).toBe('urgent'))
  it('서버에 저장할 상담 구조를 검증한다', () => expect(validDetails({ ...base, topics: [...base.topics] })).toBe(true))
})

