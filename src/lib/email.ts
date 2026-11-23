import nodemailer from "nodemailer";

export async function sendVerificationEmail(to: string, url: string) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!user || !password) {
    throw new Error("Gmail SMTP credentials are missing.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass: password,
    },
  });

  await transporter.sendMail({
    from: `"Viewers Tube" <${user}>`,
    to,
    subject: "Verify your Viewers Tube email address",
    text: `Welcome to Viewers Tube!\n\nPlease verify your email address by opening this link:\n\n${url}\n\nThis link expires in one hour. If you did not create this account, you can ignore this email.`,
  });
}


export async function sendModerationNotice(
  to: string,
  details: {
    strikeNumber: number;
    reason: string;
    suspensionDays: number;
    suspensionEndsAt: Date | null;
    terminated: boolean;
    appealInstructions: string;
  }
) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!user || !password) {
    throw new Error("Gmail SMTP credentials are missing.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
  });

  const action = details.terminated
    ? "Your Creator privileges have been terminated after the fourth confirmed strike."
    : `Your Creator upload privileges are suspended for ${details.suspensionDays} days.`;

  await transporter.sendMail({
    from: `"Viewers Tube" <${user}>`,
    to,
    subject: `Viewers Tube Creator moderation notice — Strike ${details.strikeNumber}`,
    text:
      `A moderation decision has been recorded on your Viewers Tube Creator account.\n\n` +
      `Strike: ${details.strikeNumber}\n` +
      `Reason: ${details.reason}\n\n` +
      `${action}\n` +
      (details.suspensionEndsAt
        ? `Suspension ends: ${details.suspensionEndsAt.toISOString()}\n`
        : "") +
      `\n${details.appealInstructions}\n\n` +
      `If you believe this decision is incorrect, you may submit an appeal through your Creator account.\n`,
  });
}


export async function sendContactMessage(details: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!user || !password) {
    throw new Error("Gmail SMTP credentials are missing.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
  });

  await transporter.sendMail({
    from: `"Viewers Tube Contact" <${user}>`,
    to: user,
    replyTo: details.email,
    subject: `[Viewers Tube Contact] ${details.subject}`,
    text:
      `A new message was submitted through the Viewers Tube contact form.\n\n` +
      `Name: ${details.name}\n` +
      `Email: ${details.email}\n` +
      `Subject: ${details.subject}\n\n` +
      `Message:\n${details.message}\n`,
  });
}

export async function sendCreatorApplicationSubmitted(
  to: string,
  details: { displayName: string; email: string; username: string }
) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user || !password) throw new Error("Gmail SMTP credentials are missing.");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user, pass: password },
  });
  await transporter.sendMail({
    from: `"Viewers Tube" <${user}>`,
    to,
    subject: "New Creator application — Viewers Tube",
    text: `A Creator application is awaiting review.\n\nName: ${details.displayName}\nUsername: ${details.username}\nApplicant email: ${details.email}\n\nReview it in the Viewers Tube Admin dashboard.`,
  });
}


export async function sendCreatorApplicationDecision(
  to: string,
  details: { displayName: string; decision: "APPROVED" | "REJECTED"; note: string }
) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user || !password) throw new Error("Gmail SMTP credentials are missing.");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: password },
  });
  const approved = details.decision === "APPROVED";
  await transporter.sendMail({
    from: `"Viewers Tube" <${user}>`,
    to,
    subject: approved
      ? "Congratulations! Your Viewers Tube Creator Application Is Approved"
      : "Viewers Tube Creator Application Update",
    text: approved
      ? `Hello ${details.displayName},\n\nCongratulations!\n\nYour Creator application has been successfully reviewed and approved by the Viewers Tube Admin.\n\nYour email address is verified, your Backblaze B2 storage is connected, and your Creator account is now approved.\n\nYou can now access your Creator features and start sharing your content on Viewers Tube.\n\nWelcome to the Viewers Tube Creator community!\n\nBest regards,\nViewers Tube Admin Team`
      : `Hello ${details.displayName},\n\nYour Creator application was not approved.\n\n${details.note ? `Admin note: ${details.note}\n\n` : ""}If you have questions, please contact Viewers Tube Support.\n\nViewers Tube Team`,
  });
}


export async function sendAdminCreatorApplicationDecision(
  to: string,
  details: {
    creatorName: string;
    creatorEmail: string;
    decision: "APPROVED" | "REJECTED";
    note: string;
    reviewedAt: Date;
  }
) {
  const approved = details.decision === "APPROVED";
  await sendCreatorWorkflowEmail(
    to,
    approved
      ? `Creator Account Approved — ${details.creatorName}`
      : `Creator Application Rejected — ${details.creatorName}`,
    `An Admin has reviewed a Creator application.\n\nCreator: ${details.creatorName}\nCreator email: ${details.creatorEmail}\nDecision: ${details.decision}\nAdmin note: ${details.note || "No note provided."}\nReview date/time: ${details.reviewedAt.toISOString()}\n\n${approved ? "The Creator account is now approved and active." : "The Creator application was rejected. The account remains a Viewer."}\n\nViewers Tube Admin Team`
  );
}

async function sendCreatorWorkflowEmail(to: string, subject: string, text: string) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;
  if (!user || !password) throw new Error("Gmail SMTP credentials are missing.");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: password },
  });
  await transporter.sendMail({
    from: `"Viewers Tube" <${user}>`, to, subject, text,
  });
}

const creatorAdminDashboardUrl = () =>
  `${process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3001"}/admin/creators`;

export async function sendCreatorEmailVerified(to: string, creatorName: string) {
  await sendCreatorWorkflowEmail(
    to,
    "Your Viewers Tube Email Is Verified",
    `Hello ${creatorName},\n\nYour email address has been successfully verified.\n\nThank you for joining Viewers Tube. Your Creator application is not yet approved. Please complete your Backblaze B2 storage connection and wait for Admin review.\n\nWe will notify you when your application status changes.\n\nRegards,\nViewers Tube Team`
  );
}

export async function sendAdminCreatorEmailVerified(
  to: string,
  details: {
    displayName: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    username: string;
    email: string;
    country: string;
    verifiedAt: Date;
  }
) {
  await sendCreatorWorkflowEmail(
    to,
    `Creator Email Verified — ${details.displayName}`,
    `A Creator applicant has verified their email address.\n\nName: ${details.displayName}\nFirst name: ${details.firstName}\nLast name: ${details.lastName}\nDate of birth: ${details.dateOfBirth}\nGender: ${details.gender}\nUsername: ${details.username}\nEmail: ${details.email}\nCountry: ${details.country}\nVerification date/time: ${details.verifiedAt.toISOString()}\nApplication status: Pending Admin approval\n\nThe applicant must connect and verify Backblaze B2 storage before approval. Review the application manually in the Admin dashboard:\n${creatorAdminDashboardUrl()}`
  );
}

export async function sendCreatorStorageVerified(to: string, creatorName: string) {
  await sendCreatorWorkflowEmail(
    to,
    "Backblaze Storage Connected — Application Awaiting Approval",
    `Hello ${creatorName},\n\nYour Backblaze B2 storage has been successfully connected and verified with Viewers Tube.\n\nYour Creator application is now ready for Admin review.\n\nPlease note that your Creator privileges will become active only after Admin approval.\n\nThank you for completing this step!`
  );
}

export async function sendAdminCreatorStorageVerified(
  to: string,
  details: { displayName: string; username: string; email: string; bucketName: string; region: string; verifiedAt: Date }
) {
  await sendCreatorWorkflowEmail(
    to,
    `Creator Application Ready for Review — ${details.displayName}`,
    `A Creator applicant has completed Backblaze B2 storage verification.\n\nName: ${details.displayName}\nUsername: ${details.username}\nEmail: ${details.email}\nBucket: ${details.bucketName}\nRegion: ${details.region}\nStorage status: Verified\nVerification date/time: ${details.verifiedAt.toISOString()}\n\nPlease approve or reject the application manually in the Admin dashboard. This email does not contain an approval link.\n${creatorAdminDashboardUrl()}`
  );
}


export async function sendCreatorDirectTerminationNotice(
  to: string,
  details: {
    displayName: string;
    reason: string;
    evidenceReference?: string | null;
  }
) {
  const user = process.env.GMAIL_USER;
  const password = process.env.GMAIL_APP_PASSWORD;

  if (!user || !password) {
    throw new Error("Gmail SMTP credentials are missing.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
  });

  await transporter.sendMail({
    from: `"Viewers Tube" <${user}>`,
    to,
    subject: "Important: Viewers Tube Creator account termination",
    text:
      `Hello ${details.displayName},\n\n` +
      `An Admin has terminated the Creator privileges on your Viewers Tube account following a review.\n\n` +
      `Reason: ${details.reason}\n` +
      (details.evidenceReference
        ? `Evidence/reference: ${details.evidenceReference}\n`
        : "") +
      `\nYour account's Creator features are now restricted. You may sign in and submit an appeal from your Account page. ` +
      `An appeal will be reviewed by an Admin. Submitting an appeal does not automatically restore Creator access.\n\n` +
      `Viewers Tube Support\n`,
  });
}
