import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  variable: "--font-host-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Room Booker",
    template: "%s · Room Booker",
  },
  description: "Book shared meeting rooms with a clear office schedule.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={hostGrotesk.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
