import SiteInfoPage from "@/components/SiteInfoPage";
import ContactForm from "@/components/ContactForm";

export default function ContactPage() {
  return (
    <SiteInfoPage title="Contact Viewers Tube" subtitle="Questions, feedback, or need help? Send us a message.">
      <section>
        <h2>Send us a message</h2>
        <p>Complete the form below. Your message will be delivered to the Viewers Tube support inbox.</p>
        <ContactForm />
      </section>
      <section>
        <h2>Creator moderation and appeals</h2>
        <p>If you have received a Creator moderation notice, please use the available appeal process in your account. You can read the <a href="/creator-guidelines">Creator Guidelines</a> for more information.</p>
      </section>
      <section>
        <h2>Privacy and account safety</h2>
        <p>For privacy or account questions, choose the appropriate subject above. Never include your password, verification codes, or sensitive payment information in a message.</p>
      </section>
    </SiteInfoPage>
  );
}
