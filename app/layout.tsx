import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Task management application with visual kanban board",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen touch-manipulation">
        {children}
        <Toaster position="top-center" theme="dark" className="max-sm:left-4 max-sm:right-4 max-sm:top-16" />
      </body>
    </html>
  );
}
