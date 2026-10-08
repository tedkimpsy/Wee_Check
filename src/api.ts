const token = () => location.hash.match(/^#\/s\/([^/]+)/)?.[1] || ''
async function json<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const studentToken = token()
  if (studentToken && url.startsWith('/api/student')) headers.set('Authorization', `Bearer ${studentToken}`)
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body.error || '요청을 처리하지 못했습니다.'), { status: response.status })
  return body
}

export const api = {
  studentToken: token,
  studentBootstrap: () => json<any>('/api/student/bootstrap'),
  attendance: (body: unknown) => json<any>('/api/student/attendance', { method: 'POST', body: JSON.stringify(body) }),
  counseling: (body: unknown) => json<any>('/api/student/counseling', { method: 'POST', body: JSON.stringify(body) }),
  login: (password: string) => json('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => json('/api/admin/logout', { method: 'POST' }),
  adminBootstrap: () => json<any>('/api/admin/bootstrap'),
  saveSchool: (body: unknown) => json<any>('/api/admin/school', { method: 'PUT', body: JSON.stringify(body) }),
  saveOperation: (body: unknown) => json('/api/admin/operation', { method: 'PUT', body: JSON.stringify(body) }),
  completeRequest: (id: string) => json(`/api/admin/counseling/${id}/complete`, { method: 'POST' }),
  startAccess: () => json<any>('/api/admin/access/start', { method: 'POST' }),
  stopAccess: () => json('/api/admin/access/stop', { method: 'POST' }),
  backup: () => json<any>('/api/admin/backup', { method: 'POST' }),
  backups: () => json<any>('/api/admin/backups'),
  restore: (name: string) => json<any>(`/api/admin/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' }),
  closeAcademicYear: () => json<any>('/api/admin/academic-year/close', { method: 'POST' }),
  changePassword: (password: string) => json('/api/admin/password', { method: 'PUT', body: JSON.stringify({ password }) }),
}
