import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { currentLearner } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "IdiomsMasterGirl",
  description: "One English idiom a day – learn it, say it, write it.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const learner = await currentLearner();
  return (
    <html lang="en">
      <body>
        {learner && (
          <header className="topbar">
            <Link href="/session" className="brand">
              <span aria-hidden>💬</span> IdiomsMasterGirl
            </Link>
            <nav aria-label="Main">
              <Link href="/session">Today</Link>
              <Link href="/progress">Progress</Link>
              <Link href="/settings">Settings</Link>
              <SignOutButton />
            </nav>
          </header>
        )}
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
