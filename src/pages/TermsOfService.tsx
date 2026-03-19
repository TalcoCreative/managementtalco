import { Helmet } from "react-helmet-async";

export default function TermsOfService() {
  return (
    <>
      <Helmet>
        <title>Terms of Service — Talco Management System</title>
        <meta name="description" content="Terms of Service for Talco Management System (ms.talco.id). Read our terms and conditions for using the platform." />
        <link rel="canonical" href="https://ms.talco.id/terms-of-service" />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: March 19, 2026</p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
            <section>
              <h2>1. Acceptance of Terms</h2>
              <p>By accessing or using Talco Management System at <strong className="text-foreground">ms.talco.id</strong> ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
            </section>

            <section>
              <h2>2. Description of Service</h2>
              <p>Talco Management System is a SaaS platform that provides social media management, scheduling, analytics, project management, and related tools for businesses and agencies. The Service may integrate with third-party platforms including Facebook, Instagram, and other social media networks.</p>
            </section>

            <section>
              <h2>3. Account Connection</h2>
              <p>Certain features of the Service require you to connect your social media accounts via OAuth (e.g., Facebook Login, Instagram API). By connecting your accounts:</p>
              <ul>
                <li>You authorize us to access and manage your connected accounts within the scope of permissions you grant.</li>
                <li>You confirm that you have the authority to connect the accounts and grant such permissions.</li>
                <li>You can revoke access at any time through the platform settings or the respective social media platform's app settings.</li>
              </ul>
            </section>

            <section>
              <h2>4. User Responsibilities</h2>
              <p>As a user of the Service, you agree to:</p>
              <ul>
                <li>Use the Service only for lawful purposes and in compliance with all applicable laws and regulations.</li>
                <li>Not use the Service to distribute spam, malware, or any harmful content.</li>
                <li>Not attempt to gain unauthorized access to the Service, other user accounts, or connected systems.</li>
                <li>Not reverse engineer, decompile, or otherwise attempt to derive the source code of the Service.</li>
                <li>Comply with the terms of service of any third-party platforms you connect through the Service.</li>
                <li>Maintain the security of your account credentials.</li>
              </ul>
            </section>

            <section>
              <h2>5. Service Availability</h2>
              <p>We strive to maintain high availability of the Service, but we do not guarantee uninterrupted or error-free operation. The Service may be temporarily unavailable due to:</p>
              <ul>
                <li>Scheduled maintenance and updates.</li>
                <li>Unexpected technical issues or outages.</li>
                <li>Changes or outages in third-party APIs (e.g., Facebook, Instagram).</li>
              </ul>
              <p className="mt-2">We are not liable for any loss or damage resulting from service interruptions.</p>
            </section>

            <section>
              <h2>6. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law:</p>
              <ul>
                <li>The Service is provided "as is" and "as available" without warranties of any kind, express or implied.</li>
                <li>We shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</li>
                <li>We are not responsible for any actions taken by third-party platforms in relation to your connected accounts.</li>
                <li>Our total liability for any claim arising from the Service shall not exceed the amount paid by you for the Service in the 12 months preceding the claim.</li>
              </ul>
            </section>

            <section>
              <h2>7. Intellectual Property</h2>
              <p>All content, features, and functionality of the Service — including but not limited to text, graphics, logos, and software — are the exclusive property of Talco and are protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without our prior written consent.</p>
            </section>

            <section>
              <h2>8. Termination</h2>
              <p>We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, including but not limited to:</p>
              <ul>
                <li>Violation of these Terms of Service.</li>
                <li>Abuse of the platform or its features.</li>
                <li>Requests by law enforcement or government agencies.</li>
              </ul>
              <p className="mt-2">You may also terminate your account at any time by contacting us. Upon termination, your right to use the Service ceases immediately.</p>
            </section>

            <section>
              <h2>9. Changes to Terms</h2>
              <p>We may update these Terms of Service from time to time. Changes will be posted on this page with an updated date. Your continued use of the Service after changes constitutes acceptance of the updated terms.</p>
            </section>

            <section>
              <h2>10. Governing Law</h2>
              <p>These Terms shall be governed by and construed in accordance with the laws of the Republic of Indonesia, without regard to conflict of law principles.</p>
            </section>

            <section>
              <h2>11. Contact Us</h2>
              <p>If you have any questions about these Terms of Service, please contact us at:</p>
              <p className="mt-2 font-medium text-foreground">📧 <a href="mailto:support@talco.id" className="text-primary underline underline-offset-2 hover:text-primary/80">support@talco.id</a></p>
            </section>
          </div>

          <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Talco Management System. All rights reserved.
          </footer>
        </div>
      </div>
    </>
  );
}
