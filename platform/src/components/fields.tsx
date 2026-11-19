import { useId, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode, TextareaHTMLAttributes } from 'react'
import { flushSync } from 'react-dom'
import { LIMITS } from '../story/validate'

/**
 * The fields the sender writes in, shared by the detailed form and the editor
 * under the film.
 */

export const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ')

/** A one-line field that grows instead of cutting long sentences off. */
export function GrowingText({ inputRef, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { inputRef?: (el: HTMLTextAreaElement | null) => void }) {
  const own = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = own.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
  }, [props.value])
  return (
    <textarea
      rows={1}
      className="grow"
      ref={(el) => {
        own.current = el
        inputRef?.(el)
      }}
      {...props}
    />
  )
}

export function Cross() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  )
}

/** A list written one line at a time: Enter moves down or adds a line, Backspace on an empty line removes it. */
export function ListEditor({
  label,
  values,
  max,
  onChange,
  onActive,
}: {
  label: string
  values: string[]
  max: number
  onChange: (values: string[]) => void
  onActive: (index: number) => void
}) {
  const rows = useRef<Array<HTMLTextAreaElement | null>>([])
  // Focus moves in the same tick, so fast typing after Enter lands in the new row.
  const focusRow = (i: number) => rows.current[i]?.focus()
  const addRow = () => {
    flushSync(() => onChange([...values, '']))
    focusRow(values.length)
  }
  const canAdd = values.length < max

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    if (event.key === 'Enter') {
      // Enter moves down the list instead of leaving the step.
      event.preventDefault()
      if (i < values.length - 1) focusRow(i + 1)
      else if (canAdd && values[i].trim()) addRow()
    } else if (event.key === 'Backspace' && !values[i] && values.length > 1) {
      event.preventDefault()
      flushSync(() => onChange(values.filter((_, n) => n !== i)))
      focusRow(Math.max(0, i - 1))
    }
  }

  return (
    <div className="list-editor">
      <ol>
        {values.map((value, i) => (
          <li key={i} className="list-row">
            <span className="row-n" aria-hidden="true">
              {i + 1}
            </span>
            <GrowingText
              inputRef={(el) => {
                rows.current[i] = el
              }}
              aria-label={`${label} ${i + 1}`}
              value={value}
              maxLength={LIMITS.listItem}
              enterKeyHint="next"
              onFocus={() => onActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              onChange={(e) => {
                onActive(i)
                onChange(values.map((v, n) => (n === i ? oneLine(e.target.value) : v)))
              }}
            />
            {values.length > 1 && (
              <button type="button" className="icon-remove" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(values.filter((_, n) => n !== i))}>
                <Cross />
              </button>
            )}
          </li>
        ))}
      </ol>
      {canAdd && (
        <button type="button" className="text-button" onClick={addRow}>
          Add another
        </button>
      )}
    </div>
  )
}
