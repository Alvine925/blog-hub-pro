import { createFileRoute, Link } from "@tanstack/react-router";
import { Moon, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Lunar CMS" }] }),
  component: PrivacyPage,
});

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-600">{children}</div>
    </section>
  );
}

const TOC = [
  { id: "overview",       label: "Overview" },
  { id: "data-we-collect", label: "Data We Collect" },
  { id: "how-we-use",    label: "How We Use Your Data" },
  { id: "data-sharing",  label: "Data Sharing" },
  { id: "cookies",       label: "Cookies & Tracking" },
  { id: "retention",     label: "Data Retention" },
  { id: "security",      label: "Security" },
  { id: "your-rights",   label: "Your Rights" },
  { id: "children",      label: "Children's Privacy" },
  { id: "transfers",     label: "International Transfers" },
  { id: "third-party",   label: "Third-Party Links" },
  { id: "changes",       label: "Changes to This Policy" },
  { id: "contact",       label: "Contact & DPO" },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-zinc-900" />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">Lunar CMS</span>
          </Link>
          <Link
            to="/signup"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign up
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-16 lg:flex lg:gap-16">
        {/* Sidebar TOC */}
        <aside className="hidden lg:block lg:w-56 lg:flex-shrink-0">
          <div className="sticky top-28">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">On this page</p>
            <nav className="space-y-1">
              {TOC.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded py-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Legal</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">Privacy Policy</h1>
            <p className="mt-3 text-sm text-zinc-500">
              Last updated: <time dateTime="2025-07-04">July 4, 2025</time>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              Lunar CMS takes your privacy seriously. This Privacy Policy explains what data we collect,
              why we collect it, how we use and protect it, and what rights you have. We are committed to
              processing data lawfully, fairly, and transparently in compliance with applicable privacy laws
              including the GDPR and CCPA.
            </p>
          </div>

          <div className="space-y-12">
            <Section id="overview" title="1. Overview">
              <p>
                Lunar CMS ("we", "us", "our") operates the Lunar CMS platform, including the web dashboard at
                <a href="https://lunarcms.com" className="mx-1 text-zinc-900 underline">lunarcms.com</a>
                and associated APIs. When you use our platform, we act as:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li><strong className="font-semibold text-zinc-800">Data Controller</strong> — for data about your account, billing, and use of our dashboard.</li>
                <li><strong className="font-semibold text-zinc-800">Data Processor</strong> — for content and engagement data that your end-users generate through your published site (we process it on your behalf).</li>
              </ul>
              <p>
                If you are a visitor to a site powered by Lunar CMS, your data is processed under the privacy
                policy of the site operator, not ours. Site operators are independently responsible for their own
                compliance obligations.
              </p>
            </Section>

            <Section id="data-we-collect" title="2. Data We Collect">
              <p><strong className="font-semibold text-zinc-800">Account data</strong></p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>Full name and email address (provided at registration)</li>
                <li>OAuth identity tokens (when signing in via Google or GitHub)</li>
                <li>Profile picture URL (from OAuth providers, where available)</li>
                <li>Password hash (stored using industry-standard bcrypt — we never store plaintext passwords)</li>
              </ul>

              <p className="pt-2"><strong className="font-semibold text-zinc-800">Workspace & content data</strong></p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>Workspace names, settings, and configuration you create</li>
                <li>Blog posts, pages, news, articles, products, and media you publish</li>
                <li>API keys (we store only hashed representations of secret key material)</li>
                <li>Webhook endpoints and delivery logs</li>
              </ul>

              <p className="pt-2"><strong className="font-semibold text-zinc-800">Engagement data (from your end-users)</strong></p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>Anonymous visitor IDs (a UUID stored in the visitor's browser localStorage — no account required)</li>
                <li>Page views, like events, share click events, and comment submissions</li>
                <li>Referrer URLs and approximate timestamps of engagement events</li>
                <li>Comment content, author name, and email address (provided voluntarily by end-users)</li>
              </ul>

              <p className="pt-2"><strong className="font-semibold text-zinc-800">Usage & technical data</strong></p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>IP addresses and user-agent strings (for rate limiting and security)</li>
                <li>API request logs (endpoint, status code, latency — retained for 30 days)</li>
                <li>Dashboard session data (browser type, device type, timezone)</li>
                <li>Error reports and crash diagnostics</li>
              </ul>

              <p className="pt-2"><strong className="font-semibold text-zinc-800">Payment data</strong></p>
              <p>
                Billing is handled by a PCI-DSS certified third-party processor. We do not store or have
                access to raw card numbers. We receive only tokenised references and summary billing records
                (plan name, amount, date, last four digits).
              </p>
            </Section>

            <Section id="how-we-use" title="3. How We Use Your Data">
              <p>We use the data we collect to:</p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li><strong className="font-semibold text-zinc-800">Provide the Service</strong> — authenticate you, operate workspaces, deliver content via API, and process engagement events.</li>
                <li><strong className="font-semibold text-zinc-800">Improve the Service</strong> — analyse usage patterns, diagnose bugs, and develop new features.</li>
                <li><strong className="font-semibold text-zinc-800">Communicate with you</strong> — send transactional emails (account verification, password reset, billing receipts) and, where you have opted in, product updates and newsletters.</li>
                <li><strong className="font-semibold text-zinc-800">Enforce our Terms</strong> — detect and prevent abuse, fraud, and policy violations.</li>
                <li><strong className="font-semibold text-zinc-800">Legal obligations</strong> — comply with applicable laws, regulations, and court orders.</li>
              </ul>

              <p>
                We do not sell your personal data. We do not use your content to train AI models without your
                explicit consent.
              </p>

              <div className="overflow-hidden rounded-xl border border-zinc-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-left">
                      <th className="px-4 py-2.5 font-semibold text-zinc-700">Purpose</th>
                      <th className="px-4 py-2.5 font-semibold text-zinc-700">Lawful basis (GDPR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {[
                      ["Account creation & authentication", "Contract"],
                      ["Service delivery & API", "Contract"],
                      ["Billing & payment processing", "Contract / Legal obligation"],
                      ["Security & abuse prevention", "Legitimate interests"],
                      ["Product analytics & improvement", "Legitimate interests"],
                      ["Transactional emails", "Contract"],
                      ["Marketing emails", "Consent"],
                      ["Legal compliance", "Legal obligation"],
                    ].map(([purpose, basis]) => (
                      <tr key={purpose}>
                        <td className="px-4 py-2.5 text-zinc-600">{purpose}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="data-sharing" title="4. Data Sharing">
              <p>
                We do not sell, rent, or trade your personal data. We may share data in the following limited
                circumstances:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>
                  <strong className="font-semibold text-zinc-800">Service providers.</strong> We work with
                  sub-processors (hosting, database, email delivery, payment processing, error monitoring) under
                  data processing agreements. A current list of sub-processors is available on request.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-800">Business transfers.</strong> If Lunar CMS is
                  acquired or merges with another company, data may be transferred as part of that transaction.
                  We will notify you before your data is transferred and becomes subject to a different privacy policy.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-800">Legal requirements.</strong> We may disclose data
                  where required by law, court order, or regulatory authority, or to protect the rights, property,
                  or safety of our users or the public.
                </li>
                <li>
                  <strong className="font-semibold text-zinc-800">With your consent.</strong> We may share data
                  in other ways with your explicit consent.
                </li>
              </ul>
            </Section>

            <Section id="cookies" title="5. Cookies & Tracking">
              <p>
                We use cookies and similar technologies to operate the Service. Our use falls into three
                categories:
              </p>
              <div className="overflow-hidden rounded-xl border border-zinc-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50 text-left">
                      <th className="px-4 py-2.5 font-semibold text-zinc-700">Category</th>
                      <th className="px-4 py-2.5 font-semibold text-zinc-700">Purpose</th>
                      <th className="px-4 py-2.5 font-semibold text-zinc-700">Can be declined?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-zinc-700">Essential</td>
                      <td className="px-4 py-2.5 text-zinc-600">Session management, CSRF protection, authentication state</td>
                      <td className="px-4 py-2.5 text-zinc-600">No — required for the Service to function</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-zinc-700">Functional</td>
                      <td className="px-4 py-2.5 text-zinc-600">User preferences (theme, language), visitor ID for engagement features</td>
                      <td className="px-4 py-2.5 text-zinc-600">Partially</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-medium text-zinc-700">Analytics</td>
                      <td className="px-4 py-2.5 text-zinc-600">Aggregated product usage analysis — no cross-site tracking</td>
                      <td className="px-4 py-2.5 text-zinc-600">Yes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                We do not use advertising or cross-site tracking cookies. You can manage cookie preferences
                through your browser settings at any time.
              </p>
            </Section>

            <Section id="retention" title="6. Data Retention">
              <p>We retain data for as long as necessary to fulfil the purposes described in this policy:</p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li><strong className="font-semibold text-zinc-800">Account data</strong> — retained for the life of your account, plus 90 days after deletion to allow for recovery.</li>
                <li><strong className="font-semibold text-zinc-800">Workspace & content data</strong> — retained until you delete the workspace or your account is terminated, plus 30 days post-termination.</li>
                <li><strong className="font-semibold text-zinc-800">Engagement data</strong> — aggregated engagement counters are retained indefinitely; individual event logs are retained for 12 months.</li>
                <li><strong className="font-semibold text-zinc-800">API logs</strong> — retained for 30 days for debugging and security purposes.</li>
                <li><strong className="font-semibold text-zinc-800">Billing records</strong> — retained for 7 years as required by tax law.</li>
              </ul>
            </Section>

            <Section id="security" title="7. Security">
              <p>
                We implement industry-standard technical and organisational measures to protect your data:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>All data in transit is encrypted using TLS 1.2 or higher.</li>
                <li>All data at rest is encrypted using AES-256.</li>
                <li>Passwords are hashed using bcrypt with a minimum cost factor of 12.</li>
                <li>Secret API key material is hashed before storage; we cannot retrieve the original value.</li>
                <li>Access to production systems is restricted to authorised personnel via MFA-enforced accounts.</li>
                <li>We perform periodic security reviews and penetration tests.</li>
              </ul>
              <p>
                No method of transmission over the internet is 100% secure. While we strive to protect your
                data, we cannot guarantee absolute security. Report security vulnerabilities responsibly to
                <a href="mailto:security@lunarcms.com" className="mx-1 text-zinc-900 underline">security@lunarcms.com</a>.
              </p>
            </Section>

            <Section id="your-rights" title="8. Your Rights">
              <p>
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li><strong className="font-semibold text-zinc-800">Access</strong> — request a copy of the personal data we hold about you.</li>
                <li><strong className="font-semibold text-zinc-800">Rectification</strong> — correct inaccurate or incomplete data.</li>
                <li><strong className="font-semibold text-zinc-800">Erasure</strong> — request deletion of your personal data ("right to be forgotten").</li>
                <li><strong className="font-semibold text-zinc-800">Restriction</strong> — ask us to restrict processing of your data in certain circumstances.</li>
                <li><strong className="font-semibold text-zinc-800">Portability</strong> — receive your data in a structured, machine-readable format.</li>
                <li><strong className="font-semibold text-zinc-800">Objection</strong> — object to processing based on legitimate interests.</li>
                <li><strong className="font-semibold text-zinc-800">Withdraw consent</strong> — where processing is based on consent, withdraw it at any time without affecting the lawfulness of prior processing.</li>
                <li><strong className="font-semibold text-zinc-800">CCPA rights</strong> — California residents have additional rights under the CCPA, including the right to know, delete, and opt out of sale (we do not sell data).</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:privacy@lunarcms.com" className="text-zinc-900 underline">privacy@lunarcms.com</a>.
                We will respond within 30 days. We may ask you to verify your identity before processing requests.
              </p>
              <p>
                You also have the right to lodge a complaint with your local data protection authority if you
                believe we have not handled your data appropriately.
              </p>
            </Section>

            <Section id="children" title="9. Children's Privacy">
              <p>
                The Service is not directed at children under the age of 16. We do not knowingly collect
                personal data from children under 16. If we become aware that we have collected personal data
                from a child under 16 without verifiable parental consent, we will delete that data promptly.
              </p>
              <p>
                If you believe we have inadvertently collected data from a child, please contact us at
                <a href="mailto:privacy@lunarcms.com" className="mx-1 text-zinc-900 underline">privacy@lunarcms.com</a>.
              </p>
            </Section>

            <Section id="transfers" title="10. International Data Transfers">
              <p>
                Lunar CMS may process and store data in data centres located outside your country of residence.
                When transferring personal data from the European Economic Area (EEA) or the UK to countries
                not deemed adequate by the European Commission, we rely on appropriate safeguards such as
                Standard Contractual Clauses (SCCs) approved by the European Commission.
              </p>
              <p>
                For questions about international transfers or to obtain a copy of our SCCs, contact us at
                <a href="mailto:privacy@lunarcms.com" className="mx-1 text-zinc-900 underline">privacy@lunarcms.com</a>.
              </p>
            </Section>

            <Section id="third-party" title="11. Third-Party Links & Integrations">
              <p>
                The Service may contain links to third-party websites, or you may connect third-party
                integrations (e.g. OAuth providers, webhook destinations). We are not responsible for the
                privacy practices of any third party. We encourage you to review the privacy policies of any
                third-party services you connect.
              </p>
            </Section>

            <Section id="changes" title="12. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do, we will revise the
                "Last updated" date at the top of the page. For material changes, we will notify you via
                email at least 14 days before the changes take effect. Your continued use of the Service
                after the effective date constitutes acceptance of the updated policy.
              </p>
            </Section>

            <Section id="contact" title="13. Contact & Data Protection Officer">
              <p>
                For privacy-related questions, data subject requests, or to contact our Data Protection Officer:
              </p>
              <div className="mt-2 rounded-xl border border-zinc-100 bg-zinc-50 p-5 text-sm">
                <p className="font-semibold text-zinc-800">Lunar CMS Privacy Team</p>
                <p className="mt-1 text-zinc-500">
                  Email:{" "}
                  <a href="mailto:privacy@lunarcms.com" className="text-zinc-900 underline">privacy@lunarcms.com</a>
                </p>
                <p className="mt-0.5 text-zinc-500">
                  Security issues:{" "}
                  <a href="mailto:security@lunarcms.com" className="text-zinc-900 underline">security@lunarcms.com</a>
                </p>
                <p className="mt-0.5 text-zinc-500">
                  Response time: We aim to respond to all privacy enquiries within 30 days.
                </p>
              </div>
            </Section>
          </div>

          {/* Footer links */}
          <div className="mt-16 flex items-center justify-between border-t border-zinc-100 pt-8">
            <p className="text-xs text-zinc-400">© 2025 Lunar CMS. All rights reserved.</p>
            <div className="flex gap-4 text-xs text-zinc-500">
              <Link to="/privacy" className="font-medium text-zinc-900">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-zinc-900 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
