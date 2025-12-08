import type { Metadata } from "next";
import Header from "@/components/blocks/header"

export const metadata: Metadata = {
  title: "PSV Dashboard",
  description: "Dashboard for PSV insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main className="min-h-screen text-foreground bg-secondary">
        {children}
      </main>
    </>
  );
}
