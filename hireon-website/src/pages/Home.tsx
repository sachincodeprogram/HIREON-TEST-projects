import { Link } from 'react-router-dom'
import {
  IconBike,
  IconCheckCircle,
  IconHeadset,
  IconLock,
  IconMail,
  IconMapPin,
  IconPackage,
  IconPhone,
  IconShield,
  IconTag,
  IconZap,
} from '../components/Icons'
import { BUSINESS_NAME, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from '../constants/business'
import './Home.css'

const FEATURES = [
  {
    icon: IconMapPin,
    title: 'Real-Time Tracking',
    desc: 'Watch your rider move live on the map from pickup to drop, every step of the way.',
  },
  {
    icon: IconShield,
    title: 'Verified Riders',
    desc: 'Every rider on HIREON is background-checked and identity-verified before going live.',
  },
  {
    icon: IconLock,
    title: 'OTP-Secured Handoff',
    desc: 'Pickup and delivery are confirmed with a one-time OTP, so your parcel changes hands safely.',
  },
  {
    icon: IconZap,
    title: 'Instant Booking',
    desc: 'Book a rider in seconds — no waiting, no phone calls, just enter pickup and drop.',
  },
  {
    icon: IconTag,
    title: 'Transparent Pricing',
    desc: 'Know the exact fare upfront based on distance, with no hidden charges added later.',
  },
  {
    icon: IconHeadset,
    title: '24/7 Support',
    desc: 'Our support team is on standby around the clock for any delivery you place.',
  },
]

const STEPS = [
  {
    icon: IconPackage,
    title: 'Book a Pickup',
    desc: 'Enter your pickup and drop location, add a few parcel details, and confirm your order.',
  },
  {
    icon: IconBike,
    title: 'Rider Assigned',
    desc: 'The nearest available rider is notified and accepts your delivery request instantly.',
  },
  {
    icon: IconMapPin,
    title: 'Track Live',
    desc: 'Follow your rider on the live map from pickup all the way to your drop location.',
  },
  {
    icon: IconCheckCircle,
    title: 'OTP Confirmation',
    desc: 'A secure OTP confirms pickup and delivery, so you always know your parcel is safe.',
  },
]

function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Parcel Delivery, Simplified</span>
            <h1>Send anything, anywhere — in minutes.</h1>
            <p className="hero-sub">
              {BUSINESS_NAME} connects you with verified riders nearby, so you can book a pickup,
              track the delivery live, and confirm handoff with an OTP — all from one app.
            </p>
            <div className="hero-cta">
              <Link to="/contact" className="btn btn-primary">Get Started</Link>
              <a href="#how-it-works" className="btn btn-outline">See How It Works</a>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-card hero-card-main">
              <IconPackage className="hero-card-icon" />
              <div>
                <strong>Order #HR-4821</strong>
                <span>Out for delivery</span>
              </div>
            </div>
            <div className="hero-card hero-card-float">
              <IconBike className="hero-card-icon" />
              <div>
                <strong>Rider en route</strong>
                <span>4 min away</span>
              </div>
            </div>
            <div className="hero-blob" />
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why HIREON</span>
            <h2>Everything you need for a reliable delivery</h2>
          </div>

          <div className="features-grid">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div className="feature-card" key={title}>
                <div className="feature-icon"><Icon /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="how-it-works" id="how-it-works">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How It Works</span>
            <h2>From booking to delivery in four simple steps</h2>
          </div>

          <div className="steps">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div className="step-card" key={title}>
                <div className="step-number">{String(i + 1).padStart(2, '0')}</div>
                <div className="step-icon"><Icon /></div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-contact">
        <div className="container home-contact-inner">
          <div>
            <span className="eyebrow">Get In Touch</span>
            <h2>Questions about a delivery, or want to partner with us?</h2>
            <p className="hero-sub">
              Reach out any time — our team typically responds within one business day.
            </p>
          </div>

          <div className="home-contact-links">
            <a href={`mailto:${CONTACT_EMAIL}`} className="contact-pill">
              <IconMail /> {CONTACT_EMAIL}
            </a>
            <a href={`tel:${CONTACT_PHONE_TEL}`} className="contact-pill">
              <IconPhone /> {CONTACT_PHONE_DISPLAY}
            </a>
            <Link to="/contact" className="btn btn-primary">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  )
}

export default Home
