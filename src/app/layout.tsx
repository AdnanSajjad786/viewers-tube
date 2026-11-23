import type { Metadata } from "next";
import "./globals.css";
import { ClientErrorReporter } from "@/app/repair-centre/client-error-reporter";

export const metadata: Metadata = {
  title: "Viewers Tube — Watch · Create · Share",
  description: "Discover extraordinary stories and share your creativity on Viewers Tube, founded by Adnan Sajjad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ClientErrorReporter />{children}</body>
    </html>
  );
}
