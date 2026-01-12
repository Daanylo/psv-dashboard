import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function HelpPage() {
  return (
    <main className="max-w-screen-2xl mx-auto px-6 py-8 space-y-6">
      <section>
        <h1 className="text-2xl font-bold font-psv-branding">HELP</h1>
        <div className="mt-4">
          <Card className="rounded-none shadow-none">
            <CardHeader className="px-4 pb-2 pt-0">
              <CardTitle className="text-base font-semibold font-psv-branding">Support</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        </div>
      </section>
    </main>
  )
}
