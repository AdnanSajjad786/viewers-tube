import SiteInfoPage from "@/components/SiteInfoPage";

export default function AboutPage() {
  return (
    <SiteInfoPage title="About Viewers Tube" subtitle="Watch · Create · Share">
      <section>
        <h2>Our purpose</h2>
        <p>Viewers Tube is a video discovery and viewing platform built to help people explore videos, discover creators, and connect with content from across the online world.</p>
      </section>
      <section>
        <h2>What you can do</h2>
        <ul>
          <li>Discover videos and explore content categories.</li>
          <li>Find creators and their channels.</li>
          <li>Watch videos and follow links to supported video platforms.</li>
          <li>Create an account and use the features available to your account type.</li>
        </ul>
      </section>
      <section>
        <h2>Our community</h2>
        <p>We want Viewers Tube to be a useful, respectful, and responsible place for viewers and creators. Our Creator Agreement explains the content standards and moderation rules that apply to creators.</p>
        <p><a href="/creator-guidelines">Read the Creator Guidelines</a></p>
      </section>
      <section>
        <h2>Founder</h2>
        <p>Viewers Tube was created and founded by <strong>Adnan Sajjad</strong>.</p>
      </section>
    </SiteInfoPage>
  );
}
