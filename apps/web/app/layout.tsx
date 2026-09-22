import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "../components/sidebar";
import { Topbar } from "../components/topbar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DealOS",
  description: "Acquisition transaction operations workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">
            <Topbar />
            <div className="content">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
