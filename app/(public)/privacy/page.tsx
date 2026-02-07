export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: 7 February 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Overview</h2>
          <p>
            Fitdex (“we”, “our”, “us”) helps users discover gyms and manage memberships. This policy explains
            how we collect, use, and protect your information when you use our website and services.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Information we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account data: name, email, password (hashed), role.</li>
            <li>Contact details: phone, billing email, city, state, timezone.</li>
            <li>Owner info: business name/type, billing address, support contacts, logo (if provided).</li>
            <li>Gym details: address, hours, pricing, social links, verification status.</li>
            <li>Usage data: page views, saved gyms, membership activity.</li>
            <li>Payments: transaction IDs, amounts, status (processed via Razorpay).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">How we use data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and improve the platform.</li>
            <li>Process memberships and payments.</li>
            <li>Verify gyms and owner accounts.</li>
            <li>Send transactional emails (verification, password reset).</li>
            <li>Prevent fraud and secure accounts.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Sharing</h2>
          <p>
            We only share data with service providers needed to operate the platform (e.g., payment processing,
            email delivery). Public gym pages may show owner support contact details if provided.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Data retention</h2>
          <p>
            We retain data as long as your account is active or as needed for legitimate business and legal
            purposes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Security</h2>
          <p>
            We use industry-standard security practices, hashed passwords, and secure payment processing. You
            are responsible for keeping your login credentials safe.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Your choices</h2>
          <p>
            You can update your profile information in settings. If you receive a verification email that you
            did not request, you can delete the account using the link provided.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Contact</h2>
          <p>
            For privacy questions, contact us at support@fitd3x.com.
          </p>
        </section>
      </div>
    </div>
  );
}
