import type { Metadata } from "next";
import Header from "@/components/header";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "PSV Dashboard - Logo Detection",
  description: "AI-powered logo detection for Instagram posts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
          <Header />
      <main className="min-h-screen">
            {children}
          </main>
          <Footer />
    </>
  );
}
