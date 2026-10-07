import { useState } from 'react'
import { CalendarDays, ToggleRight, Check } from 'lucide-react'
import Modal from './Modal'
import { validateSlots, weekdays, type OpeningSettings as OpeningConfig, type TimeSlot } from './operation'

function DayEditor({ day, slots, onSave, onClose }: { day: number; slots: TimeSlot[]; onSave: (slots: TimeSlot[]) => boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(slots.map(slot => ({ ...slot })))
  const [error, setError] = useState('')
  return <Modal title={`${weekdays[day]}요일 개방 시간`} onClose={onClose}>
    <p className="operation-help">한국 시간 기준입니다. 여러 시간대를 추가할 수 있으며, 시간이 없으면 이 요일은 닫습니다.</p>
    {draft.map((slot, index) => <div className="time-slot" key={index}><label>여는 시간<input type="time" value={slot.start} onChange={event => setDraft(draft.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} /></label><span>~</span><label>닫는 시간<input type="time" value={slot.end} onChange={event => setDraft(draft.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} /></label><button className="admin-nav" onClick={() => setDraft(draft.filter((_, i) => i !== index))}>삭제</button></div>)}
    {!draft.length && <p>등록된 개방 시간이 없습니다.</p>}
    <button className="admin-nav" onClick={() => setDraft([...draft, { start: '09:00', end: '10:00' }])}>+ 시간대 추가</button>
    {error && <p className="record-error" role="alert">{error}</p>}
    <div className="roster-actions"><button className="admin-nav" onClick={onClose}>취소</button><button className="primary-button" onClick={() => { const error = validateSlots(draft); if (error) { setError(error); return } if (onSave([...draft].sort((a, b) => a.start.localeCompare(b.start)))) onClose(); else setError('저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.') }}>저장</button></div>
  </Modal>
}
export default function OpeningSettings({ opening, onSave }: { opening: OpeningConfig; onSave: (opening: OpeningConfig) => boolean }) {
  const [day, setDay] = useState<number | null>(null)
  const [error, setError] = useState('')
  const chooseMethod = (method: OpeningConfig['method']) => {
    if (!onSave({ ...opening, method })) setError('설정을 저장하지 못했습니다.')
    else setError('')
  }
  return <><div className="opening-methods" role="group" aria-label="개방 방식">
    <button className={`opening-method ${opening.method === 'manual' ? 'selected' : ''}`} aria-pressed={opening.method === 'manual'} onClick={() => chooseMethod('manual')}><ToggleRight size={24} /><span><strong>수동으로 결정</strong><small>필요할 때 직접 열고 닫아요</small></span>{opening.method === 'manual' && <Check size={18} className="method-check" />}</button>
    <button className={`opening-method ${opening.method === 'schedule' ? 'selected' : ''}`} aria-pressed={opening.method === 'schedule'} onClick={() => chooseMethod('schedule')}><CalendarDays size={24} /><span><strong>요일별 시간표</strong><small>정해진 시간에 자동으로 열어요</small></span>{opening.method === 'schedule' && <Check size={18} className="method-check" />}</button>
    </div>
    {opening.method === 'manual' ? <div className="opening-manual-hint"><ToggleRight size={30} /><strong>관리자 화면의 개방 스위치로 열고 닫으세요.</strong><p>저장한 시간표는 그대로 보관돼요.</p></div> : <><p className="operation-help">열고 싶은 요일에 시간을 추가하세요. 시간이 없는 요일은 닫혀 있어요.</p><div className="week-schedule">{[1, 2, 3, 4, 5, 6, 0].map(day => <div className="weekday-row" key={day}><strong>{weekdays[day]}요일</strong><span>{opening.week[day].length ? opening.week[day].map(slot => `${slot.start}–${slot.end}`).join(' / ') : '닫힘'}</span><button className="admin-nav" aria-label={`${weekdays[day]}요일 ${opening.week[day].length ? '시간 수정' : '시간 추가'}`} onClick={() => setDay(day)}>{opening.week[day].length ? '수정' : '+ 시간 추가'}</button></div>)}</div><p className="opening-footnote">한국 시간 기준 · 회의·상담 등 다른 상태를 선택하면 시간표보다 우선해요.</p></>}
    {error && <p className="record-error" role="alert">{error}</p>}
    {day !== null && <DayEditor day={day} slots={opening.week[day]} onClose={() => setDay(null)} onSave={slots => onSave({ ...opening, week: opening.week.map((old, index) => index === day ? slots : old) })} />}
  </>
}
