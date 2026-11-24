export interface AppConfig {
  readonly apiBaseUrl: string;
  readonly webBaseUrl: string;
  readonly useDevSandbox: boolean;
}

function normalizeHttpUrl(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const isAllowedProtocol =
      parsed.protocol === 'https:' || (__DEV__ && parsed.protocol === 'http:');
    if (!isAllowedProtocol) {
      return '';
    }
    return trimmed.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function stripApiV1Suffix(url: string): string {
  return url.replace(/\/api\/v1$/i, '');
}

const rawApiUrl = normalizeHttpUrl(process.env.EXPO_PUBLIC_API_URL);
const rawWebUrl = normalizeHttpUrl(process.env.EXPO_PUBLIC_WEB_URL);

/**
 * Isolated pre-backend Dev Sandbox flag.
 * Defaults strictly to false for hosted backend execution and compiles out
 * whenever __DEV__ is false.
 */
const useDevSandbox =
  __DEV__ && process.env.EXPO_PUBLIC_USE_DEV_SANDBOX === 'true';

export const env: AppConfig = {
  apiBaseUrl: stripApiV1Suffix(rawApiUrl),
  webBaseUrl: rawWebUrl,
  useDevSandbox,
};

export function hasConfiguredApiUrl(): boolean {
  return env.apiBaseUrl.length > 0;
}

export function buildApiV1Url(path: string): string {
  if (!hasConfiguredApiUrl()) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is missing or invalid (https:// is required outside __DEV__).',
    );
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl}/api/v1${normalizedPath}`;
}
