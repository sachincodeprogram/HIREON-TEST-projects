import LegalLayout from '../components/LegalLayout'
import { BUSINESS_NAME, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, LEGAL_ENTITY_LINE } from '../constants/business'

function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 4, 2026">
      <p>
        {LEGAL_ENTITY_LINE} ("{BUSINESS_NAME}", "we", "us", "our") operates the {BUSINESS_NAME} mobile
        application and website (the "Platform"). This Privacy Policy explains what information we collect,
        how we use it, and the choices you have. By using the Platform, you consent to the practices described
        here.
      </p>

      <h2>1. Information We Collect</h2>
      <p><strong>Information you provide:</strong></p>
      <ul>
        <li>Name, mobile number, and email address provided during signup</li>
        <li>Pickup and drop addresses, recipient details, and parcel information entered for a booking</li>
        <li>Rider verification documents (for Rider accounts), such as ID proof and vehicle details</li>
        <li>Messages or information you share with our support team</li>
      </ul>
      <p><strong>Information collected automatically:</strong></p>
      <ul>
        <li>Device location, shared with your permission, used to find nearby riders and enable live tracking</li>
        <li>Device information (model, OS version, unique device identifiers) and app usage data</li>
        <li>Order history, including timestamps, fares, and delivery status</li>
      </ul>
      <p><strong>Payment information:</strong> Payments are processed by Razorpay, our third-party payment
        gateway. We do not collect or store your full card number, CVV, or UPI PIN — that information is
        handled directly by Razorpay under its own privacy and security policies.</p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To create and manage your account, and verify your identity</li>
        <li>To match Customers with nearby available Riders and facilitate a booking</li>
        <li>To enable live location tracking of an order in progress</li>
        <li>To process payments and send order-related confirmations, receipts, and OTPs</li>
        <li>To provide customer support and respond to your queries or complaints</li>
        <li>To detect, prevent, and investigate fraud, abuse, or violations of our Terms</li>
        <li>To improve the Platform, and to send service updates and, where permitted, promotional messages</li>
      </ul>

      <h2>3. Sharing of Information</h2>
      <p>We share information only as necessary to operate the Platform:</p>
      <ul>
        <li><strong>Between Customers and Riders:</strong> name, phone number, pickup/drop location, and live
          location are shared with the counterparty of an active order, solely to complete that delivery.</li>
        <li><strong>Payment processing:</strong> transaction details are shared with Razorpay to process
          payments and refunds.</li>
        <li><strong>Service providers:</strong> we use third-party infrastructure such as Firebase (authentication,
          notifications) and mapping providers (route calculation, live tracking) who process data on our
          behalf.</li>
        <li><strong>Legal requirements:</strong> we may disclose information if required by law, court order, or
          to protect the rights, safety, or property of {BUSINESS_NAME}, our users, or the public.</li>
      </ul>
      <p>We do not sell your personal information to third parties.</p>

      <h2>4. Data Retention</h2>
      <p>
        We retain your account and order information for as long as your account is active and for a
        reasonable period afterward to comply with legal, accounting, or dispute-resolution obligations. You
        may request deletion of your account as described in Section 6 below.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We use reasonable technical and organizational safeguards — including encrypted data transmission and
        access controls — to protect your information. However, no method of transmission or storage is 100%
        secure, and we cannot guarantee absolute security.
      </p>

      <h2>6. Your Choices &amp; Rights</h2>
      <ul>
        <li>You can review and update your profile information from within the app.</li>
        <li>You can disable location permissions from your device settings, though this will limit core
          features like booking and live tracking.</li>
        <li>You may request access to, correction of, or deletion of your personal data by contacting us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within a reasonable time,
          subject to any records we are legally required to retain.</li>
      </ul>

      <h2>7. Children's Privacy</h2>
      <p>
        The Platform is not intended for individuals under 18 years of age, and we do not knowingly collect
        personal information from children.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected by updating the
        "Last updated" date above, and, where appropriate, by notifying you through the app.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        For any privacy-related questions or requests, contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or call {CONTACT_PHONE_DISPLAY}.
      </p>
    </LegalLayout>
  )
}

export default Privacy
