import SiteInfoPage from "@/components/SiteInfoPage";

export default function TermsPage() {
  return (
    <SiteInfoPage title="Terms of Service" subtitle="Effective date: November 12, 2026">
      <p>By accessing or using Viewers Tube, you agree to these Terms of Service. If you do not agree, please do not use the platform.</p>
      <section>
        <h2>1. The platform</h2>
        <p>Viewers Tube provides video discovery, viewing, creator, and account features as they become available. Features may change, be limited, or be unavailable from time to time.</p>
      </section>
      <section>
        <h2>2. Accounts</h2>
        <p>You are responsible for providing accurate registration information, keeping your sign-in credentials confidential, and activity carried out through your account. Do not impersonate another person or misuse another user's account.</p>
      </section>
      <section>
        <h2>3. Viewer and Creator responsibilities</h2>
        <p>Use the platform lawfully and respectfully. Do not use it for scams, spam, harassment, threats, impersonation, unlawful activity, or attempts to interfere with the platform or other users.</p>
        <p>Creators must only publish content they own or are legally authorized to publish, and must respect privacy, intellectual property, applicable laws, and other people's rights.</p>
      </section>
      <section>
        <h2>4. Prohibited content</h2>
        <p>Content must not include nudity, pornography, sexually explicit material, obscene or excessively abusive material, threats or harassment, hate, exploitation, child sexual abuse material, promotion of violence, illegal material, scams, impersonation, spam, or deliberately misleading content.</p>
      </section>
      <section>
        <h2>5. Moderation and Creator enforcement</h2>
        <p>Confirmed Creator Agreement violations may result in content removal and Creator upload suspensions: first strike 7 days, second strike 14 days, third strike 30 days, and a fourth strike may result in termination of Creator privileges. Creators will receive notice and may appeal a strike.</p>
        <p>Reports or automated detection alone do not establish a violation. Enforcement requires confirmation under the platform's moderation process. Attempts to evade moderation or account restrictions through another account are prohibited.</p>
        <p><a href="/creator-guidelines">Read the full Creator Guidelines and Creator Agreement.</a></p>
      </section>
      <section>
        <h2>6. Intellectual property and external content</h2>
        <p>You must have the necessary rights or permissions for content you submit or publish. Video links and embedded or externally hosted material may be controlled by third parties. Viewers Tube does not claim ownership of third-party content merely by linking to it.</p>
      </section>
      <section>
        <h2>7. Availability and account restrictions</h2>
        <p>We may take reasonable steps to protect the platform, users, and services, including restricting access when there is a confirmed violation, security concern, or legal requirement. We do not guarantee uninterrupted or error-free availability.</p>
      </section>
      <section>
        <h2>8. Changes to these terms</h2>
        <p>These terms may be updated as Viewers Tube develops. The current version and effective date will be published on this page. Continued use after an update means you accept the updated terms to the extent permitted by applicable law.</p>
      </section>
      <section>
        <h2>9. Contact</h2>
        <p>For questions about these terms, use the public contact channels listed on the Viewers Tube homepage.</p>
      </section>
      <p className="text-sm text-slate-400">These terms are a general platform draft and should be reviewed for compliance with the laws applicable to the platform and its operator.</p>
    </SiteInfoPage>
  );
}
