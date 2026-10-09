import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BUSINESS_NAME } from '../constants/business'
import './Header.css'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/refund', label: 'Refund' },
  { to: '/contact', label: 'Contact' },
]

function Header() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark">H</span>
          {BUSINESS_NAME}
        </NavLink>

        <nav className={`site-nav ${open ? 'is-open' : ''}`}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `site-nav-link ${isActive ? 'is-active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  )
}

export default Header
