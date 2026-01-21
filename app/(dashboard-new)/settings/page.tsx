"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type Brand = {
  id: number
  name: string
  slug: string
  color: string
  logo_light: string | null
  logo_dark: string | null
}

export default function SettingsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("brands")
  const [saveStatus, setSaveStatus] = useState<"success" | "error" | null>(null)

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch("/api/new/settings/brands")
        if (res.ok) {
          const data = await res.json()
          setBrands(data)
        }
      } catch (error) {
        console.error("Failed to fetch brands", error)
      } finally {
        setLoading(false)
      }
    }
    fetchBrands()
  }, [])

  const handleUpdate = (id: number, field: keyof Brand, value: string) => {
    setBrands(brands.map(b => b.id === id ? { ...b, [field]: value } : b))
    setSaveStatus(null) 
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus(null)
    try {
      const res = await fetch("/api/new/settings/brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brands),
      })
      
      if (res.ok) {
        setSaveStatus("success")
        setTimeout(() => setSaveStatus(null), 3000)
      } else {
        setSaveStatus("error")
      }
    } catch (error) {
      console.error("Failed to save brands", error)
      setSaveStatus("error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="max-w-screen-xl mx-auto px-6 py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-psv-branding italic">SETTINGS</h1>
        <p className="text-muted-foreground mt-2">Manage dashboard preferences and configuration.</p>
      </div>

      <div className="flex flex-col space-y-6">
          <div className="flex items-center gap-4 border-b border-border pb-px">
            <button
                onClick={() => setActiveTab("brands")}
                className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "brands" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-muted-foreground hover:text-foreground"
                )}
            >
                Brand Configuration
            </button>
            <button
                onClick={() => setActiveTab("general")}
                className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "general" 
                        ? "border-primary text-primary" 
                        : "border-transparent text-muted-foreground hover:text-foreground"
                )}
            >
                General
            </button>
          </div>

          <div className="rounded-xl border border-border bg-background p-6">
            {activeTab === "brands" && (
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold font-psv-branding">Brands</h2>
                        <p className="text-sm text-muted-foreground">Manage colors and logos for reporting.</p>
                    </div>

                    <div className="grid gap-6">
                    {brands.map((brand) => (
                        <div key={brand.id} className="flex flex-col gap-4 p-4 rounded-lg border border-border bg-card/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-base font-semibold">{brand.name}</Label>
                                <p className="text-xs text-muted-foreground font-mono">{brand.slug}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div 
                                    className="w-8 h-8 rounded border shadow-sm" 
                                    style={{ backgroundColor: brand.color }} 
                                />
                                <div className="flex flex-col">
                                    <Label htmlFor={`color-${brand.id}`} className="text-[10px] text-muted-foreground mb-1">Color</Label>
                                    <Input 
                                    id={`color-${brand.id}`}
                                    type="color" 
                                    value={brand.color}
                                    onChange={(e) => handleUpdate(brand.id, 'color', e.target.value)}
                                    className="w-20 h-8 p-1 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor={`logo-light-${brand.id}`} className="text-xs">Light Mode Logo</Label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Input 
                                            id={`logo-light-${brand.id}`}
                                            value={brand.logo_light || ''}
                                            onChange={(e) => handleUpdate(brand.id, 'logo_light', e.target.value)}
                                            placeholder="/sponsor-logos/logo.png"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="w-9 h-9 shrink-0 border rounded bg-white flex items-center justify-center p-1">
                                        {brand.logo_light ? (
                                            <img src={brand.logo_light} alt="preview" className="max-w-full max-h-full object-contain" />
                                        ) : <span className="text-[8px] text-gray-400">Preview</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor={`logo-dark-${brand.id}`} className="text-xs">Dark Mode Logo</Label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Input 
                                            id={`logo-dark-${brand.id}`}
                                            value={brand.logo_dark || ''}
                                            onChange={(e) => handleUpdate(brand.id, 'logo_dark', e.target.value)}
                                            placeholder="/sponsor-logos/logo-white.png"
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="w-9 h-9 shrink-0 border rounded bg-black flex items-center justify-center p-1">
                                        {brand.logo_dark ? (
                                            <img src={brand.logo_dark} alt="preview" className="max-w-full max-h-full object-contain" />
                                        ) : <span className="text-[8px] text-gray-600">Preview</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    ))}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                        {saveStatus === "success" && (
                            <div className="flex items-center gap-2 text-green-600 text-sm animate-in fade-in slide-in-from-right-4">
                                <CheckCircle className="h-4 w-4" />
                                <span>Saved successfully</span>
                            </div>
                        )}
                        {saveStatus === "error" && (
                            <div className="flex items-center gap-2 text-red-600 text-sm animate-in fade-in slide-in-from-right-4">
                                <AlertCircle className="h-4 w-4" />
                                <span>Failed to save</span>
                            </div>
                        )}
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </div>
            )}
            
            {activeTab === "general" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">General Settings</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-2">
                        Global dashboard configuration options will appear here. Currently, only brand management is available.
                    </p>
                </div>
            )}
          </div>
      </div>
    </main>
  )
}
