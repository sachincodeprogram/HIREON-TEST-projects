import { type FormEvent, useState } from 'react'
import { IconMail, IconPhone, IconHeadset, IconCheckCircle } from '../components/Icons'
import {
  BUSINESS_NAME,
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  LEGAL_ENTITY_LINE,
  OPERATING_COUNTRY,
} from '../constants/business'
import './Contact.css'

function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(`Message from ${name || 'HIREON website visitor'}`)
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
    setSent(true)
  }

  return (
    <section className="contact-page">
      <div className="container contact-header">
        <span className="eyebrow">Contact Us</span>
        <h1>We'd love to hear from you</h1>
        <p className="hero-sub">
          Questions about an order, partnership enquiries, or feedback — reach out and the {BUSINESS_NAME} team
          will get back to you.
        </p>
      </div>

      <div className="container contact-grid">
        <div className="contact-cards">
          <div className="contact-card">
            <div className="contact-card-icon"><IconMail /></div>
            <div>
              <h3>Email</h3>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </div>
          </div>

          <div className="contact-card">
            <div className="contact-card-icon"><IconPhone /></div>
            <div>
              <h3>Phone</h3>
              <a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a>
            </div>
          </div>

          <div className="contact-card">
            <div className="contact-card-icon"><IconHeadset /></div>
            <div>
              <h3>Support Hours</h3>
              <p>Everyday, 9:00 AM – 9:00 PM ({OPERATING_COUNTRY} Standard Time)</p>
            </div>
          </div>

          <p className="contact-legal">{LEGAL_ENTITY_LINE} &middot; {OPERATING_COUNTRY}</p>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <h2>Send us a message</h2>

          <label>
            Your Name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </label>

          <label>
            Your Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Message
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
            />
          </label>

          <button type="submit" className="btn btn-primary">Send Message</button>

          {sent && (
            <p className="contact-sent">
              <span>Opening your email app to send this message to {CONTACT_EMAIL}...</span>
              <IconCheckCircle className="contact-sent-icon" />
            </p>
          )}
        </form>
      </div>
    </section>
  )
}

export default Contact
