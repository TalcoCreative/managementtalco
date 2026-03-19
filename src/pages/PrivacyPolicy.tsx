import { Helmet } from "react-helmet-async";

export default function PrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — Talco Management System</title>
        <meta name="description" content="Privacy Policy for Talco Management System (ms.talco.id). Learn how we collect, use, and protect your data." />
        <link rel="canonical" href="https://ms.talco.id/privacy-policy" />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: March 19, 2026</p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
            <section>
              <h2>1. Introduction</h2>
              <p>Talco Management System ("we", "us", or "our") operates the web application at <strong className="text-foreground">ms.talco.id</strong>. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our services, including integrations with third-party platforms such as Facebook and Instagram.</p>
            </section>

            <section>
              <h2>2. Data We Collect</h2>
              <p>When you connect your social media accounts or use our platform, we may collect the following data:</p>
              <ul>
                <li><strong className="text-foreground">Access tokens</strong> — OAuth tokens provided by Facebook/Instagram to authorize actions on your behalf.</li>
                <li><strong className="text-foreground">Account IDs</strong> — Unique identifiers for your connected social media accounts.</li>
                <li><strong className="text-foreground">Profile information</strong> — Name, profile picture, and page/account metadata.</li>
                <li><strong className="text-foreground">Content metadata</strong> — Post details, engagement metrics, scheduling data, and analytics insights.</li>
              </ul>
            </section>

            <section>
              <h2>3. How We Use Your Data</h2>
              <p>We use the collected data solely for the following purposes:</p>
              <ul>
                <li><strong className="text-foreground">Social media scheduling</strong> — Creating, scheduling, and publishing content to your connected accounts.</li>
                <li><strong className="text-foreground">Analytics & reporting</strong> — Providing performance insights and engagement metrics for your social media content.</li>
                <li><strong className="text-foreground">Account management</strong> — Managing connected social media accounts within the platform.</li>
                <li><strong className="text-foreground">Service improvement</strong> — Enhancing the functionality, security, and user experience of our platform.</li>
              </ul>
            </section>

            <section>
              <h2>4. Data Storage & Security</h2>
              <p>We take the security of your data seriously:</p>
              <ul>
                <li>All data is stored on secure, encrypted servers with industry-standard protections.</li>
                <li>Access tokens are stored securely and are never exposed in client-side code.</li>
                <li>We use HTTPS encryption for all data transmission.</li>
                <li>Access to user data is restricted to authorized personnel only.</li>
                <li>We conduct regular security reviews and updates to maintain data integrity.</li>
              </ul>
            </section>

            <section>
              <h2>5. Data Sharing</h2>
              <p>We <strong className="text-foreground">do not sell, rent, or share</strong> your personal data with any third parties for marketing or advertising purposes. Data is only shared with third-party services (such as Facebook and Instagram APIs) as necessary to provide the functionality you have requested.</p>
            </section>

            <section>
              <h2>6. Your Rights</h2>
              <p>You have the following rights regarding your personal data:</p>
              <ul>
                <li><strong className="text-foreground">Access</strong> — You can request a copy of the data we hold about you.</li>
                <li><strong className="text-foreground">Update</strong> — You can request corrections to any inaccurate data.</li>
                <li><strong className="text-foreground">Delete</strong> — You can request the deletion of your data at any time. See our <a href="/data-deletion" className="text-primary underline underline-offset-2 hover:text-primary/80">Data Deletion</a> page for instructions.</li>
                <li><strong className="text-foreground">Revoke access</strong> — You can disconnect your social media accounts at any time through the platform settings or through the respective platform's app settings.</li>
              </ul>
            </section>

            <section>
              <h2>7. Cookies & Tracking</h2>
              <p>We use essential cookies to maintain your session and authentication state. We do not use third-party tracking cookies for advertising purposes.</p>
            </section>

            <section>
              <h2>8. Changes to This Policy</h2>
              <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date. Continued use of our services after changes constitutes acceptance of the revised policy.</p>
            </section>

            <section>
              <h2>9. Contact Us</h2>
              <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
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
