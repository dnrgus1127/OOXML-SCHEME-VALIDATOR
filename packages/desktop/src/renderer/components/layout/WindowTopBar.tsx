import type { ReactNode } from 'react'

interface WindowTopBarProps {
  leading?: ReactNode
  center?: ReactNode
  trailing?: ReactNode
  className?: string
}

export function WindowTopBar({ leading, center, trailing, className }: WindowTopBarProps) {
  const rootClassName = className ? `window-topbar ${className}` : 'window-topbar'

  return (
    <header className={rootClassName}>
      <div className="window-topbar-leading">{leading}</div>
      <div className="window-topbar-center">{center}</div>
      <div className="window-topbar-trailing">{trailing}</div>
    </header>
  )
}
