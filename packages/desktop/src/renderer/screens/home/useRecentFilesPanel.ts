import { useState } from 'react'

export function useRecentFilesPanel(defaultOpen = true) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const toggle = () => {
    setIsOpen((prev) => !prev)
  }

  return {
    isOpen,
    toggle,
    contentId: 'home-recent-files-list',
  }
}
