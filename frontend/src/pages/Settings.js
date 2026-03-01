import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { alpha, useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardContent, Button } from '../components/ui';
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
  const theme = useTheme();

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
        description="Customize your trading experience"
      />

      <Section>
        {saved && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Settings saved
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 3fr' }, gap: 3 }}>
          {/* Sidebar */}
          <List disablePadding>
            {[
              { id: 'general', label: 'General', icon: '\u2699\uFE0F' },
              { id: 'notifications', label: 'Notifications', icon: '\uD83D\uDD14' },
              { id: 'api', label: 'Broker', icon: '\uD83D\uDD11' },
              { id: 'display', label: 'Display', icon: '\uD83C\uDFA8' },
              { id: 'data', label: 'Data & Privacy', icon: '\uD83D\uDD12' },
            ].map(item => (
              <ListItemButton
                key={item.id}
                selected={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  ...(activeTab === item.id && {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                  }),
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, fontSize: '1.25rem' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>

          {/* Content */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              {activeTab === 'general' && (
                <Stack spacing={3}>
                  <Typography variant="h6">General Settings</Typography>
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Default Index
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={settings.defaultIndex || 'NIFTY'}
                        onChange={(e) => update('defaultIndex', e.target.value)}
                        sx={{ maxWidth: 300 }}
                        fullWidth
                      >
                        <MenuItem value="NIFTY">NIFTY</MenuItem>
                        <MenuItem value="BANKNIFTY">BANKNIFTY</MenuItem>
                        <MenuItem value="FINNIFTY">FINNIFTY</MenuItem>
                      </TextField>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Default Expiry
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={settings.defaultExpiry || 'Weekly'}
                        onChange={(e) => update('defaultExpiry', e.target.value)}
                        sx={{ maxWidth: 300 }}
                        fullWidth
                      >
                        <MenuItem value="Weekly">Weekly</MenuItem>
                        <MenuItem value="Monthly">Monthly</MenuItem>
                      </TextField>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Timezone
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value="Asia/Kolkata (IST)"
                        disabled
                        sx={{ maxWidth: 300 }}
                        fullWidth
                      >
                        <MenuItem value="Asia/Kolkata (IST)">Asia/Kolkata (IST)</MenuItem>
                      </TextField>
                    </Box>
                  </Stack>
                </Stack>
              )}

              {activeTab === 'notifications' && (
                <Stack spacing={3}>
                  <Typography variant="h6">Notification Preferences</Typography>
                  <Stack spacing={2}>
                    {[
                      { key: 'notif_signals', label: 'Signal Alerts', desc: 'Get notified when new signals are generated' },
                      { key: 'notif_price', label: 'Price Alerts', desc: 'Notifications when prices hit your targets' },
                      { key: 'notif_news', label: 'Market News', desc: 'Breaking news and important updates' },
                      { key: 'notif_summary', label: 'Daily Summary', desc: 'End of day performance summary' },
                    ].map(item => (
                      <Box
                        key={item.key}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 2,
                          borderRadius: 2,
                          bgcolor: 'background.default',
                        }}
                      >
                        <Box>
                          <Typography fontWeight={500}>{item.label}</Typography>
                          <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                        </Box>
                        <Switch
                          checked={settings[item.key] !== false}
                          onChange={() => toggleSetting(item.key)}
                          color="primary"
                        />
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              )}

              {activeTab === 'api' && (
                <Stack spacing={3}>
                  <Typography variant="h6">Broker Connection</Typography>
                  <Alert severity="info">
                    Connect your broker securely from the Algo Trading page. Your access token is stored locally and never shared.
                  </Alert>
                  <Stack spacing={2}>
                    {localStorage.getItem('ms_connected_broker') ? (
                      <Alert severity="success">
                        <Typography fontWeight={500}>
                          {localStorage.getItem('ms_connected_broker')?.toUpperCase()} Connected
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {localStorage.getItem('ms_is_sandbox') === 'true' ? 'Sandbox Mode' : 'Live Mode'}
                        </Typography>
                      </Alert>
                    ) : (
                      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                        <Typography color="text.secondary">No broker connected</Typography>
                      </Box>
                    )}
                    <Box>
                      <Button onClick={() => navigate('/algo')}>
                        {localStorage.getItem('ms_connected_broker') ? 'Manage Connection' : 'Connect Broker'}
                      </Button>
                    </Box>
                  </Stack>
                </Stack>
              )}

              {activeTab === 'display' && (
                <Stack spacing={3}>
                  <Typography variant="h6">Display Settings</Typography>
                  <Stack spacing={2.5}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Theme
                      </Typography>
                      <Stack direction="row" spacing={2}>
                        <Box
                          onClick={() => update('theme', 'dark')}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: 1,
                            borderColor: settings.theme !== 'light' ? 'primary.main' : 'divider',
                            width: 96,
                            textAlign: 'center',
                            cursor: 'pointer',
                            bgcolor: '#000',
                            color: settings.theme !== 'light' ? '#fff' : alpha('#fff', 0.5),
                          }}
                        >
                          Dark
                        </Box>
                        <Box
                          onClick={() => update('theme', 'light')}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: 1,
                            borderColor: settings.theme === 'light' ? 'primary.main' : 'divider',
                            width: 96,
                            textAlign: 'center',
                            cursor: 'pointer',
                            bgcolor: '#fff',
                            color: settings.theme === 'light' ? '#000' : alpha('#000', 0.5),
                          }}
                        >
                          Light
                        </Box>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Dark theme is recommended for trading
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>Compact Mode</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Reduce spacing for more data on screen
                        </Typography>
                      </Box>
                      <Switch
                        checked={!!settings.compactMode}
                        onChange={() => toggleSetting('compactMode')}
                        color="primary"
                      />
                    </Box>
                  </Stack>
                </Stack>
              )}

              {activeTab === 'data' && (
                <Stack spacing={3}>
                  <Typography variant="h6">Data & Privacy</Typography>
                  <Stack spacing={2}>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                      <Typography fontWeight={500} sx={{ mb: 0.5 }}>Your Data</Typography>
                      <Typography variant="body2" color="text.secondary">
                        All data is stored locally in your browser. Nothing is sent to external servers except broker API calls you initiate.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
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
                        sx={{
                          color: 'error.main',
                          borderColor: alpha(theme.palette.error.main, 0.3),
                          '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) },
                        }}
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
                    </Stack>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>
      </Section>
    </PageLayout>
  );
}
