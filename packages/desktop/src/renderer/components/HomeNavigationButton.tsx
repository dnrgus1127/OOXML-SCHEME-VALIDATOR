interface HomeNavigationButtonProps {
  onNavigateHome: () => void
}

export function HomeNavigationButton({ onNavigateHome }: HomeNavigationButtonProps) {
  return (
    <button onClick={onNavigateHome} className="toolbar-btn" aria-label="Go to home screen">
      🏠 Home
    </button>
  )
}
