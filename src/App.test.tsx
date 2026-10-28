import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('builds a plan on first load and lets you toggle days', () => {
    localStorage.clear()
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/gün izinle \d+ gün tatil/)
    expect(screen.getByText(/en iyi köprüleri/)).toBeInTheDocument()

    const before = screen.getByRole('heading', { level: 1 }).textContent
    fireEvent.click(screen.getByText('Temizle'))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/0 gün izinle 0 gün tatil/)

    // pick the first suggestion
    const picks = screen.getByText(/en iyi köprüleri/).closest('section')!
    fireEvent.click(within(picks).getAllByText('Ekle')[0])
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/0 gün izinle 0 gün/)

    fireEvent.click(screen.getByText('Bana en iyi planı yap'))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(before)
  })

  it('switches strategy and keeps breaks long', () => {
    localStorage.clear()
    render(<App />)
    fireEvent.click(screen.getByText('Uzun tatiller'))
    const plan = screen.getByText('Planın').closest('section')!
    const lengths = within(plan)
      .getAllByText(/^\d+ gün$/)
      .map((el) => parseInt(el.textContent!))
    expect(lengths.length).toBeGreaterThan(0)
    for (const n of lengths) expect(n).toBeGreaterThanOrEqual(9)
  })
})
