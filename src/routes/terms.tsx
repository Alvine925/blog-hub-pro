import { createFileRoute, Link } from "@tanstack/react-router";
import { Moon, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — Lunar CMS" }] }),
  component: TermsPage,
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
  { id: "acceptance",    label: "Acceptance of Terms" },
  { id: "description",   label: "Description of Service" },
  { id: "accounts",      label: "Accounts & Workspaces" },
  { id: "acceptable",    label: "Acceptable Use" },
  { id: "content",       label: "Your Content" },
  { id: "api",           label: "API Access & Keys" },
  { id: "ip",            label: "Intellectual Property" },
  { id: "payment",       label: "Payment & Plans" },
  { id: "termination",   label: "Termination" },
  { id: "disclaimers",   label: "Disclaimers" },
  { id: "liability",     label: "Limitation of Liability" },
  { id: "changes",       label: "Changes to Terms" },
  { id: "governing",     label: "Governing Law" },
  { id: "contact",       label: "Contact" },
];

function TermsPage() {
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
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">Terms of Service</h1>
            <p className="mt-3 text-sm text-zinc-500">
              Last updated: <time dateTime="2025-07-04">July 4, 2025</time>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              Please read these Terms of Service carefully before using Lunar CMS. By creating an account or
              accessing the service you agree to be bound by these terms. If you do not agree, do not use the service.
            </p>
          </div>

          <div className="space-y-12">
            <Section id="acceptance" title="1. Acceptance of Terms">
              <p>
                These Terms of Service ("Terms") constitute a legally binding agreement between you ("User",
                "you", or "your") and Lunar CMS ("Company", "we", "us", or "our") governing your use of the
                Lunar CMS platform, APIs, dashboards, and related services (collectively, the "Service").
              </p>
              <p>
                By clicking "Create account", signing in via OAuth, or otherwise accessing the Service, you
                represent that (a) you are at least 16 years old, (b) you have read and understood these Terms,
                and (c) you have the authority to enter into this agreement on behalf of yourself or the
                organisation you represent.
              </p>
            </Section>

            <Section id="description" title="2. Description of Service">
              <p>
                Lunar CMS is a headless content management system that provides a REST API, admin dashboard,
                multi-workspace management, blog and content authoring tools, engagement features (likes,
                comments, shares, views), media library, analytics, AI assistant, webhook delivery, and
                developer tooling.
              </p>
              <p>
                We reserve the right to modify, suspend, or discontinue any part of the Service at any time
                with reasonable notice. We will not be liable to you or any third party for any modification,
                suspension, or discontinuation.
              </p>
            </Section>

            <Section id="accounts" title="3. Accounts & Workspaces">
              <p>
                <strong className="font-semibold text-zinc-800">Account registration.</strong> You must provide
                accurate and complete information when creating an account. You are responsible for maintaining
                the confidentiality of your credentials and for all activity under your account.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Workspaces.</strong> A workspace is an isolated
                environment tied to a single project or domain. Each workspace has its own API keys, content,
                settings, and team members. You may create multiple workspaces subject to the limits of your plan.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Team access.</strong> You may invite other users
                to your workspace. You are responsible for all actions taken by team members you invite. Revoke
                access promptly when a team member's authorisation ends.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Account security.</strong> Notify us immediately
                at <a href="mailto:security@lunarcms.com" className="text-zinc-900 underline">security@lunarcms.com</a> if
                you become aware of any unauthorised access. We are not liable for losses caused by unauthorised
                use of your account.
              </p>
            </Section>

            <Section id="acceptable" title="4. Acceptable Use">
              <p>You agree not to use the Service to:</p>
              <ul className="list-inside list-disc space-y-1 pl-2">
                <li>Violate any applicable law or regulation.</li>
                <li>Publish, store, or distribute unlawful, defamatory, obscene, or harmful content.</li>
                <li>Infringe the intellectual property rights of any third party.</li>
                <li>Transmit malware, viruses, or any other malicious code.</li>
                <li>Attempt to gain unauthorised access to any system, network, or data.</li>
                <li>Use the API in a way that disrupts, degrades, or impairs the Service for other users.</li>
                <li>Resell, sublicense, or otherwise commercialise the Service beyond what is expressly permitted.</li>
                <li>Scrape content at a rate that places unreasonable load on our infrastructure.</li>
                <li>Use the Service to build a product that directly competes with Lunar CMS without our prior written consent.</li>
              </ul>
              <p>
                We reserve the right to suspend or terminate accounts that violate these policies without prior
                notice and without refund.
              </p>
            </Section>

            <Section id="content" title="5. Your Content">
              <p>
                <strong className="font-semibold text-zinc-800">Ownership.</strong> You retain all ownership
                rights to content you create, upload, or publish through the Service ("User Content"). We claim
                no ownership of your User Content.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Licence to us.</strong> By uploading User Content
                you grant us a non-exclusive, worldwide, royalty-free licence to store, process, cache, and deliver
                that content solely for the purpose of operating and improving the Service.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Responsibility.</strong> You are solely responsible
                for the accuracy, legality, and appropriateness of your User Content. We do not pre-screen content
                but reserve the right to remove any content that violates these Terms or our policies.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Backups.</strong> We perform regular automated
                backups, but you are solely responsible for maintaining your own backup copies of critical content.
                We are not liable for any loss of User Content.
              </p>
            </Section>

            <Section id="api" title="6. API Access & Keys">
              <p>
                <strong className="font-semibold text-zinc-800">API keys.</strong> The Service issues two key
                types: publishable keys (<code className="rounded bg-zinc-100 px-1 font-mono text-xs">pk_live_</code>)
                for client-side read access, and secret keys (<code className="rounded bg-zinc-100 px-1 font-mono text-xs">sk_live_</code>)
                for server-side write and moderation operations. Keep secret keys confidential.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Rate limits.</strong> API requests are rate-limited
                per key. Exceeding limits will result in <code className="rounded bg-zinc-100 px-1 font-mono text-xs">429 Too Many Requests</code> responses.
                We may adjust rate limits at any time. Contact us if your legitimate use case requires higher limits.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Prohibited API use.</strong> You may not use our
                API to build systems that automate abusive behaviour (spam comments, artificial engagement inflation,
                or data harvesting at scale).
              </p>
            </Section>

            <Section id="ip" title="7. Intellectual Property">
              <p>
                All rights, title, and interest in and to the Service (excluding User Content) — including the
                software, dashboard design, branding, logos, and documentation — are owned by or licensed to
                Lunar CMS. Nothing in these Terms transfers any intellectual property rights to you.
              </p>
              <p>
                "Lunar CMS", the crescent moon logo, and associated marks are trademarks of the Company.
                You may not use our trademarks without prior written permission.
              </p>
            </Section>

            <Section id="payment" title="8. Payment & Plans">
              <p>
                <strong className="font-semibold text-zinc-800">Free plan.</strong> The Service is available on a
                free tier with limitations on workspaces, API requests, team members, and storage. Free tier
                limits are subject to change.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Paid plans.</strong> Paid plans are billed monthly
                or annually in advance. By subscribing you authorise us to charge your payment method on a
                recurring basis. All fees are non-refundable except as required by applicable law.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Taxes.</strong> Prices are exclusive of applicable
                taxes. You are responsible for all taxes associated with your use of the Service.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Downgrades.</strong> Downgrading your plan may
                result in loss of features, reduced limits, or removal of data. We are not responsible for data
                loss resulting from a plan downgrade.
              </p>
            </Section>

            <Section id="termination" title="9. Termination">
              <p>
                <strong className="font-semibold text-zinc-800">By you.</strong> You may terminate your account
                at any time by deleting all workspaces and removing your account from the dashboard settings.
                Termination does not entitle you to a refund of any prepaid fees.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">By us.</strong> We may suspend or terminate your
                account at our sole discretion if you breach these Terms, fail to pay fees, or if we reasonably
                believe your use poses a risk to the Service or other users. We will provide reasonable notice
                where practicable.
              </p>
              <p>
                <strong className="font-semibold text-zinc-800">Effect of termination.</strong> Upon termination,
                your access to the Service will cease. We will retain User Content for 30 days after termination
                in case of accidental deletion. After that period, content may be permanently deleted.
              </p>
            </Section>

            <Section id="disclaimers" title="10. Disclaimers">
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
                OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </p>
              <p>
                We do not warrant that (a) the Service will be uninterrupted or error-free, (b) defects will be
                corrected, (c) the Service or the servers that make it available are free of harmful components,
                or (d) results obtained from the Service will be accurate or reliable.
              </p>
            </Section>

            <Section id="liability" title="11. Limitation of Liability">
              <p>
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL LUNAR CMS, ITS OFFICERS,
                DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                PUNITIVE, OR EXEMPLARY DAMAGES — INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS
                INTERRUPTION — ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF WE HAVE BEEN
                ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p>
                OUR TOTAL CUMULATIVE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS WILL NOT EXCEED THE
                GREATER OF (A) THE AMOUNT YOU PAID TO US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) $100 USD.
              </p>
            </Section>

            <Section id="changes" title="12. Changes to Terms">
              <p>
                We may update these Terms from time to time. When we do, we will revise the "Last updated" date
                at the top and, for material changes, notify you via email or an in-app notice at least 14 days
                in advance. Your continued use of the Service after changes take effect constitutes acceptance
                of the revised Terms.
              </p>
            </Section>

            <Section id="governing" title="13. Governing Law">
              <p>
                These Terms are governed by and construed in accordance with the laws of the jurisdiction in
                which the Company is registered, without regard to its conflict of law principles. Any dispute
                arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction
                of the courts of that jurisdiction.
              </p>
            </Section>

            <Section id="contact" title="14. Contact">
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="mt-2 rounded-xl border border-zinc-100 bg-zinc-50 p-5 text-sm">
                <p className="font-semibold text-zinc-800">Lunar CMS Legal</p>
                <p className="mt-1 text-zinc-500">
                  Email:{" "}
                  <a href="mailto:legal@lunarcms.com" className="text-zinc-900 underline">legal@lunarcms.com</a>
                </p>
                <p className="mt-0.5 text-zinc-500">
                  For security issues:{" "}
                  <a href="mailto:security@lunarcms.com" className="text-zinc-900 underline">security@lunarcms.com</a>
                </p>
              </div>
            </Section>
          </div>

          {/* Footer links */}
          <div className="mt-16 flex items-center justify-between border-t border-zinc-100 pt-8">
            <p className="text-xs text-zinc-400">© 2025 Lunar CMS. All rights reserved.</p>
            <div className="flex gap-4 text-xs text-zinc-500">
              <Link to="/privacy" className="hover:text-zinc-900 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="font-medium text-zinc-900">Terms of Service</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
