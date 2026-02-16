import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardContent, Input, Button } from '../components/ui';
import { useConfirm } from '../hooks/useConfirm';

const SETTINGS_KEY = 'ms_settings';

const getSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch { return {}; }
};

const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// Settings Page
export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(getSettings);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const [ConfirmEl, confirm] = useConfirm();

  const update = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSetting = (key) => update(key, !settings[key]);

  return (
    <PageLayout>
      {ConfirmEl}
      <SEO {...getSeoConfig('/settings')} path="/settings" />
      <PageHeader
        title="Settings"
        subtitle="Customize your trading experience"
      />

      <Section>
        {saved && (
          <div className="mb-4 p-3 rounded-lg bg-bullish/10 border border-bullish/20 text-bullish text-sm">
            ✅ Settings saved
          </div>
        )}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-2">
            {[
              { id: 'general', label: 'General', icon: '⚙️' },
              { id: 'notifications', label: 'Notifications', icon: '🔔' },
              { id: 'api', label: 'Broker', icon: '🔑' },
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
                        <select 
                          className="input w-full max-w-xs"
                          value={settings.defaultIndex || 'NIFTY'}
                          onChange={(e) => update('defaultIndex', e.target.value)}
                        >
                          <option>NIFTY</option>
                          <option>BANKNIFTY</option>
                          <option>FINNIFTY</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Default Expiry</label>
                        <select 
                          className="input w-full max-w-xs"
                          value={settings.defaultExpiry || 'Weekly'}
                          onChange={(e) => update('defaultExpiry', e.target.value)}
                        >
                          <option>Weekly</option>
                          <option>Monthly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">Timezone</label>
                        <select className="input w-full max-w-xs" disabled>
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
                        { key: 'notif_signals', label: 'Signal Alerts', desc: 'Get notified when new signals are generated' },
                        { key: 'notif_price', label: 'Price Alerts', desc: 'Notifications when prices hit your targets' },
                        { key: 'notif_news', label: 'Market News', desc: 'Breaking news and important updates' },
                        { key: 'notif_summary', label: 'Daily Summary', desc: 'End of day performance summary' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 rounded-lg bg-background">
                          <div>
                            <div className="font-medium">{item.label}</div>
                            <div className="text-sm text-muted-foreground">{item.desc}</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={settings[item.key] !== false}
                              onChange={() => toggleSetting(item.key)}
                            />
                            <div className="w-11 h-6 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'api' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold">Broker Connection</h3>
                    
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-sm">
                        Connect your broker securely from the Algo Trading page. Your access token is stored locally and never shared.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      {localStorage.getItem('ms_connected_broker') ? (
                        <div className="p-4 rounded-lg bg-bullish/10 border border-bullish/20">
                          <div className="font-medium text-bullish">
                            ✅ {localStorage.getItem('ms_connected_broker')?.toUpperCase()} Connected
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {localStorage.getItem('ms_is_sandbox') === 'true' ? 'Sandbox Mode' : 'Live Mode'}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-background border border-border">
                          <div className="text-muted-foreground">No broker connected</div>
                        </div>
                      )}
                      
                      <Button onClick={() => navigate('/algo')}>
                        {localStorage.getItem('ms_connected_broker') ? 'Manage Connection' : 'Connect Broker'}
                      </Button>
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
                          <button 
                            className={`p-4 rounded-lg border w-24 text-center ${settings.theme !== 'light' ? 'border-primary bg-black text-white' : 'border-border bg-black/50 text-white/50'}`}
                            onClick={() => update('theme', 'dark')}
                          >
                            Dark
                          </button>
                          <button 
                            className={`p-4 rounded-lg border w-24 text-center ${settings.theme === 'light' ? 'border-primary bg-white text-black' : 'border-border bg-white/50 text-black/50'}`}
                            onClick={() => update('theme', 'light')}
                          >
                            Light
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Dark theme is recommended for trading</p>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium block">Compact Mode</label>
                          <p className="text-xs text-muted-foreground">Reduce spacing for more data on screen</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={!!settings.compactMode}
                            onChange={() => toggleSetting('compactMode')}
                          />
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
                      <div className="p-4 rounded-lg bg-background border border-border">
                        <div className="font-medium mb-1">Your Data</div>
                        <p className="text-sm text-muted-foreground">
                          All data is stored locally in your browser. Nothing is sent to external servers except broker API calls you initiate.
                        </p>
                      </div>
                      
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const data = {};
                          for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key.startsWith('ms_')) data[key] = localStorage.getItem(key);
                          }
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `money-saarthi-data-${new Date().toISOString().slice(0,10)}.json`;
                          a.click();
                        }}
                      >
                        Export My Data
                      </Button>
                      <Button 
                        variant="outline" 
                        className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete All Data',
                            message: 'This will delete all your local data including settings, saved signals, and broker tokens. Continue?',
                            confirmText: 'Delete All',
                            variant: 'destructive',
                          });
                          if (ok) {
                            const keysToRemove = [];
                            for (let i = 0; i < localStorage.length; i++) {
                              const key = localStorage.key(i);
                              if (key.startsWith('ms_')) keysToRemove.push(key);
                            }
                            keysToRemove.forEach(k => localStorage.removeItem(k));
                            localStorage.removeItem(SETTINGS_KEY);
                            setSettings({});
                          }
                        }}
                      >
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

