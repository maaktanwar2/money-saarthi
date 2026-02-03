import React, { useState } from 'react';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Tabs } from '../components/ui';

// Settings Page
export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <PageLayout>
      <PageHeader
        title="Settings"
        subtitle="Customize your trading experience"
      />

      <Section>
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-2">
            {[
              { id: 'general', label: 'General', icon: '⚙️' },
              { id: 'notifications', label: 'Notifications', icon: '🔔' },
              { id: 'api', label: 'API Keys', icon: '🔑' },
              { id: 'display', label: 'Display', icon: '🎨' },
              { id: 'data', label: 'Data & Privacy', icon: '🔒' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <Card className="glass-card">
              <CardContent className="p-6">
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">General Settings</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Default Index</label>
                        <select className="input w-full max-w-xs">
                          <option>NIFTY</option>
                          <option>BANKNIFTY</option>
                          <option>FINNIFTY</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Default Expiry</label>
                        <select className="input w-full max-w-xs">
                          <option>Weekly</option>
                          <option>Monthly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Timezone</label>
                        <select className="input w-full max-w-xs">
                          <option>Asia/Kolkata (IST)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Notification Preferences</h3>
                    
                    <div className="space-y-4">
                      {[
                        { label: 'Signal Alerts', desc: 'Get notified when new signals are generated' },
                        { label: 'Price Alerts', desc: 'Notifications when prices hit your targets' },
                        { label: 'Market News', desc: 'Breaking news and important updates' },
                        { label: 'Daily Summary', desc: 'End of day performance summary' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between p-4 rounded-lg bg-background">
                          <div>
                            <div className="font-medium">{item.label}</div>
                            <div className="text-sm text-muted-foreground">{item.desc}</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'api' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">API Configuration</h3>
                    
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-yellow-500 text-sm">
                        ⚠️ Keep your API keys secure. Never share them publicly.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Broker</label>
                        <select className="input w-full max-w-xs">
                          <option>Zerodha</option>
                          <option>Upstox</option>
                          <option>Dhan</option>
                          <option>Angel One</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">API Key</label>
                        <Input type="password" placeholder="Enter your API key" className="max-w-md" />
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">API Secret</label>
                        <Input type="password" placeholder="Enter your API secret" className="max-w-md" />
                      </div>
                      
                      <Button className="mt-4">Connect Broker</Button>
                    </div>
                  </div>
                )}

                {activeTab === 'display' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Display Settings</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Theme</label>
                        <div className="flex gap-4">
                          <button className="p-4 rounded-lg border border-border bg-black text-white w-24 text-center">
                            Dark
                          </button>
                          <button className="p-4 rounded-lg border border-border bg-white text-black w-24 text-center">
                            Light
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Compact Mode</label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'data' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Data & Privacy</h3>
                    
                    <div className="space-y-4">
                      <Button variant="outline">Export My Data</Button>
                      <Button variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10">
                        Delete All Data
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>
    </PageLayout>
  );
}
