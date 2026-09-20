import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://eduflow-ai-wzks.onrender.com"),
  title: { default: "EduFlow AI | School Management Platform", template: "%s | EduFlow AI" },
  description: "A secure, role-based school management platform for students, academics, attendance, exams, finance, staff, communication and AI-assisted operations.",
  applicationName: "EduFlow AI",
  keywords: ["school ERP","school management","student management","attendance","school AI"],
  robots: { index: true, follow: true },
  openGraph: {
    title: "EduFlow AI | School Management Platform",
    description: "Run your school from one secure command center.",
    type: "website",
    siteName: "EduFlow AI",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
