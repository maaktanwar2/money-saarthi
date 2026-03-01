import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import SEO from '../components/SEO';
import { getSeoConfig } from '../lib/seoConfig';
import { PageLayout, PageHeader, Section } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Tabs } from '../components/ui';
import { formatINR } from '../lib/utils';
import { Trash2 } from 'lucide-react';

const STORAGE_KEY = 'ms_trading_journal';

const loadTrades = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
};

const saveTrades = (trades) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
};

const EMPTY_FORM = { date: '', symbol: '', type: 'BUY', entry: '', exit: '', qty: '', notes: '' };

// Trading Journal Page — localStorage-backed, zero mock data
export default function TradingJournal() {
  const [activeTab, setActiveTab] = useState('trades');
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const theme = useTheme();

  useEffect(() => { setTrades(loadTrades()); }, []);

  // Derived stats from real trades
  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);
    const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0;
    const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
    const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    return {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? ((wins.length / trades.length) * 100).toFixed(1) : 0,
      avgWin,
      avgLoss,
      profitFactor: grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? '\u221E' : '0',
      totalPnL,
    };
  }, [trades]);

  const handleSave = useCallback(() => {
    setFormError('');
    if (!form.date || !form.symbol || !form.entry || !form.qty) {
      setFormError('Please fill date, symbol, entry price and quantity.');
      return;
    }
    const entry = parseFloat(form.entry);
    const exit = form.exit ? parseFloat(form.exit) : null;
    const qty = parseInt(form.qty, 10);
    if (isNaN(entry) || isNaN(qty) || qty <= 0) {
      setFormError('Entry and quantity must be valid numbers.');
      return;
    }
    const pnl = exit !== null
      ? (form.type === 'BUY' ? (exit - entry) * qty : (entry - exit) * qty)
      : 0;
    const newTrade = {
      id: Date.now(),
      date: form.date,
      symbol: form.symbol.toUpperCase(),
      type: form.type,
      entry,
      exit,
      qty,
      pnl: Math.round(pnl),
      notes: form.notes,
    };
    const updated = [newTrade, ...trades];
    setTrades(updated);
    saveTrades(updated);
    setForm(EMPTY_FORM);
    setActiveTab('trades');
  }, [form, trades]);

  const handleDelete = useCallback((id) => {
    const updated = trades.filter(t => t.id !== id);
    setTrades(updated);
    saveTrades(updated);
  }, [trades]);

  // Day-of-week analysis from real trades
  const dayAnalysis = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = {};
    trades.forEach(t => {
      const d = new Date(t.date);
      const dayName = days[d.getDay()];
      if (!grouped[dayName]) grouped[dayName] = { wins: 0, total: 0 };
      grouped[dayName].total++;
      if (t.pnl > 0) grouped[dayName].wins++;
    });
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      .map(day => ({
        day,
        winRate: grouped[day] ? Math.round((grouped[day].wins / grouped[day].total) * 100) : null,
        trades: grouped[day]?.total || 0,
      }));
  }, [trades]);

  return (
    <PageLayout>
      <SEO {...getSeoConfig('/journal')} path="/journal" />
      <PageHeader
        title="Trading Journal"
        description="Track, analyze, and improve your trading performance"
      />

      {/* Stats Overview — derived from real trades */}
      <Section>
        {stats ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 2, mb: 4 }}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700}>{stats.totalTrades}</Typography>
              <Typography variant="caption" color="text.secondary">Total Trades</Typography>
            </Card>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color="success.main">{stats.winRate}%</Typography>
              <Typography variant="caption" color="text.secondary">Win Rate</Typography>
            </Card>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color="success.main">{formatINR(stats.avgWin)}</Typography>
              <Typography variant="caption" color="text.secondary">Avg Win</Typography>
            </Card>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color="error.main">{formatINR(stats.avgLoss)}</Typography>
              <Typography variant="caption" color="text.secondary">Avg Loss</Typography>
            </Card>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700}>{stats.profitFactor}</Typography>
              <Typography variant="caption" color="text.secondary">Profit Factor</Typography>
            </Card>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} sx={{ color: stats.totalPnL >= 0 ? 'success.main' : 'error.main' }}>
                {formatINR(stats.totalPnL)}
              </Typography>
              <Typography variant="caption" color="text.secondary">Total P&L</Typography>
            </Card>
          </Box>
        ) : (
          <Card sx={{ p: 4, textAlign: 'center', mb: 4 }}>
            <Typography color="text.secondary" sx={{ mb: 1 }}>No trades logged yet.</Typography>
            <Button onClick={() => setActiveTab('add')}>Log Your First Trade</Button>
          </Card>
        )}

        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'trades', label: `Recent Trades (${trades.length})` },
            { id: 'add', label: '+ Add Trade' },
            { id: 'analysis', label: 'Analysis' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Trades Table */}
        {activeTab === 'trades' && (
          <Card sx={{ mt: 3 }}>
            <CardContent sx={{ p: 0 }}>
              {trades.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No trades yet. Click "+ Add Trade" to log your first trade.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Symbol</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Entry</TableCell>
                        <TableCell align="right">Exit</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">P&L</TableCell>
                        <TableCell>Notes</TableCell>
                        <TableCell padding="checkbox" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trades.map(trade => (
                        <TableRow key={trade.id} hover>
                          <TableCell>{trade.date}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant={trade.type === 'BUY' ? 'success' : 'error'}>
                              {trade.type}
                            </Badge>
                          </TableCell>
                          <TableCell align="right">{formatINR(trade.entry)}</TableCell>
                          <TableCell align="right">{trade.exit !== null ? formatINR(trade.exit) : '\u2014'}</TableCell>
                          <TableCell align="right">{trade.qty}</TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 500,
                              color: trade.pnl >= 0 ? 'success.main' : 'error.main',
                            }}
                          >
                            {trade.exit !== null ? formatINR(trade.pnl) : 'Open'}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                            {trade.notes}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => handleDelete(trade.id)}
                              size="small"
                              title="Delete trade"
                              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                            >
                              <Trash2 style={{ width: 16, height: 16 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Trade Form — fully functional */}
        {activeTab === 'add' && (
          <Card sx={{ mt: 3 }}>
            <CardHeader>
              <CardTitle>Add New Trade</CardTitle>
            </CardHeader>
            <CardContent>
              {formError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {formError}
                </Alert>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Date *</Typography>
                  <TextField
                    type="date"
                    size="small"
                    fullWidth
                    value={form.date}
                    onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Symbol *</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="e.g. NIFTY 22500 CE"
                    value={form.symbol}
                    onChange={(e) => setForm(f => ({ ...f, symbol: e.target.value }))}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Type</Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={form.type}
                    onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                  >
                    <MenuItem value="BUY">BUY</MenuItem>
                    <MenuItem value="SELL">SELL</MenuItem>
                  </TextField>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Entry Price *</Typography>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    placeholder="0.00"
                    value={form.entry}
                    onChange={(e) => setForm(f => ({ ...f, entry: e.target.value }))}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Exit Price (leave blank if open)</Typography>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    placeholder="0.00"
                    value={form.exit}
                    onChange={(e) => setForm(f => ({ ...f, exit: e.target.value }))}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Quantity *</Typography>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    placeholder="0"
                    value={form.qty}
                    onChange={(e) => setForm(f => ({ ...f, qty: e.target.value }))}
                  />
                </Box>
                <Box sx={{ gridColumn: { md: 'span 2', lg: 'span 3' } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Notes</Typography>
                  <TextField
                    multiline
                    rows={3}
                    size="small"
                    fullWidth
                    placeholder="Trade rationale, observations, lessons learned..."
                    value={form.notes}
                    onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </Box>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Button onClick={handleSave}>Save Trade</Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Analysis — derived from real trades only */}
        {activeTab === 'analysis' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mt: 3 }}>
            <Card>
              <CardHeader>
                <CardTitle>Win Rate by Day</CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length < 3 ? (
                  <Typography variant="body2" color="text.secondary">
                    Log at least 3 trades to see day-wise analysis.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {dayAnalysis.map(({ day, winRate, trades: count }) => (
                      <Stack key={day} direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2">{day}</Typography>
                        {count > 0 ? (
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                width: 128,
                                height: 8,
                                borderRadius: 4,
                                bgcolor: 'divider',
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  bgcolor: winRate > 50 ? 'success.main' : 'error.main',
                                  width: `${winRate}%`,
                                }}
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ width: 64, textAlign: 'right' }}>
                              {winRate}% ({count})
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">No trades</Typography>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Symbols</CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length < 3 ? (
                  <Typography variant="body2" color="text.secondary">
                    Log more trades to see symbol-level analysis.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {(() => {
                      const grouped = {};
                      trades.forEach(t => {
                        if (!grouped[t.symbol]) grouped[t.symbol] = { pnl: 0, count: 0, wins: 0 };
                        grouped[t.symbol].pnl += t.pnl;
                        grouped[t.symbol].count++;
                        if (t.pnl > 0) grouped[t.symbol].wins++;
                      });
                      return Object.entries(grouped)
                        .sort((a, b) => b[1].pnl - a[1].pnl)
                        .slice(0, 5)
                        .map(([symbol, data]) => (
                          <Box
                            key={symbol}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: 'background.default',
                            }}
                          >
                            <Box>
                              <Typography fontWeight={500}>{symbol}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {data.count} trades \u2014 {Math.round((data.wins / data.count) * 100)}% win
                              </Typography>
                            </Box>
                            <Typography
                              fontWeight={600}
                              sx={{ color: data.pnl >= 0 ? 'success.main' : 'error.main' }}
                            >
                              {formatINR(data.pnl)}
                            </Typography>
                          </Box>
                        ));
                    })()}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Box>
        )}
      </Section>
    </PageLayout>
  );
}
