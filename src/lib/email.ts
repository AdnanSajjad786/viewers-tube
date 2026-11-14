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
