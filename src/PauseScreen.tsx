import { Heart, Clock3, BookOpen, BriefcaseBusiness, Utensils, Coffee } from 'lucide-react'
import { operationModes, type OperationMode } from './operation'

const copy = {
    class: { title: '지금은 수업 중이에요', description: '선생님이 학생들과 함께 수업하고 있어요.', instruction: '지금은 들어갈 수 없어요.\n수업이 끝나면 다시 찾아와 주세요.', thanks: '수업 시간을 배려해 줘서 고마워요!' },
    trip: { title: '선생님은 지금 출장 중이에요', description: '선생님이 학교 밖에서 일을 보고 있어요.', instruction: '지금은 들어갈 수 없어요.\n선생님이 돌아오면 다시 찾아와 주세요.', thanks: '기다려 줘서 고마워요!' },
    meal: { title: '지금은 식사 중이에요', description: '선생님이 식사하며 잠시 쉬고 있어요.', instruction: '지금은 들어갈 수 없어요.\n식사가 끝나면 다시 찾아와 주세요.', thanks: '조금 뒤에 다시 만나요!' },
    away: { title: '선생님이 잠시 자리를 비웠어요', description: '지금은 Wee클래스가 쉬고 있어요.', instruction: '지금은 들어갈 수 없어요.\n선생님이 돌아오면 다시 찾아와 주세요.', thanks: '기다려 줘서 고마워요!' },
    closed: { title: '지금은 Wee클래스가 쉬고 있어요', description: '편하게 쉬고 놀 수 있는 시간에 다시 만나요.', instruction: '지금은 들어갈 수 없어요.\nWee클래스가 열리면 다시 찾아와 주세요.', thanks: '기다려 줘서 고마워요!' },
    meeting: { title: '지금은 회의 중이에요', description: '선생님들이 함께 이야기를 나누고 있어요.', instruction: '지금은 들어갈 수 없어요.\n회의가 끝나면 다시 찾아와 주세요.', thanks: '기다려 줘서 고마워요!' },
    counseling: { title: '지금은 상담 중이에요', description: '선생님이 친구의 이야기를 듣고 있어요.', instruction: '지금은 들어갈 수 없어요.\n상담이 끝나면 다시 찾아와 주세요.', thanks: '친구가 편하게 이야기할 수 있도록 도와줘서 고마워요!' },
}

function PauseIllustration({ counseling }: { counseling: boolean }) {
  return <svg className="pause-illustration" viewBox="0 0 320 230" fill="none" aria-hidden="true">
    <circle cx="160" cy="115" r="102" fill="var(--pause-soft)" />
    <circle cx="46" cy="61" r="6" fill="var(--pause-accent)" opacity=".35" /><circle cx="283" cy="165" r="9" fill="var(--pause-accent)" opacity=".25" />
    <path d="M66 204H258" stroke="var(--pause-accent)" strokeWidth="5" strokeLinecap="round" opacity=".2" />
    <rect x="83" y="35" width="154" height="79" rx="23" fill="white" stroke="var(--pause-accent)" strokeWidth="3" />
    <path d="M117 113L109 129L142 114" fill="white" stroke="var(--pause-accent)" strokeWidth="3" strokeLinejoin="round" />
    {counseling ? <path d="M160 90C152 83 135 73 135 62C135 48 152 45 160 56C168 45 185 48 185 62C185 73 168 83 160 90Z" fill="var(--pause-accent)" opacity=".75" /> : <g fill="var(--pause-accent)"><circle cx="134" cy="75" r="6" /><circle cx="160" cy="75" r="6" /><circle cx="186" cy="75" r="6" /></g>}
    <circle cx="104" cy="145" r="19" fill="var(--pause-accent)" opacity=".8" /><path d="M71 197C71 164 137 164 137 197" fill="var(--pause-accent)" opacity=".65" />
    <circle cx="216" cy="145" r="19" fill="var(--pause-accent)" opacity=".6" /><path d="M183 197C183 164 249 164 249 197" fill="var(--pause-accent)" opacity=".45" />
    <rect x="116" y="175" width="88" height="12" rx="6" fill="white" /><path d="M129 187V203M191 187V203" stroke="var(--pause-accent)" strokeWidth="5" strokeLinecap="round" />
  </svg>
}

export default function PauseScreen({ mode }: { mode: Exclude<OperationMode, 'open'> }) {
  const text = copy[mode]
  const Icon = mode === 'class' ? BookOpen : mode === 'trip' ? BriefcaseBusiness : mode === 'meal' ? Utensils : mode === 'away' ? Coffee : null
  return <section className={`pause-screen ${mode}`} aria-labelledby="pause-title">
    <div className="pause-content" role="status">
      <div className="pause-badge"><Clock3 size={17} />{mode === 'closed' ? '쉬는 시간' : operationModes[mode].label}</div>
      {Icon ? <div className="pause-illustration pause-mode-icon" aria-hidden="true"><Icon strokeWidth={1.3} /></div> : <PauseIllustration counseling={mode === 'counseling'} />}
      <h1 id="pause-title">{text.title}</h1>
      <p className="pause-description">{text.description}</p>
      <div className="pause-instruction">{text.instruction}</div>
      <p className="pause-thanks"><Heart size={18} />{text.thanks}</p>
    </div>
  </section>
}
