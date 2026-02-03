/**
 * Data Processor Web Worker
 * Handles heavy calculations off the main thread
 * 
 * Use cases:
 * - Sorting large stock lists
 * - Calculating technical indicators
 * - Processing option chain data
 * - Computing Greeks
 * - Filtering large datasets
 */

/* eslint-disable no-restricted-globals */

// Message handler
self.onmessage = function (e) {
  const { type, payload, id } = e.data;

  try {
    let result;

    switch (type) {
      case 'SORT_STOCKS':
        result = sortStocks(payload.stocks, payload.sortBy, payload.sortOrder);
        break;

      case 'FILTER_STOCKS':
        result = filterStocks(payload.stocks, payload.filters);
        break;

      case 'CALCULATE_TECHNICALS':
        result = calculateTechnicals(payload.data);
        break;

      case 'PROCESS_OPTION_CHAIN':
        result = processOptionChain(payload.chain);
        break;

      case 'CALCULATE_GREEKS':
        result = calculateGreeks(payload.options);
        break;

      case 'COMPUTE_GAMMA_EXPOSURE':
        result = computeGammaExposure(payload.chain, payload.spotPrice);
        break;

      case 'CALCULATE_MAX_PAIN':
        result = calculateMaxPain(payload.chain);
        break;

      case 'AGGREGATE_OI_DATA':
        result = aggregateOIData(payload.chain);
        break;

      case 'SCAN_STOCKS':
        result = scanStocks(payload.stocks, payload.criteria);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};

// ========== SORTING FUNCTIONS ==========

function sortStocks(stocks, sortBy, sortOrder = 'desc') {
  if (!Array.isArray(stocks)) return [];
  
  const sorted = [...stocks].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    // Handle strings
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    // Handle numbers
    aVal = parseFloat(aVal) || 0;
    bVal = parseFloat(bVal) || 0;
    
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });
  
  return sorted;
}

// ========== FILTERING FUNCTIONS ==========

function filterStocks(stocks, filters) {
  if (!Array.isArray(stocks)) return [];
  
  return stocks.filter((stock) => {
    // Index filter
    if (filters.index && filters.index !== 'all') {
      if (stock.index !== filters.index) return false;
    }
    
    // Sector filter
    if (filters.sector && filters.sector !== 'all') {
      if (stock.sector !== filters.sector) return false;
    }
    
    // Price range
    if (filters.minPrice !== undefined) {
      if (stock.ltp < filters.minPrice) return false;
    }
    if (filters.maxPrice !== undefined) {
      if (stock.ltp > filters.maxPrice) return false;
    }
    
    // Volume filter
    if (filters.minVolume !== undefined) {
      if (stock.volume < filters.minVolume) return false;
    }
    
    // Change percentage filter
    if (filters.minChange !== undefined) {
      if (stock.changePercent < filters.minChange) return false;
    }
    if (filters.maxChange !== undefined) {
      if (stock.changePercent > filters.maxChange) return false;
    }
    
    // FNO filter
    if (filters.fnoOnly) {
      if (!stock.isFNO) return false;
    }
    
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const symbolMatch = stock.symbol?.toLowerCase().includes(searchLower);
      const nameMatch = stock.name?.toLowerCase().includes(searchLower);
      if (!symbolMatch && !nameMatch) return false;
    }
    
    return true;
  });
}

// ========== TECHNICAL ANALYSIS ==========

function calculateTechnicals(data) {
  if (!data || !data.closes || data.closes.length === 0) {
    return {};
  }

  const closes = data.closes;
  const highs = data.highs || closes;
  const lows = data.lows || closes;
  const volumes = data.volumes || [];

  return {
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    sma200: calculateSMA(closes, 200),
    ema9: calculateEMA(closes, 9),
    ema21: calculateEMA(closes, 21),
    rsi: calculateRSI(closes, 14),
    macd: calculateMACD(closes),
    atr: calculateATR(highs, lows, closes, 14),
    vwap: calculateVWAP(closes, volumes),
    bollingerBands: calculateBollingerBands(closes, 20, 2),
  };
}

function calculateSMA(data, period) {
  if (data.length < period) return null;
  
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateEMA(data, period) {
  if (data.length < period) return null;
  
  const k = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = data[data.length - i] - data[data.length - i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(data) {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  if (ema12 === null || ema26 === null) return null;
  
  const macdLine = ema12 - ema26;
  // Signal line would need historical MACD values
  
  return {
    macd: macdLine,
    signal: null, // Would need more computation
    histogram: null,
  };
}

function calculateATR(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return null;
  
  const trueRanges = [];
  
  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push(tr);
  }
  
  return calculateSMA(trueRanges.slice(-period), period);
}

function calculateVWAP(closes, volumes) {
  if (!volumes.length || closes.length !== volumes.length) return null;
  
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < closes.length; i++) {
    cumulativeTPV += closes[i] * volumes[i];
    cumulativeVolume += volumes[i];
  }
  
  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null;
}

function calculateBollingerBands(data, period = 20, stdDev = 2) {
  const sma = calculateSMA(data, period);
  if (sma === null) return null;
  
  const slice = data.slice(-period);
  const squaredDiffs = slice.map((val) => Math.pow(val - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    middle: sma,
    upper: sma + stdDev * std,
    lower: sma - stdDev * std,
  };
}

// ========== OPTIONS PROCESSING ==========

function processOptionChain(chain) {
  if (!chain || !chain.data) return null;
  
  const processed = chain.data.map((strike) => ({
    ...strike,
    callIV: calculateIV(strike.CE),
    putIV: calculateIV(strike.PE),
    totalOI: (strike.CE?.openInterest || 0) + (strike.PE?.openInterest || 0),
    oiDiff: (strike.CE?.openInterest || 0) - (strike.PE?.openInterest || 0),
    pcr: (strike.PE?.openInterest || 0) / (strike.CE?.openInterest || 1),
  }));
  
  return processed;
}

function calculateIV(option) {
  // Placeholder - actual IV calculation would need Black-Scholes
  return option?.impliedVolatility || 0;
}

function calculateGreeks(options) {
  // Placeholder for Greeks calculation
  return options.map((opt) => ({
    ...opt,
    delta: opt.delta || 0,
    gamma: opt.gamma || 0,
    theta: opt.theta || 0,
    vega: opt.vega || 0,
  }));
}

function computeGammaExposure(chain, spotPrice) {
  if (!chain || !spotPrice) return null;
  
  const exposureByStrike = {};
  let totalGEX = 0;
  
  chain.forEach((strike) => {
    const callGamma = strike.CE?.gamma || 0;
    const putGamma = strike.PE?.gamma || 0;
    const callOI = strike.CE?.openInterest || 0;
    const putOI = strike.PE?.openInterest || 0;
    
    // Call gamma is positive, put gamma is negative for market makers
    const strikeGEX = (callGamma * callOI - putGamma * putOI) * spotPrice * spotPrice * 0.01;
    
    exposureByStrike[strike.strikePrice] = strikeGEX;
    totalGEX += strikeGEX;
  });
  
  return { byStrike: exposureByStrike, total: totalGEX };
}

function calculateMaxPain(chain) {
  if (!chain || chain.length === 0) return null;
  
  let minPain = Infinity;
  let maxPainStrike = 0;
  
  chain.forEach((currentStrike) => {
    let totalPain = 0;
    
    chain.forEach((strike) => {
      // Call pain: if spot < strike, calls are worthless
      // Put pain: if spot > strike, puts are worthless
      const callOI = strike.CE?.openInterest || 0;
      const putOI = strike.PE?.openInterest || 0;
      
      if (currentStrike.strikePrice > strike.strikePrice) {
        // Calls at this strike are ITM, add intrinsic value * OI
        totalPain += (currentStrike.strikePrice - strike.strikePrice) * callOI;
      }
      
      if (currentStrike.strikePrice < strike.strikePrice) {
        // Puts at this strike are ITM
        totalPain += (strike.strikePrice - currentStrike.strikePrice) * putOI;
      }
    });
    
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = currentStrike.strikePrice;
    }
  });
  
  return { strike: maxPainStrike, pain: minPain };
}

function aggregateOIData(chain) {
  if (!chain) return null;
  
  let totalCallOI = 0;
  let totalPutOI = 0;
  let totalCallOIChange = 0;
  let totalPutOIChange = 0;
  
  chain.forEach((strike) => {
    totalCallOI += strike.CE?.openInterest || 0;
    totalPutOI += strike.PE?.openInterest || 0;
    totalCallOIChange += strike.CE?.changeinOpenInterest || 0;
    totalPutOIChange += strike.PE?.changeinOpenInterest || 0;
  });
  
  return {
    totalCallOI,
    totalPutOI,
    totalOI: totalCallOI + totalPutOI,
    pcr: totalCallOI > 0 ? totalPutOI / totalCallOI : 0,
    totalCallOIChange,
    totalPutOIChange,
    netOIChange: totalCallOIChange - totalPutOIChange,
  };
}

// ========== SCANNER CRITERIA ==========

function scanStocks(stocks, criteria) {
  return filterStocks(stocks, criteria).map((stock) => ({
    ...stock,
    score: calculateScannerScore(stock, criteria),
  })).sort((a, b) => b.score - a.score);
}

function calculateScannerScore(stock, criteria) {
  let score = 0;
  
  // Volume score
  if (criteria.volumeWeight && stock.volumeRatio) {
    score += stock.volumeRatio * criteria.volumeWeight;
  }
  
  // Momentum score
  if (criteria.momentumWeight && stock.changePercent) {
    score += Math.abs(stock.changePercent) * criteria.momentumWeight;
  }
  
  // Price position score
  if (criteria.pricePositionWeight && stock.dayRange) {
    const position = (stock.ltp - stock.dayLow) / (stock.dayHigh - stock.dayLow);
    score += position * criteria.pricePositionWeight;
  }
  
  return score;
}
