'use client'

import { tapFeedback } from '@/lib/haptics'

export default function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        tapFeedback()
        onChange(!checked)
      }}
      className="qari-switch ed-focus"
    >
      <span className="qari-switch__knob" aria-hidden />
    </button>
  )
}
