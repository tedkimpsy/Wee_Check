export type SafetyAnswer = 'yes' | 'no' | 'talk'
export type Screening = { immediate: SafetyAnswer; selfHarm: SafetyAnswer; unsafe: SafetyAnswer }
export type CounselingTopic = 'school' | 'friends' | 'family' | 'feelings' | 'bullying' | 'other'
export const counselingTopics: Record<CounselingTopic, string> = { school: '학교생활', friends: '친구', family: '가족', feelings: '마음·기분', bullying: '괴롭힘', other: '그 밖의 고민' }
export type GuardianRelation = 'mother' | 'father' | 'grandparent' | 'other'
export const guardianRelations: Record<GuardianRelation, string> = { mother: '엄마', father: '아빠', grandparent: '할머니·할아버지', other: '그 밖의 보호자' }
export type RequestDetails = { contact: string; contactOwner: 'student' | 'guardian' | 'teacher'; guardianRelation?: GuardianRelation; noContact: boolean; topics: CounselingTopic[]; screening: Screening }
export type CounselingRequest = { id: string; grade: string; schoolClass: string; name: string; timestamp: string; completed: boolean; details?: RequestDetails }
export const safetyQuestions: Record<keyof Screening, string> = {
  immediate: '지금 다쳤거나, 바로 어른의 도움이 필요한가요?',
  selfHarm: '요즘 스스로를 다치게 하고 싶거나, 죽고 싶다는 생각이 든 적이 있나요?',
  unsafe: '누군가 나를 해칠까 봐 무섭거나, 학교나 집에서 안전하지 않다고 느끼나요?',
}
export function requestPriority(details?: RequestDetails): 'urgent' | 'followup' | 'regular' | 'unknown' {
  if (!details) return 'unknown'
  if (details.screening.immediate === 'yes') return 'urgent'
  if (Object.values(details.screening).some(answer => answer === 'yes' || answer === 'talk')) return 'followup'
  return 'regular'
}
export const priorityLabels = { urgent: '지금 확인 필요', followup: '먼저 확인 필요', regular: '신청 확인 필요', unknown: '안전 확인 답변 없음' }
export function validDetails(value: unknown): value is RequestDetails {
  const item = value as RequestDetails | undefined
  return !!item && typeof item.contact === 'string' && typeof item.noContact === 'boolean' && ['student', 'guardian', 'teacher'].includes(item.contactOwner) && (!item.guardianRelation || Object.hasOwn(guardianRelations, item.guardianRelation)) && (!('topics' in item) || (Array.isArray(item.topics) && item.topics.every(topic => Object.hasOwn(counselingTopics, topic)))) && !!item.screening && (['immediate', 'selfHarm', 'unsafe'] as const).every(key => ['yes', 'no', 'talk'].includes(item.screening[key]))
}
export const COUNSELING_KEY = 'wee-check-counseling-v1'
export function readRequests(): CounselingRequest[] {
  try {
    const value = JSON.parse(localStorage.getItem(COUNSELING_KEY) || '[]')
    return Array.isArray(value) ? value.filter(item => item && ['id', 'grade', 'schoolClass', 'name', 'timestamp'].every(key => typeof item[key] === 'string') && Number.isFinite(Date.parse(item.timestamp)) && typeof item.completed === 'boolean').map(item => ({ ...item, details: validDetails(item.details) ? { ...item.details, topics: Array.isArray(item.details.topics) ? item.details.topics : [] } : undefined })) : []
  } catch { return [] }
}
