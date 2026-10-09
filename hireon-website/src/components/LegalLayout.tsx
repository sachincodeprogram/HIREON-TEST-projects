import type { ReactNode } from 'react'
import './LegalLayout.css'

type LegalLayoutProps = {
  title: string
  updated: string
  children: ReactNode
}

function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  return (
    <section className="legal">
      <div className="container legal-container">
        <header className="legal-header">
          <h1>{title}</h1>
          <p className="legal-updated">Last updated: {updated}</p>
        </header>
        <div className="legal-body">{children}</div>
      </div>
    </section>
  )
}

export default LegalLayout
