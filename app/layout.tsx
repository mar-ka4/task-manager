import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Task management application with visual kanban board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body>
        {children}
        <Toaster position="top-right" theme="dark" />
      </body>
    </html>
  );
}
