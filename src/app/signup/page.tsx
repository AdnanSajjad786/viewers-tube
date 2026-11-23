"use client";
import { MemberPageHeader, MemberPageFooter } from "@/components/member-page-chrome";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupType, setSignupType] = useState<"VIEWER" | "CREATOR">("VIEWER");
  const [creatorAgreementAccepted, setCreatorAgreementAccepted] = useState(false);
  const [showCreatorAgreement, setShowCreatorAgreement] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError("Username must be 3–24 characters: letters, numbers or underscores.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (signupType === "CREATOR" &&
        (!firstName.trim() || !lastName.trim() || !dateOfBirth || !gender || !country.trim())) {
      setError("Complete your first name, surname, date of birth, gender and country.");
      return;
    }
    if (signupType === "CREATOR" && !creatorAgreementAccepted) {
      setError("You must accept the Creator Agreement before registering as a Creator.");
      return;
    }

    setBusy(true);
    try {
      const result = await authClient.signUp.email({
        name: signupType === "CREATOR"
          ? `${firstName.trim()} ${lastName.trim()}`
          : name.trim(),
        username: cleanUsername,
        email: email.trim(),
        password,
        signupType,
        ...(signupType === "CREATOR"
          ? {
              creatorAgreementVersion: "VIEWERS_TUBE_CREATOR_2026_02",
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              dateOfBirth,
              gender,
              country: country.trim(),
            }
          : {}),
        callbackURL: "/account",
      });

      if (result.error) {
        setError(result.error.message || "Unable to create your account.");
      } else {
        router.push("/account");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MemberPageHeader variant="auth" />
<main className="min-h-screen bg-[#080b13] px-5 py-12 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Viewers Tube
        </Link>
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Join the community
          </p>
          <h1 className="mt-3 text-3xl font-bold">Create your free account</h1>
          <p className="mt-2 text-sm text-slate-400">
            Discover videos, build your channel and connect with creators.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Choose your account type</p>
              <div className="grid grid-cols-2 gap-3">
                <label className={`cursor-pointer rounded-xl border p-3 ${signupType === "VIEWER" ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-black/20"}`}>
                  <input type="radio" name="signupType" value="VIEWER"
                    checked={signupType === "VIEWER"}
                    onChange={() => setSignupType("VIEWER")}
                    className="mr-2 accent-cyan-400" />
                  <span className="font-semibold">Viewer</span>
                  <p className="mt-1 text-xs text-slate-400">Watch, discover and follow videos.</p>
                </label>
                <label className={`cursor-pointer rounded-xl border p-3 ${signupType === "CREATOR" ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-black/20"}`}>
                  <input type="radio" name="signupType" value="CREATOR"
                    checked={signupType === "CREATOR"}
                    onChange={() => setSignupType("CREATOR")}
                    className="mr-2 accent-cyan-400" />
                  <span className="font-semibold">Creator</span>
                  <p className="mt-1 text-xs text-slate-400">Create your channel and prepare to publish.</p>
                </label>
              </div>
            </div>
            {signupType === "VIEWER" ? (
              <label className="block text-sm">
                Display name
                <input required minLength={2} maxLength={60} value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                  placeholder="Your name" />
              </label>
            ) : (
              <section className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <h2 className="text-sm font-semibold text-cyan-200">Creator profile</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    First name
                    <input required maxLength={60} value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 outline-none focus:border-cyan-400"
                      placeholder="First name" />
                  </label>
                  <label className="block text-sm">
                    Surname
                    <input required maxLength={60} value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 outline-none focus:border-cyan-400"
                      placeholder="Last name" />
                  </label>
                </div>
                <label className="block text-sm">
                  Date of birth
                  <input required type="date" value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 outline-none focus:border-cyan-400" />
                  <span className="mt-1 block text-xs text-slate-400">Required for profile records. No minimum-age cutoff is applied by this form.</span>
                </label>
                <label className="block text-sm">
                  Gender
                  <select required value={gender} onChange={(e) => setGender(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#111827] px-3 py-3 outline-none focus:border-cyan-400">
                    <option value="">Choose an option</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Country
                  <input required list="creator-country-options" value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    autoComplete="country-name"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 outline-none focus:border-cyan-400"
                    placeholder="Type to search your country" />
                  <datalist id="creator-country-options">
                    {["Afghanistan","Argentina","Australia","Austria","Bangladesh","Belgium","Brazil","Canada","China","Denmark","Egypt","France","Germany","India","Indonesia","Iran","Iraq","Ireland","Italy","Japan","Kenya","Malaysia","Nepal","Netherlands","New Zealand","Nigeria","Pakistan","Philippines","Qatar","Saudi Arabia","Singapore","South Africa","South Korea","Spain","Sri Lanka","Sweden","Switzerland","Turkey","United Arab Emirates","United Kingdom","United States"].map((item) => <option key={item} value={item} />)}
                  </datalist>
                </label>
              </section>
            )}
            <label className="block text-sm">
              Username
              <input required minLength={3} maxLength={24} value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="your_username" />
            </label>
            <label className="block text-sm">
              Email address
              <input required type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="you@example.com" />
            </label>
            <label className="block text-sm">
              Password
              <input required type="password" minLength={8} maxLength={128} value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="At least 8 characters" />
            </label>

            {signupType === "CREATOR" && (
              <section className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-cyan-200">Creator Agreement</h2>
                    <p className="mt-1 text-xs text-slate-400">Review the publishing rules before applying.</p>
                  </div>
                  <button type="button" onClick={() => setShowCreatorAgreement(true)}
                    className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10">
                    Review agreement
                  </button>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" checked={creatorAgreementAccepted}
                    onChange={(event) => setCreatorAgreementAccepted(event.target.checked)}
                    className="mt-1 accent-cyan-400" />
                  <span>
                    I have read and agree to the Viewers Tube Creator Agreement.
                    <span className="mt-1 block text-xs text-slate-400">Required · Version: VIEWERS_TUBE_CREATOR_2026_02</span>
                  </span>
                </label>
                {!creatorAgreementAccepted && <p className="mt-2 text-xs text-amber-200">Acceptance is required before submitting your Creator application.</p>}
              </section>
            )}

            {showCreatorAgreement && signupType === "CREATOR" && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
                onClick={(event) => { if (event.target === event.currentTarget) setShowCreatorAgreement(false); }}>
                <section role="dialog" aria-modal="true" aria-labelledby="creator-agreement-title"
                  className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#101827] p-5 text-white shadow-2xl sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 id="creator-agreement-title" className="text-xl font-bold text-cyan-200">Viewers Tube Creator Agreement</h2>
                      <p className="mt-1 text-xs text-slate-400">Version: VIEWERS_TUBE_CREATOR_2026_02</p>
                    </div>
                    <button type="button" onClick={() => setShowCreatorAgreement(false)}
                      className="rounded-lg border border-white/15 px-3 py-1 text-slate-300">Close</button>
                  </div>
                  <div className="mt-5 space-y-4 text-sm leading-6 text-slate-300">
                    <p>By applying as a Creator, you agree to follow these rules and applicable laws:</p>
                    <ul className="list-disc space-y-2 pl-5">
                      <li>No nudity, pornography, or sexually explicit material.</li>
                      <li>No obscene, excessively profane, abusive, threatening, or harassing content.</li>
                      <li>No hate, exploitation, child sexual abuse material, or promotion of violence.</li>
                      <li>No illegal material, scams, spam, deliberate impersonation, or deliberately misleading content.</li>
                      <li>Only publish content you own or are legally authorized to use. Respect privacy, intellectual property, and other people&apos;s rights.</li>
                      <li>Do not evade moderation, suspensions, or account restrictions using another account.</li>
                      <li>Peaceful political opinions and debate are allowed. Hate, threats, intimidation, harassment, targeted abuse, incitement to violence, and deliberately deceptive political content presented as fact may be moderated.</li>
                      <li>Provide truthful account and profile information. Deliberate identity fraud or impersonation may result in termination after evidence-based review. Names, email addresses, or assumptions about gender alone are not proof of fraud.</li>
                    </ul>
                    <h3 className="font-semibold text-white">Strikes and account action</h3>
                    <p>Confirmed violations may result in content removal and Creator upload suspensions: first strike 7 days, second 14 days, third 30 days, and fourth strike termination of Creator privileges.</p>
                    <p>Serious violations, deliberate identity fraud, or repeated abuse may result in account termination after review. You will receive notice of an enforcement decision and may appeal it.</p>
                    <p>Reports or automated detection alone do not establish a violation. Enforcement requires confirmation through the platform&apos;s moderation process.</p>
                    <p>Read the <a href="/creator-guidelines" target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 underline">full Creator Guidelines</a> for complete policy and appeal information.</p>
                  </div>
                  <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
                    <button type="button" onClick={() => setShowCreatorAgreement(false)}
                      className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300">Close</button>
                    <button type="button" onClick={() => { setCreatorAgreementAccepted(true); setShowCreatorAgreement(false); }}
                      className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300">I agree</button>
                  </div>
                </section>
              </div>
            )}

            {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            <button disabled={busy} type="submit"
              className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">
              {busy ? "Creating account…" : "Create free account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already registered? <Link className="text-cyan-300 hover:underline" href="/login">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
      <MemberPageFooter />
    </>
  );
}
