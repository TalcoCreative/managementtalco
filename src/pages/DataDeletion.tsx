import { Helmet } from "react-helmet-async";

export default function DataDeletion() {
  return (
    <>
      <Helmet>
        <title>Data Deletion — Talco Management System</title>
        <meta name="description" content="Request deletion of your data from Talco Management System. Learn what data will be removed and how to submit a request." />
        <link rel="canonical" href="https://ms.talco.id/data-deletion" />
      </Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight">Data Deletion</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: March 19, 2026</p>
          </header>

          <div className="space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
            <section>
              <h2>Your Right to Data Deletion</h2>
              <p>At Talco Management System, we respect your right to control your personal data. You can request the deletion of all data associated with your account at any time.</p>
            </section>

            <section>
              <h2>How to Request Data Deletion</h2>
              <p>To request the deletion of your data, please send an email to:</p>
              <div className="my-4 rounded-lg border border-border bg-muted/50 p-6 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Send your request to</p>
                <a href="mailto:support@talco.id?subject=Data%20Deletion%20Request" className="mt-2 inline-block text-xl font-semibold text-primary underline underline-offset-4 hover:text-primary/80">
                  support@talco.id
                </a>
              </div>
              <p>Please include the following information in your request:</p>
              <ul>
                <li>Your full name</li>
                <li>The email address associated with your account</li>
                <li>The social media accounts you connected (if applicable)</li>
                <li>A brief statement requesting data deletion</li>
              </ul>
            </section>

            <section>
              <h2>What Data Will Be Deleted</h2>
              <p>Upon processing your request, we will permanently delete the following data:</p>
              <ul>
                <li><strong className="text-foreground">Access tokens</strong> — All OAuth tokens associated with your connected social media accounts.</li>
                <li><strong className="text-foreground">Account information</strong> — Your profile data, account IDs, and any stored credentials.</li>
                <li><strong className="text-foreground">Content metadata</strong> — Scheduled posts, analytics data, and engagement metrics linked to your account.</li>
                <li><strong className="text-foreground">Activity logs</strong> — Any logs of actions performed through the platform.</li>
                <li><strong className="text-foreground">User preferences</strong> — Settings, configurations, and personalization data.</li>
              </ul>
            </section>

            <section>
              <h2>Processing Time</h2>
              <p>Data deletion requests are processed within <strong className="text-foreground">3–5 business days</strong> from the date we receive your request. You will receive a confirmation email once the deletion is complete.</p>
            </section>

            <section>
              <h2>Important Notes</h2>
              <ul>
                <li>Data deletion is <strong className="text-foreground">permanent and irreversible</strong>. Once deleted, your data cannot be recovered.</li>
                <li>Deleting your data from our platform does not affect data stored by third-party platforms (e.g., Facebook, Instagram). To manage data on those platforms, please refer to their respective privacy settings.</li>
                <li>We may retain certain data as required by law or for legitimate business purposes (e.g., fraud prevention, legal compliance), but only for the minimum period required.</li>
              </ul>
            </section>

            <section>
              <h2>Automatic Deletion via Facebook</h2>
              <p>If you remove our app from your Facebook settings, we will automatically receive a callback notification and initiate the deletion of your data associated with your Facebook account within 3–5 business days.</p>
            </section>

            <section>
              <h2>Contact Us</h2>
              <p>If you have any questions about the data deletion process, please contact us at:</p>
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
