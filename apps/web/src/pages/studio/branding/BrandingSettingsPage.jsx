import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

export function BrandingSettingsPage() {
  const [brandName, setBrandName] = useState('Aurora Fine Art Photography');
  const [primaryColor, setPrimaryColor] = useState('#2563EB');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Branding & White-Labeling</h2>
        <p className="text-sm text-muted">Customize client-facing galleries, color accents, and logos.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Studio Identity</CardTitle>
            <CardDescription>Your brand will replace all platform references for your clients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Studio Brand Name</label>
              <Input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted">Primary Brand Color (Hex)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 rounded border border-border cursor-pointer bg-transparent"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>

            <Button className="mt-2">Save Branding</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Customer Portal Preview</CardTitle>
            <CardDescription>Simulated view with your brand color applied</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-lg p-4 bg-surface-2 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="font-bold text-sm" style={{ color: primaryColor }}>{brandName}</span>
                <span className="text-xs text-muted">Client Portal</span>
              </div>
              <div className="h-28 rounded bg-surface flex items-center justify-center text-xs text-muted">
                Branded Gallery Grid
              </div>
              <button
                style={{ backgroundColor: primaryColor }}
                className="w-full py-2 rounded text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Download Full Gallery
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
