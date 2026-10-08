import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { api } from './api'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className="login-page"><form className="login-card" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await api.login(password); onLogin() } catch (e) { setError(e instanceof Error ? e.message : '로그인하지 못했습니다.') } finally { setBusy(false) } }}>
    <span className="login-icon"><LockKeyhole /></span><p className="eyebrow">Wee Check 관리자</p><h1>관리자 로그인</h1><p>이 화면은 관리자 PC에서만 열립니다.</p>
    <label>비밀번호<input autoFocus type="password" inputMode="numeric" value={password} onChange={event => setPassword(event.target.value)} /></label>
    {error && <p className="record-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
  </form></main>
}
