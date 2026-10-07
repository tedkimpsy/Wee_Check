import { defaultRoster } from './defaultRoster'
export type Roster = Record<string, Record<string, string[]>>
export type SchoolType = 'elementary' | 'middle' | 'high'
export type SchoolSettings = { schoolType: SchoolType; roster: Roster }
export const SETTINGS_KEY = 'wee-check-roster-v1'
export const schoolTypes: Record<SchoolType, string> = { elementary: '초등학교', middle: '중학교', high: '고등학교' }
export const gradeCount = (type: SchoolType) => type === 'elementary' ? 6 : 3
export function visibleRoster(settings: SchoolSettings): Roster {
  return Object.fromEntries(Object.entries(settings.roster).filter(([grade]) => Number(grade.replace('학년', '')) <= gradeCount(settings.schoolType)))
}
export function readSettings(): SchoolSettings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    if (value && ['elementary', 'middle', 'high'].includes(value.schoolType) && value.roster && typeof value.roster === 'object' && !Array.isArray(value.roster) && Object.entries(value.roster).every(([grade, classes]) => /^[1-6]학년$/.test(grade) && classes && typeof classes === 'object' && !Array.isArray(classes) && Object.entries(classes).every(([label, names]) => /^[1-9]\d*반$/.test(label) && Array.isArray(names) && names.every(name => typeof name === 'string' && name.trim())))) return value
  } catch { /* Fall back to the example roster. */ }
  return { schoolType: 'elementary', roster: defaultRoster }
}
export function parseRoster(text: string, schoolType: SchoolType): Roster {
  const result: Roster = {}
  const lines = text.trim().split(/\r?\n/)
  if (!text.trim()) throw new Error('학년·반·이름 표를 붙여넣어 주세요.')
  lines.forEach((line, index) => {
    if (!line.trim()) return
    const cells = line.split(line.includes('\t') ? '\t' : ',').map(cell => cell.trim())
    if (index === 0 && cells.join(',') === '학년,반,이름') return
    if (cells.length !== 3) throw new Error(`${index + 1}행: 학년, 반, 이름 세 열이 필요합니다.`)
    const [rawGrade, rawClass, name] = cells
    const grade = rawGrade.replace(/학년$/, '')
    const schoolClass = rawClass.replace(/반$/, '')
    if (!/^[1-6]$/.test(grade) || Number(grade) > gradeCount(schoolType)) throw new Error(`${index + 1}행: ${schoolTypes[schoolType]}는 1~${gradeCount(schoolType)}학년만 등록할 수 있습니다.`)
    if (!/^[1-9]\d*$/.test(schoolClass) || !name || name.length > 30) throw new Error(`${index + 1}행: 반 번호와 이름을 확인해 주세요.`)
    const names = (result[`${grade}학년`] ??= {})[`${schoolClass}반`] ??= []
    if (names.includes(name)) throw new Error(`${index + 1}행: 같은 학년·반의 이름이 중복됩니다. 동명이인은 이름 뒤에 번호를 붙여 구분해 주세요.`)
    names.push(name)
  })
  if (!Object.keys(result).length) throw new Error('등록할 학생이 없습니다.')
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, 'ko', { numeric: true })).map(([grade, classes]) => [grade, Object.fromEntries(Object.entries(classes).sort(([a], [b]) => a.localeCompare(b, 'ko', { numeric: true })).map(([label, names]) => [label, names.sort((a, b) => a.localeCompare(b, 'ko'))]))]))
}
