import type { Metadata } from "next";
import Header from "@/components/blocks/header"
import Sidebar from "@/components/sidebar"

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
    <div className="min-h-screen flex bg-white text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
