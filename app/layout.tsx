import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "@/styles/globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PSV Dashboard",
  description: "Dashboard voor PSV inzichten",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={`${openSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
