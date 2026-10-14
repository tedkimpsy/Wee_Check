const token = () => location.hash.match(/^#\/s\/([^/]+)/)?.[1] || ''
async function json<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const studentToken = token()
  if (studentToken && url.startsWith('/api/student')) headers.set('Authorization', `Bearer ${studentToken}`)
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body.error || '요청을 처리하지 못했습니다.'), body, { status: response.status })
  return body
}

export const api = {
  studentToken: token,
  studentEventsUrl: () => `/api/student/events?token=${encodeURIComponent(token())}`,
  studentOperation: () => json<any>('/api/student/operation'),
  studentBootstrap: () => json<any>('/api/student/bootstrap'),
  attendance: (body: unknown) => json<any>('/api/student/attendance', { method: 'POST', body: JSON.stringify(body) }),
  capacity: () => json<any>('/api/student/capacity'),
  joinWaitlist: (body: unknown) => json<any>('/api/student/waitlist', { method: 'POST', body: JSON.stringify(body) }),
  waitlistStatus: (ticket: string) => json<any>(`/api/student/waitlist/${encodeURIComponent(ticket)}`),
  cancelWaitlist: (ticket: string) => json(`/api/student/waitlist/${encodeURIComponent(ticket)}`, { method: 'DELETE' }),
  counseling: (body: unknown) => json<any>('/api/student/counseling', { method: 'POST', body: JSON.stringify(body) }),
  login: (password: string) => json('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => json('/api/admin/logout', { method: 'POST' }),
  adminBootstrap: () => json<any>('/api/admin/bootstrap'),
  saveSchool: (body: unknown) => json<any>('/api/admin/school', { method: 'PUT', body: JSON.stringify(body) }),
  saveOperation: (body: unknown) => json('/api/admin/operation', { method: 'PUT', body: JSON.stringify(body) }),
  addClass: (body: unknown) => json<any>('/api/admin/roster/classes', { method: 'POST', body: JSON.stringify(body) }),
  renameClass: (id: string, name: string) => json<any>(`/api/admin/roster/classes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteClass: (id: string) => json<any>(`/api/admin/roster/classes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addStudent: (body: unknown) => json<any>('/api/admin/roster/students', { method: 'POST', body: JSON.stringify(body) }),
  updateStudent: (id: string, body: unknown) => json<any>(`/api/admin/roster/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeStudents: (ids: string[]) => json<any>('/api/admin/roster/students/remove', { method: 'POST', body: JSON.stringify({ ids }) }),
  moveStudents: (ids: string[], grade: string, schoolClass: string) => json<any>('/api/admin/roster/students/move', { method: 'POST', body: JSON.stringify({ ids, grade, schoolClass }) }),
  rosterBulkPreview: (body: unknown) => json<any>('/api/admin/roster/bulk/preview', { method: 'POST', body: JSON.stringify(body) }),
  rosterBulkCommit: (body: unknown) => json<any>('/api/admin/roster/bulk/commit', { method: 'POST', body: JSON.stringify(body) }),
  waitlistAdmin: () => json<any>('/api/admin/waitlist'),
  cancelWaitlistAdmin: (id: string) => json(`/api/admin/waitlist/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  advanceWaitlistAdmin: (id: string) => json(`/api/admin/waitlist/${encodeURIComponent(id)}/advance`, { method: 'POST' }),
  completeRequest: (id: string) => json(`/api/admin/counseling/${id}/complete`, { method: 'POST' }),
  startAccess: () => json<any>('/api/admin/access/start', { method: 'POST' }),
  stopAccess: () => json('/api/admin/access/stop', { method: 'POST' }),
  backup: () => json<any>('/api/admin/backup', { method: 'POST' }),
  backups: () => json<any>('/api/admin/backups'),
  restore: (name: string) => json<any>(`/api/admin/backups/${encodeURIComponent(name)}/restore`, { method: 'POST' }),
  closeAcademicYear: () => json<any>('/api/admin/academic-year/close', { method: 'POST' }),
  changePassword: (password: string) => json('/api/admin/password', { method: 'PUT', body: JSON.stringify({ password }) }),
}
