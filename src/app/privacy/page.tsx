import SiteInfoPage from "@/components/SiteInfoPage";

export default function PrivacyPage() {
  return (
    <SiteInfoPage title="Privacy Policy" subtitle="Effective date: November 12, 2026">
      <p>This Privacy Policy explains how Viewers Tube may collect, use, and protect information when you visit or use the platform. It describes the platform's current intended practices and may be updated as features and services develop.</p>
      <section>
        <h2>1. Information we may collect</h2>
        <ul>
          <li><strong>Account information:</strong> information you provide when registering, such as your name and email address, and your account type (Viewer, Creator, or Admin).</li>
          <li><strong>Authentication information:</strong> session and sign-in information needed to keep your account secure and authenticated.</li>
          <li><strong>Agreement and moderation records:</strong> where applicable, records of Creator Agreement acceptance, agreement version, moderation actions, and appeals.</li>
          <li><strong>Information you send us:</strong> details you choose to provide through support, feedback, reports, or appeals.</li>
          <li><strong>Technical information:</strong> limited technical, diagnostic, and security information may be processed by the systems that host and operate the platform.</li>
        </ul>
      </section>
      <section>
        <h2>2. How information is used</h2>
        <p>Information may be used to operate the website, create and authenticate accounts, provide available features, respond to requests, maintain security, prevent misuse, apply platform rules, and maintain necessary service records.</p>
      </section>
      <section>
        <h2>3. Cookies and sessions</h2>
        <p>Authentication and session technologies may be used to keep you signed in and protect account access. Blocking these technologies may affect features that require an account.</p>
      </section>
      <section>
        <h2>4. Video links and third-party services</h2>
        <p>Viewers Tube may display or link to videos and services operated by other platforms. When you follow an external link or use a third-party service, that provider's own privacy policy and practices apply. We do not control those providers.</p>
      </section>
      <section>
        <h2>5. Sharing and service providers</h2>
        <p>Information may be processed by service providers that help operate, host, secure, or maintain Viewers Tube. Information may also be disclosed when reasonably necessary to comply with applicable law, respond to valid legal requests, protect users, or address security and abuse concerns.</p>
      </section>
      <section>
        <h2>6. Retention and security</h2>
        <p>Information is retained for as long as reasonably necessary for the purposes described in this policy, including account operation, security, moderation, and legal obligations. We use reasonable measures intended to protect information, but no online service can guarantee absolute security.</p>
      </section>
      <section>
        <h2>7. Your choices and requests</h2>
        <p>You should keep your account information accurate and protect your sign-in credentials. You may contact us through the public contact channels listed on the Viewers Tube homepage to ask a privacy question or submit a request concerning your information. Some records may need to be retained for security, moderation, or legal reasons.</p>
      </section>
      <section>
        <h2>8. Policy updates</h2>
        <p>This policy may change as the platform develops. The latest version will be published on this page with its effective date.</p>
      </section>
      <p className="text-sm text-slate-400">This page provides general information about platform privacy practices. It is not a statement that every possible data practice or legal requirement has been independently audited.</p>
    </SiteInfoPage>
  );
}
