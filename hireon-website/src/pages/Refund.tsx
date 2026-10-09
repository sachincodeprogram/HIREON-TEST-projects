import LegalLayout from '../components/LegalLayout'
import { BUSINESS_NAME, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY } from '../constants/business'

function Refund() {
  return (
    <LegalLayout title="Refund & Cancellation Policy" updated="August 4, 2026">
      <p>
        This policy explains when a delivery booking on {BUSINESS_NAME} can be cancelled, and when a refund is
        due. It applies to all payments made through the Platform via our payment partner, Razorpay.
      </p>

      <h2>1. Cancelling a Booking</h2>
      <ul>
        <li><strong>Before a Rider is assigned:</strong> you can cancel free of charge, and any amount already
          paid is fully refunded.</li>
        <li><strong>After a Rider is assigned, before pickup:</strong> a small cancellation fee may apply to
          compensate the Rider for time and travel already spent reaching the pickup location. The applicable
          fee, if any, is shown in the app before you confirm the cancellation.</li>
        <li><strong>After pickup has been confirmed (OTP verified):</strong> the order cannot be cancelled, as
          the parcel is already in transit with the Rider.</li>
      </ul>

      <h2>2. When a Refund Applies</h2>
      <p>You are eligible for a full or partial refund in the following cases:</p>
      <ul>
        <li>You cancelled the booking before a Rider was assigned.</li>
        <li>{BUSINESS_NAME} was unable to find an available Rider and the order was auto-cancelled by the
          system.</li>
        <li>The delivery could not be completed due to a verified fault on the Rider's or {BUSINESS_NAME}'s
          side (for example, the Rider was unreachable or did not complete the delivery as booked).</li>
        <li>You were charged more than once for the same order due to a technical/payment gateway error.</li>
        <li>A payment was deducted from your account but the booking was not created ("payment failure, order
          not placed").</li>
      </ul>

      <h2>3. When a Refund Does Not Apply</h2>
      <ul>
        <li>The order was successfully picked up and delivered as booked.</li>
        <li>You cancelled after pickup was confirmed via OTP.</li>
        <li>The parcel booked violated our <a href="/terms">Terms &amp; Conditions</a> (for example, a
          prohibited item), resulting in order cancellation.</li>
        <li>Delivery was delayed due to factors outside {BUSINESS_NAME}'s reasonable control, such as incorrect
          address details provided by you, the recipient being unavailable, traffic, or weather — in such cases
          the delivery fee already earned by the Rider is not refunded, though we will work with you on a fair
          resolution.</li>
      </ul>

      <h2>4. How Refunds Are Processed</h2>
      <ul>
        <li>Eligible refunds are issued to the original payment method used at checkout, processed through
          Razorpay.</li>
        <li>Refunds are typically initiated within 24–48 hours of approval and, depending on your bank or card
          network, may take <strong>5–7 business days</strong> to reflect in your account.</li>
        <li>You will receive a confirmation notification/email once a refund has been initiated.</li>
      </ul>

      <h2>5. How to Request a Refund</h2>
      <p>
        To request a cancellation or report an issue with an order, use the "Help" or "Report an Issue" option
        on the relevant order in the app, or contact our support team directly at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or {CONTACT_PHONE_DISPLAY} with your order ID.
        We aim to review and resolve refund requests within 2–3 business days.
      </p>

      <h2>6. Changes to This Policy</h2>
      <p>
        We may revise this Refund &amp; Cancellation Policy from time to time to reflect changes in our
        service. The "Last updated" date above reflects the most recent revision.
      </p>

      <h2>7. Contact Us</h2>
      <p>
        For any refund or cancellation queries, reach us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or call {CONTACT_PHONE_DISPLAY}.
      </p>
    </LegalLayout>
  )
}

export default Refund
