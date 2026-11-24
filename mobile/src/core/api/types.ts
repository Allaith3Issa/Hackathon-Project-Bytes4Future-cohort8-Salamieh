export interface ApiErrorPayload {
  statusCode: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  previousPage: number | null;
  nextPage: number | null;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  skipRefreshOn401?: boolean;
  bearerToken?: string | null;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}
