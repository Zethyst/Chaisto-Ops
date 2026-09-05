import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../constants';
import { getStoredToken } from './authToken';

/**
 * The API is hosted on a plan that suspends the service while it is idle, so
 * the first request after a quiet spell waits for the server to boot — tens of
 * seconds. At the old 15s timeout that first request always failed, which is
 * why a screen would open empty and only fill in after a manual pull-to-refresh.
 * Requests are given room for that in production, and a transient failure is
 * retried before the calling screen ever hears about it.
 */
const COLD_START_TIMEOUT_MS = 60000;
const RETRY_BASE_DELAY_MS = 1500;
const RETRYABLE_STATUS = [502, 503, 504];

const delay = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/** A dropped connection, a timeout or a gateway still waking up — not a real answer. */
function isTransient(error: any): boolean {
  if (error?.response) return RETRYABLE_STATUS.includes(error.response.status);
  // No response at all: timeout (ECONNABORTED) or the network went away
  return true;
}

type RetryConfig = AxiosRequestConfig & { _retryCount?: number };

/**
 * An axios instance for the Chaisto API: the stored JWT on every request, a
 * timeout that survives a cold start, and automatic retries for reads.
 *
 * @param timeout - floor for the request timeout; production always allows at
 *   least a cold start on top of it.
 */
export function createApiClient({ timeout = API_CONFIG.TIMEOUT }: { timeout?: number } = {}): AxiosInstance {
  const api = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: __DEV__ ? timeout : Math.max(timeout, COLD_START_TIMEOUT_MS),
  });

  api.interceptors.request.use(async (config) => {
    const token = await getStoredToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(undefined, async (error) => {
    const config = error?.config as RetryConfig | undefined;
    // Only reads are retried — replaying a POST could file the same report twice
    const isRead = (config?.method || 'get').toLowerCase() === 'get';
    if (!config || !isRead || !isTransient(error)) throw error;

    const attempt = (config._retryCount ?? 0) + 1;
    if (attempt > API_CONFIG.RETRY_ATTEMPTS) throw error;
    config._retryCount = attempt;

    await delay(RETRY_BASE_DELAY_MS * attempt);
    return api.request(config);
  });

  return api;
}
