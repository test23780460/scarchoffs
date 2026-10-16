import { useEffect, useState } from 'react'
import { cents } from '../lib'

/** Keep the user's decimal text intact while storing money as integer cents. */
export function MoneyInput({
  value,
  onChange,
  required = false,
  disabled = false,
  label,
}: {
  value: number
  onChange: (value: number) => void
  required?: boolean
  disabled?: boolean
  label?: string
}) {
  const [text, setText] = useState(value ? String(value / 100) : '')
  useEffect(() => {
    setText((current) => (cents(current) === value ? current : value ? String(value / 100) : ''))
  }, [value])
  return (
    <span className={`money-input ${disabled ? 'is-disabled' : ''}`}>
      <b aria-hidden="true">$</b>
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        min="0"
        max="1000000000"
        step="0.01"
        placeholder="0.00"
        value={text}
        required={required}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value)
          onChange(cents(event.target.value))
        }}
      />
    </span>
  )
}
