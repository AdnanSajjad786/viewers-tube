import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viewers Tube — Watch · Create · Share",
  description: "Discover extraordinary stories and share your creativity on Viewers Tube, founded by Adnan Sajjad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
