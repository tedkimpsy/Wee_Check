import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
export default function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus() } }, [])
  return <dialog ref={ref} className="admin-modal" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}><header className="modal-header"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X /></button></header><div className="modal-body">{children}</div></dialog>
}
