import { useEffect, useRef, useState, type ReactNode } from 'react'

export type MenuItem = {
  id: string
  label: string
  onClick: () => void
  active?: boolean
}

type MenuDropdownProps = {
  label: string
  items: MenuItem[]
  disabled?: boolean
  icon?: ReactNode
  active?: boolean
}

export function MenuDropdown({ label, items, disabled, icon, active }: MenuDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`menu-dropdown ${open ? 'open' : ''} ${active ? 'active' : ''}`}>
      <button
        type="button"
        className="topbar-btn"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
      >
        {icon}
        <span>{label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="menu-dropdown-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`menu-dropdown-item ${item.active ? 'selected' : ''}`}
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
