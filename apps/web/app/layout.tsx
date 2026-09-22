import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "../components/app-chrome";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "DealOS",
    template: "%s | DealOS",
  },
  description: "A secure marketplace for buying and selling Nigerian digital businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
