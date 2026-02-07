export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-6">Last updated: 7 February 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Acceptance</h2>
          <p>
            By accessing or using Fitdex, you agree to these Terms. If you do not agree, do not use the
            service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account and for all activities that
            occur under your account. You must provide accurate information.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Gym listings & memberships</h2>
          <p>
            Owners are responsible for gym information, pricing, and fulfillment. Members are responsible for
            selecting plans and completing payments.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Payments</h2>
          <p>
            Payments are processed by Razorpay. We do not store full payment credentials. Fees and pricing are
            shown prior to purchase.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Verification</h2>
          <p>
            We may require verification (email, GST, bank details) before enabling certain platform features.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Prohibited use</h2>
          <p>
            You agree not to misuse the platform, attempt to gain unauthorized access, or engage in fraudulent
            activity.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Termination</h2>
          <p>
            We may suspend or terminate accounts that violate these Terms or create risk to the platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Limitation of liability</h2>
          <p>
            Fitdex is provided “as is.” We are not liable for indirect damages, lost profits, or service
            interruptions.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">Contact</h2>
          <p>
            For questions, contact support@fitd3x.com.
          </p>
        </section>
      </div>
    </div>
  );
}
