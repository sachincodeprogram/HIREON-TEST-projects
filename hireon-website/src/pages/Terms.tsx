import LegalLayout from '../components/LegalLayout'
import { BUSINESS_NAME, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, LEGAL_ENTITY_LINE, OPERATING_COUNTRY } from '../constants/business'

function Terms() {
  return (
    <LegalLayout title="Terms & Conditions" updated="August 4, 2026">
      <p>
        These Terms &amp; Conditions ("Terms") govern your access to and use of the {BUSINESS_NAME} mobile
        application and website (together, the "Platform"), operated by {LEGAL_ENTITY_LINE} ("{BUSINESS_NAME}",
        "we", "us", "our"). By creating an account, booking a delivery, or registering as a rider on the
        Platform, you agree to be bound by these Terms. If you do not agree, please do not use the Platform.
      </p>

      <h2>1. What HIREON Does</h2>
      <p>
        {BUSINESS_NAME} is a technology platform that connects customers who need parcels picked up and
        delivered ("Customers") with independent delivery partners ("Riders") willing to carry out that
        delivery for a fee. {BUSINESS_NAME} facilitates the booking, live tracking, and secure handoff of the
        parcel, and processes payment through our payment partner. {BUSINESS_NAME} itself does not own, handle,
        inspect, or transport any parcel — Riders are independent partners, not employees of {BUSINESS_NAME}.
      </p>

      <h2>2. Eligibility &amp; Accounts</h2>
      <ul>
        <li>You must be at least 18 years old and able to enter into a binding contract under Indian law.</li>
        <li>You must provide a valid mobile number and complete OTP verification to create an account.</li>
        <li>You are responsible for all activity that occurs under your account and for keeping your login
          credentials confidential.</li>
        <li>Riders must complete identity verification and any onboarding checks required by {BUSINESS_NAME}
          before accepting delivery requests.</li>
      </ul>

      <h2>3. Booking a Delivery</h2>
      <ul>
        <li>Customers provide accurate pickup and drop locations, recipient details, and parcel information at
          the time of booking.</li>
        <li>Once a Rider accepts a request, the Customer will be able to track the Rider's live location until
          the delivery is completed.</li>
        <li>Pickup and delivery are each confirmed using a one-time OTP shared with the relevant party. Do not
          share your OTP with anyone other than the verified Rider or Customer involved in that order.</li>
        <li>{BUSINESS_NAME} reserves the right to cancel or reassign a booking if no Rider is available, or if
          the request appears fraudulent or violates these Terms.</li>
      </ul>

      <h2>4. Prohibited Items</h2>
      <p>You agree not to book delivery of, and Riders agree not to carry, any of the following:</p>
      <ul>
        <li>Illegal drugs, narcotics, or controlled substances</li>
        <li>Firearms, ammunition, or explosives</li>
        <li>Live animals</li>
        <li>Hazardous, flammable, or radioactive material</li>
        <li>Counterfeit goods or items prohibited under applicable Indian law</li>
        <li>Cash, bullion, or items of extraordinary value not disclosed at booking</li>
      </ul>
      <p>
        {BUSINESS_NAME} may refuse, suspend, or cancel any order suspected of containing a prohibited item, and
        may report such activity to law enforcement.
      </p>

      <h2>5. Pricing &amp; Payments</h2>
      <ul>
        <li>Delivery fares are calculated based on distance, parcel details, and applicable surge or service
          charges, and are shown to the Customer before booking is confirmed.</li>
        <li>All payments on the Platform are processed through Razorpay, a PCI-DSS compliant third-party
          payment gateway. {BUSINESS_NAME} does not store your card, UPI, or net-banking credentials.</li>
        <li>Payment is due at the time of booking or upon delivery, as indicated in the app for that order.</li>
        <li>In case of a failed or duplicate payment due to a technical error, the amount is either
          auto-reversed by the payment gateway or refunded by {BUSINESS_NAME} — see our{' '}
          <a href="/refund">Refund &amp; Cancellation Policy</a>.</li>
      </ul>

      <h2>6. Cancellations</h2>
      <p>
        Customers may cancel a booking before a Rider is assigned at no charge. Cancellations made after a
        Rider has been assigned or after pickup may attract a cancellation fee. Full details are set out in
        our <a href="/refund">Refund &amp; Cancellation Policy</a>.
      </p>

      <h2>7. Rider Obligations</h2>
      <ul>
        <li>Riders must handle every parcel with care and complete pickup/delivery only after OTP verification.</li>
        <li>Riders must follow all applicable traffic and safety laws while making deliveries.</li>
        <li>Riders may not open, inspect, or misuse the contents of any parcel entrusted to them.</li>
        <li>{BUSINESS_NAME} may deactivate a Rider's account for safety violations, fraud, repeated customer
          complaints, or breach of these Terms.</li>
      </ul>

      <h2>8. Liability</h2>
      <p>
        {BUSINESS_NAME} acts as a facilitator connecting Customers and Riders and makes reasonable efforts to
        ensure safe, timely delivery. However, {BUSINESS_NAME} is not liable for delays, loss, or damage caused
        by incorrect information provided by the Customer, circumstances beyond our reasonable control
        (including traffic, weather, or force majeure events), or items shipped in violation of Section 4. Our
        total liability for any claim arising from a single order is limited to the delivery fee paid for that
        order, except where such limitation is not permitted by law.
      </p>

      <h2>9. Suspension &amp; Termination</h2>
      <p>
        We may suspend or terminate access to the Platform for any account that violates these Terms, engages
        in fraudulent activity, or poses a risk to other users. You may stop using the Platform and request
        account deletion at any time by contacting us.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time to reflect changes in our service or applicable law. The
        "Last updated" date above indicates the most recent revision. Continued use of the Platform after an
        update constitutes acceptance of the revised Terms.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These Terms are governed by the laws of {OPERATING_COUNTRY}. Any disputes arising out of or in
        connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in
        India.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        For any questions about these Terms, reach out to us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or call {CONTACT_PHONE_DISPLAY}.
      </p>
    </LegalLayout>
  )
}

export default Terms
