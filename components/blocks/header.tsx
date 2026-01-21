import Image from "next/image"

export default function Header() {
  return (
    <header className="bg-background border-b">
      <div className="w-full max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-3">
        <Image src="/sponsor-logos/psv-logo.svg" alt="PSV logo" width={70} height={50} priority />
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-semibold text-primary font-psv-branding italic">Dashboard</span>
          <span className="text-xs text-secondary-foreground">Updated every 2 weeks</span>
        </div>
      </div>
    </header>
  )
}