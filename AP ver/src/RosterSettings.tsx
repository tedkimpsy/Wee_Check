import { useEffect, useState } from 'react'
import { Check, ChevronRight, FileSpreadsheet, Pencil, Plus, Save, Search, Trash2, Upload, UserMinus, Users } from 'lucide-react'
import { api } from './api'
import Modal from './Modal'
import { gradeCount, parseRoster, schoolTypes, type Roster, type RosterClass, type SchoolSettings, type SchoolType } from './roster'

type Props={settings:SchoolSettings;onSave:(settings:SchoolSettings)=>Promise<void>;onRosterChanged:(roster:Roster,details:RosterClass[])=>void;view?:'school'|'roster'|'import'}
type EditorState=
  | {kind:'add-class';name:string}
  | {kind:'rename-class';name:string}
  | {kind:'add-student';name:string}
  | {kind:'edit-student';id:string;name:string;grade:string;schoolClass:string}
  | {kind:'move-students';grade:string;schoolClass:string}
const rosterCount=(roster:Roster)=>Object.values(roster).reduce((sum,classes)=>sum+Object.values(classes).reduce((count,names)=>count+names.length,0),0)
const gradeNames=(type:SchoolType)=>Array.from({length:gradeCount(type)},(_,index)=>`${index+1}학년`)

export default function RosterSettings({settings,onSave,onRosterChanged,view='roster'}:Props) {
  const [schoolName,setSchoolName]=useState(settings.schoolName),[schoolType,setSchoolType]=useState<SchoolType>(settings.schoolType),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [grade,setGrade]=useState(gradeNames(settings.schoolType)[0]),[classId,setClassId]=useState(''),[search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([])
  const [bulkText,setBulkText]=useState(''),[bulkMode,setBulkMode]=useState<'append'|'replace'>('append'),[bulkPreview,setBulkPreview]=useState<any>(null),[fullText,setFullText]=useState(''),[fullPreview,setFullPreview]=useState<{roster:Roster;summary:any}|null>(null)
  const [editor,setEditor]=useState<EditorState|null>(null)
  const classes=(settings.rosterDetails||[]).filter(item=>item.grade===grade),current=classes.find(item=>item.id===classId)||classes[0],students=(current?.students||[]).filter(item=>item.name.includes(search.trim()))
  useEffect(()=>{setSchoolName(settings.schoolName);setSchoolType(settings.schoolType)},[settings.schoolName,settings.schoolType])
  useEffect(()=>{if(!gradeNames(settings.schoolType).includes(grade))setGrade(gradeNames(settings.schoolType)[0])},[settings.schoolType,grade])
  useEffect(()=>{if(current&&current.id!==classId)setClassId(current.id);if(!classes.length)setClassId('');setSelected([])},[grade,classId,current?.id,classes.length])
  useEffect(()=>{if(!message)return;const timer=window.setTimeout(()=>setMessage(''),4000);return()=>window.clearTimeout(timer)},[message])
  const run=async(action:()=>Promise<any>,success:string)=>{setBusy(true);setError('');setMessage('');try{const result=await action();if(result?.roster&&result?.rosterDetails)onRosterChanged(result.roster,result.rosterDetails);setMessage(success);return result}catch(reason){setError(reason instanceof Error?reason.message:'요청을 처리하지 못했습니다.');return null}finally{setBusy(false)}}
  if(view==='school')return <section className="admin-v3-card roster-settings"><header className="admin-v3-card-head"><h2>학교 정보</h2><span>학생 화면과 관리자 메뉴에 표시됩니다.</span></header><div className="admin-v3-form-grid"><label>학교급<select value={schoolType} onChange={event=>setSchoolType(event.target.value as SchoolType)}>{Object.entries(schoolTypes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>학교 이름<input type="text" value={schoolName} placeholder="예: 푸른마음초등학교" onChange={event=>setSchoolName(event.target.value)}/></label></div><p className="admin-v3-help">학교급을 바꿔도 기존 학생 기록은 보존됩니다.</p>{error&&<p className="admin-v3-form-error" role="alert">{error}</p>}{message&&<p className="admin-v3-form-success" role="status"><Check size={16}/>{message}</p>}<div className="admin-v3-form-actions"><button className="admin-v3-primary" disabled={busy||!schoolName.trim()} onClick={()=>void run(()=>onSave({...settings,schoolName:schoolName.trim(),schoolType}),'학교 정보를 저장했습니다.')}><Save size={17}/>{busy?'저장 중…':'학교 정보 저장'}</button></div></section>

  const addClass=()=>setEditor({kind:'add-class',name:'1반'})
  const renameClass=()=>{if(current)setEditor({kind:'rename-class',name:current.name})}
  const removeClass=async()=>{if(current&&confirm(`${grade} ${current.name}을 삭제할까요? 학생이 남아 있으면 삭제되지 않습니다.`))await run(()=>api.deleteClass(current.id),'학급을 삭제했습니다.')}
  const addStudent=()=>{if(current)setEditor({kind:'add-student',name:''})}
  const editStudent=(student:{id:string;name:string})=>{if(current)setEditor({kind:'edit-student',id:student.id,name:student.name,grade,schoolClass:current.name})}
  const removeSelected=async(ids=selected)=>{if(ids.length&&confirm(`선택한 ${ids.length}명을 활성 명렬표에서 제외할까요? 과거 기록은 보존됩니다.`)){await run(()=>api.removeStudents(ids),`${ids.length}명을 명렬표에서 제외했습니다.`);setSelected([])}}
  const moveSelected=()=>{if(selected.length)setEditor({kind:'move-students',grade,schoolClass:current?.name||''})}
  const submitEditor=async()=>{
    if(!editor)return
    let result:any=null
    if(editor.kind==='add-class')result=await run(()=>api.addClass({grade,name:editor.name.trim()}),`${grade} ${editor.name.trim()}을 추가했습니다.`)
    if(editor.kind==='rename-class'&&current)result=await run(()=>api.renameClass(current.id,editor.name.trim()),'학급 이름을 변경했습니다.')
    if(editor.kind==='add-student'&&current)result=await run(()=>api.addStudent({grade,schoolClass:current.name,name:editor.name.trim()}),'학생을 추가했습니다.')
    if(editor.kind==='edit-student')result=await run(()=>api.updateStudent(editor.id,{grade:editor.grade,schoolClass:editor.schoolClass,name:editor.name.trim()}),'학생 정보를 수정했습니다.')
    if(editor.kind==='move-students'){result=await run(()=>api.moveStudents(selected,editor.grade,editor.schoolClass),`${selected.length}명을 이동했습니다.`);if(result)setSelected([])}
    if(result)setEditor(null)
  }
  const classNames=()=>[...new Set(bulkText.split(/\r?\n|,/).map(value=>value.trim()).filter(Boolean))]
  const previewClass=async()=>{if(!current)return;const result=await run(()=>api.rosterBulkPreview({scope:'class',grade,schoolClass:current.name,names:classNames(),mode:bulkMode}),'학급 변경 내용을 확인해 주세요.');if(result)setBulkPreview(result)}
  const commitClass=async()=>{if(!current||!bulkPreview||!confirm(`추가 ${bulkPreview.added}명, 제외 ${bulkPreview.removed}명을 반영할까요?`))return;await run(()=>api.rosterBulkCommit({scope:'class',grade,schoolClass:current.name,names:classNames(),mode:bulkMode}),'학급 명렬표를 반영했습니다.');setBulkPreview(null);setBulkText('')}
  const previewFull=async()=>{try{const roster=parseRoster(fullText,settings.schoolType),summary=await api.rosterBulkPreview({scope:'all',roster});setFullPreview({roster,summary});setError('');setMessage('전체 교체 내용을 확인해 주세요.')}catch(reason){setFullPreview(null);setError(reason instanceof Error?reason.message:'입력 형식을 확인해 주세요.')}}
  const commitFull=async()=>{if(!fullPreview||!confirm(`전체 명렬표를 ${fullPreview.summary.total}명으로 교체할까요? 과거 기록은 보존됩니다.`))return;await run(()=>api.rosterBulkCommit({scope:'all',roster:fullPreview.roster}),'전체 명렬표를 교체했습니다.');setFullPreview(null);setFullText('')}
  if(view==='import')return <section className="admin-v3-card admin-v3-roster-import"><header className="admin-v3-card-head"><div><h2>전체 명렬표 교체</h2><p>새 학년도 명단처럼 학교 전체 학생을 한 번에 바꿀 때만 사용합니다.</p></div><span>현재 {rosterCount(settings.roster)}명</span></header><div className="admin-v3-roster-guide"><FileSpreadsheet size={22}/><p><strong>엑셀에서 학년·반·이름 세 열을 복사해 붙여 넣으세요.</strong><span>기존 명렬표와 비교한 뒤 확인할 때만 전체 교체됩니다. 과거 기록은 보존됩니다.</span></p></div><textarea value={fullText} placeholder={'학년\t반\t이름\n1\t1\t김서연'} onChange={event=>{setFullText(event.target.value);setFullPreview(null)}}/><div className="admin-v3-form-actions split"><button className="admin-v3-secondary" onClick={()=>{const rows=Object.entries(settings.roster).flatMap(([g,cs])=>Object.entries(cs).flatMap(([c,names])=>names.map(name=>`${g.replace('학년','')}\t${c.replace('반','')}\t${name}`)));setFullText(`학년\t반\t이름\n${rows.join('\n')}`)}}>현재 명렬표 불러오기</button><button className="admin-v3-primary" disabled={!fullText.trim()} onClick={()=>void previewFull()}><Upload size={17}/> 변경 인원 미리보기</button></div>{fullPreview&&<div className="admin-v3-diff"><span>추가 <strong>{fullPreview.summary.added}</strong></span><span>유지 <strong>{fullPreview.summary.kept}</strong></span><span>제외 <strong>{fullPreview.summary.removed}</strong></span><button className="admin-v3-primary" disabled={busy} onClick={()=>void commitFull()}>전체 교체</button></div>}{error&&<p className="admin-v3-form-error" role="alert">{error}</p>}{message&&<p className="admin-v3-form-success" role="status"><Check size={16}/>{message}</p>}</section>
  const editorTitle=editor?.kind==='add-class'?`${grade} 학급 추가`:editor?.kind==='rename-class'?'학급 이름 수정':editor?.kind==='add-student'?`${grade} ${current?.name} 학생 추가`:editor?.kind==='edit-student'?'학생 정보 수정':'선택 학생 이동'
  const editorClasses=editor&&'grade'in editor?(settings.rosterDetails||[]).filter(item=>item.grade===editor.grade):[]
  return <>
    <div className="admin-v3-roster-manager">
      <section className="admin-v3-roster-nav">
        <header><div><strong>학년·학급</strong><small>학급을 선택해 학생을 관리합니다.</small></div><button className="admin-v3-icon" aria-label="학급 추가" onClick={addClass}><Plus size={18}/></button></header>
        <div className="admin-v3-grade-tabs">{gradeNames(settings.schoolType).map(item=><button key={item} className={grade===item?'active':''} onClick={()=>setGrade(item)}>{item}</button>)}</div>
        <div className="admin-v3-class-list">{classes.map(item=><button key={item.id} className={current?.id===item.id?'active':''} onClick={()=>setClassId(item.id)}><span><strong>{item.name}</strong><small>{item.students.length}명</small></span><ChevronRight size={17}/></button>)}{!classes.length&&<p>등록된 학급이 없습니다.</p>}</div>
      </section>
      <section className="admin-v3-card admin-v3-roster-main">
        <header className="admin-v3-roster-title"><div><h2>{current?`${grade} ${current.name}`:`${grade} 학급 없음`}</h2><p>{current?`학생 ${current.students.length}명`:'학급을 먼저 추가해 주세요.'}</p></div>{current&&<><label className="admin-v3-roster-search"><Search size={17}/><input aria-label="학생 이름 검색" placeholder="학생 이름 검색" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="admin-v3-roster-actions"><button className="admin-v3-secondary" onClick={renameClass}><Pencil size={16}/> 학급명 수정</button><button className="admin-v3-danger-link" onClick={()=>void removeClass()}><Trash2 size={16}/> 학급 삭제</button><button className="admin-v3-primary" onClick={addStudent}><Plus size={17}/> 학생 추가</button></div></>}</header>
        {current&&<>
          {selected.length>0&&<div className="admin-v3-selection-bar"><strong>{selected.length}명 선택</strong><button onClick={moveSelected}>다른 반으로 이동</button><button onClick={()=>void removeSelected()}><UserMinus size={16}/> 명렬표에서 제외</button></div>}
          <div className="admin-v3-student-list"><div className="head"><input type="checkbox" aria-label="전체 학생 선택" checked={students.length>0&&students.every(item=>selected.includes(item.id))} onChange={event=>setSelected(event.target.checked?students.map(item=>item.id):[])}/><span>학생 이름</span><span>관리</span></div>{students.map(student=><div key={student.id}><input type="checkbox" aria-label={`${student.name} 선택`} checked={selected.includes(student.id)} onChange={event=>setSelected(event.target.checked?[...selected,student.id]:selected.filter(id=>id!==student.id))}/><span><i>{student.name.slice(0,1)}</i><strong>{student.name}</strong></span><div><button className="admin-v3-icon" aria-label={`${student.name} 수정`} onClick={()=>editStudent(student)}><Pencil size={16}/></button><button className="admin-v3-icon danger" aria-label={`${student.name} 제외`} onClick={()=>void removeSelected([student.id])}><UserMinus size={16}/></button></div></div>)}{!students.length&&<div className="admin-v3-roster-empty"><Users size={24}/><strong>{search?'검색 결과가 없습니다.':'아직 등록된 학생이 없습니다.'}</strong><span>{search?'검색어를 바꾸거나 지워 주세요.':'위의 학생 추가 또는 아래 여러 명 등록을 이용해 주세요.'}</span></div>}</div>
          <details className="admin-v3-bulk"><summary><Users size={19}/><span><strong>여러 학생 한 번에 등록</strong><small>이 학급에 이름 목록을 붙여 넣어 추가하거나 명단을 교체합니다.</small></span></summary><p>학생 이름을 한 줄에 한 명씩 입력한 뒤 추가 또는 교체 방식을 선택하세요.</p><textarea value={bulkText} placeholder={'김서연\n박도윤\n이하늘'} onChange={event=>{setBulkText(event.target.value);setBulkPreview(null)}}/><div className="admin-v3-inline"><label><input type="radio" checked={bulkMode==='append'} onChange={()=>setBulkMode('append')}/> 현재 학생은 유지하고 추가</label><label><input type="radio" checked={bulkMode==='replace'} onChange={()=>setBulkMode('replace')}/> 입력한 이름으로 이 학급 교체</label><button className="admin-v3-secondary" disabled={!bulkText.trim()} onClick={()=>void previewClass()}><Upload size={16}/> 변경 인원 미리보기</button></div>{bulkPreview&&<div className="admin-v3-diff"><span>추가 <strong>{bulkPreview.added}</strong></span><span>유지 <strong>{bulkPreview.kept}</strong></span><span>제외 <strong>{bulkPreview.removed}</strong></span><button className="admin-v3-primary" onClick={()=>void commitClass()}>변경 반영</button></div>}</details>
        </>}
        {error&&<p className="admin-v3-form-error" role="alert">{error}</p>}{message&&<p className="admin-v3-form-success" role="status"><Check size={16}/>{message}</p>}
      </section>
    </div>
    {editor&&<Modal size="compact" title={editorTitle} onClose={()=>setEditor(null)}><form className="admin-v3-roster-modal" onSubmit={event=>{event.preventDefault();void submitEditor()}}>
      {(editor.kind==='add-class'||editor.kind==='rename-class'||editor.kind==='add-student'||editor.kind==='edit-student')&&<label>{editor.kind.includes('class')?'학급 이름':'학생 이름'}<input autoFocus value={editor.name} placeholder={editor.kind.includes('class')?'예: 1반':'학생 이름'} onChange={event=>setEditor({...editor,name:event.target.value})}/></label>}
      {(editor.kind==='edit-student'||editor.kind==='move-students')&&<div className="admin-v3-form-grid"><label>학년<select value={editor.grade} onChange={event=>{const nextGrade=event.target.value,nextClass=(settings.rosterDetails||[]).find(item=>item.grade===nextGrade)?.name||'';setEditor({...editor,grade:nextGrade,schoolClass:nextClass})}}>{gradeNames(settings.schoolType).map(item=><option key={item}>{item}</option>)}</select></label><label>학급<select value={editor.schoolClass} onChange={event=>setEditor({...editor,schoolClass:event.target.value})}>{editorClasses.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label></div>}
      <p className="admin-v3-modal-help">{editor.kind==='add-class'?`${grade}에 새 학급을 만듭니다.`:editor.kind==='rename-class'?'학생과 기존 기록의 학급 연결은 그대로 유지됩니다.':editor.kind==='add-student'?`${grade} ${current?.name} 명렬표에 학생을 추가합니다.`:editor.kind==='edit-student'?'이름과 소속을 함께 수정할 수 있으며 과거 기록은 유지됩니다.':`선택한 ${selected.length}명을 지정한 학급으로 이동합니다.`}</p>
      <div className="admin-v3-form-actions"><button type="button" className="admin-v3-secondary" onClick={()=>setEditor(null)}>취소</button><button className="admin-v3-primary" disabled={busy||('name'in editor&&!editor.name.trim())||('schoolClass'in editor&&!editor.schoolClass)}>{busy?'처리 중…':editor.kind==='add-class'||editor.kind==='add-student'?'추가':'저장'}</button></div>
    </form></Modal>}
  </>
}
