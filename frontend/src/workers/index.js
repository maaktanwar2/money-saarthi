/**
 * Web Worker Manager - Easy interface to use workers
 */

class WorkerManager {
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingPromises = new Map();
    this.init();
  }

  init() {
    try {
      // Create worker
      this.worker = new Worker(
        new URL('./dataProcessor.worker.js', import.meta.url)
      );

      // Handle responses
      this.worker.onmessage = (e) => {
        const { id, success, result, error } = e.data;
        const pending = this.pendingPromises.get(id);
        
        if (pending) {
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error));
          }
          this.pendingPromises.delete(id);
        }
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
      };
    } catch (error) {
      console.warn('Web Worker not supported, falling back to main thread');
      this.worker = null;
    }
  }

  /**
   * Send message to worker and get promise
   */
  async postMessage(type, payload) {
    if (!this.worker) {
      // Fallback: run on main thread
      return this.runOnMainThread(type, payload);
    }

    const id = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      this.pendingPromises.set(id, { resolve, reject });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingPromises.has(id)) {
          this.pendingPromises.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, 30000);

      this.worker.postMessage({ type, payload, id });
    });
  }

  /**
   * Fallback for browsers without worker support
   */
  runOnMainThread(type, payload) {
    // Import worker functions would be needed here
    console.warn('Running on main thread:', type);
    return Promise.resolve(payload);
  }

  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
const workerManager = new WorkerManager();

// ========== PUBLIC API ==========

export async function sortStocksInWorker(stocks, sortBy, sortOrder = 'desc') {
  return workerManager.postMessage('SORT_STOCKS', { stocks, sortBy, sortOrder });
}

export async function filterStocksInWorker(stocks, filters) {
  return workerManager.postMessage('FILTER_STOCKS', { stocks, filters });
}

export async function calculateTechnicalsInWorker(data) {
  return workerManager.postMessage('CALCULATE_TECHNICALS', { data });
}

export async function processOptionChainInWorker(chain) {
  return workerManager.postMessage('PROCESS_OPTION_CHAIN', { chain });
}

export async function calculateGreeksInWorker(options) {
  return workerManager.postMessage('CALCULATE_GREEKS', { options });
}

export async function computeGammaExposureInWorker(chain, spotPrice) {
  return workerManager.postMessage('COMPUTE_GAMMA_EXPOSURE', { chain, spotPrice });
}

export async function calculateMaxPainInWorker(chain) {
  return workerManager.postMessage('CALCULATE_MAX_PAIN', { chain });
}

export async function aggregateOIDataInWorker(chain) {
  return workerManager.postMessage('AGGREGATE_OI_DATA', { chain });
}

export async function scanStocksInWorker(stocks, criteria) {
  return workerManager.postMessage('SCAN_STOCKS', { stocks, criteria });
}

export default workerManager;
