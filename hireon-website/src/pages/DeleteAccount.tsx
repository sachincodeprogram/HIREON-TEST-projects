import LegalLayout from '../components/LegalLayout'
import { BUSINESS_NAME, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY } from '../constants/business'

function DeleteAccount() {
  return (
    <LegalLayout title="Delete Your HIREON Account" updated="August 17, 2026">
      <p>
        You can request permanent deletion of your {BUSINESS_NAME} account and associated data at any time.
        This page explains how to request deletion, what data is removed, and what we are required to retain.
      </p>

      <h2>1. How to Request Deletion</h2>
      <p>
        Send an email to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email address or
        mobile number linked to your account, along with your <strong>registered phone number</strong>, and
        ask us to delete your account. You may also call us at {CONTACT_PHONE_DISPLAY} for assistance.
      </p>

      <h2>2. What Gets Deleted</h2>
      <p>Once your request is verified, we permanently delete:</p>
      <ul>
        <li>Your name, email address, and registered mobile number</li>
        <li>Your saved addresses and location history</li>
        <li>Your booking and order history (pickup/drop details, delivery status)</li>
        <li>Rider verification documents, if you had a Rider account</li>
        <li>Your payment records saved for convenience, such as saved cards/UPI references</li>
      </ul>

      <h2>3. Timeline</h2>
      <p>
        We process account deletion requests within <strong>7 business days</strong> of verifying your
        request. You will receive a confirmation once the deletion is complete.
      </p>

      <h2>4. Data We Are Required to Retain</h2>
      <p>
        Payment and transaction records are retained for <strong>90 days</strong> after deletion, as required
        under applicable Indian financial and tax regulations. This data is kept solely to meet legal and
        accounting obligations, is not used for any other purpose, and is permanently purged after the
        retention period ends.
      </p>

      <h2>5. Contact Us</h2>
      <p>
        For any questions about account deletion, reach us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or call {CONTACT_PHONE_DISPLAY}.
      </p>
    </LegalLayout>
  )
}

export default DeleteAccount
