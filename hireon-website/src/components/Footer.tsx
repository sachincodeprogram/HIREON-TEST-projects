import { Link } from 'react-router-dom'
import {
  BUSINESS_NAME,
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  LEGAL_ENTITY_LINE,
} from '../constants/business'
import './Footer.css'

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <div className="footer-brand">
            <span className="brand-mark">H</span>
            {BUSINESS_NAME}
          </div>
          <p>Fast, reliable parcel delivery — book a rider and track your delivery live, from pickup to drop.</p>
        </div>

        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><Link to="/terms">Terms &amp; Conditions</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/refund">Refund &amp; Cancellation</Link></li>
            <li><Link to="/delete-account">Delete Account</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Get in Touch</h4>
          <ul>
            <li><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
            <li><a href={`tel:${CONTACT_PHONE_TEL}`}>{CONTACT_PHONE_DISPLAY}</a></li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>&copy; {year} {LEGAL_ENTITY_LINE}. All rights reserved.</p>
      </div>
    </footer>
  )
}

export default Footer
