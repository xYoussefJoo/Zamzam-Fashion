import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from '@/types/api';

// Same origin: Next.js forwards /api to the .NET API, so the owner's cookie stays first-party.
export const api = createClient<paths>({ baseUrl: '' });

const zamzam: Middleware = {
  onRequest({ request }) {
    const path = new URL(request.url).pathname;
    const changesData = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    // CSRF guard: required on every admin/auth write, otherwise 400 MISSING_CSRF_HEADER.
    if (changesData && (path.startsWith('/api/admin') || path.startsWith('/api/auth')))
      request.headers.set('X-Requested-With', 'zamzam-admin');
    return request;
  },
  onResponse({ response }) {
    // Session expired or never signed in: the admin area goes back to its login screen.
    if (response.status === 401 && new URL(response.url).pathname.startsWith('/api/admin'))
      window.dispatchEvent(new Event('zamzam:signed-out'));
    return response;
  },
};
api.use(zamzam);

export type Schemas = components['schemas'];

// Every error is RFC 9457 ProblemDetails with a `code`, except 401/403/429 (empty body).
export type Problem = {
  status: number;
  code?: string;
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  [extra: string]: unknown;
};

export class ApiError extends Error {
  constructor(public problem: Problem) {
    super(problem.detail || problem.title || `Request failed (${problem.status})`);
  }
  get status() { return this.problem.status; }
  get code() { return this.problem.code; }
}

// Unwraps an openapi-fetch result: returns the data or throws ApiError with the problem details.
export async function call<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result;
  try {
    result = await request;
  } catch {
    throw new ApiError({ status: 0, code: 'NETWORK', detail: 'Network error' });
  }
  const { data, error, response } = result;
  if (response.ok) return data as T;
  const body = typeof error === 'object' && error ? (error as Partial<Problem>) : {};
  throw new ApiError({ ...body, status: response.status });
}

// One readable message per error, in the shop's two languages.
export function errorText(error: unknown, t: (ar: string, en: string) => string): string {
  if (!(error instanceof ApiError)) return t('حدث خطأ غير متوقع', 'Something went wrong');
  switch (error.status) {
    case 0: return t('تعذر الاتصال بالخادم، تحققي من الإنترنت', "Can't reach the server. Check your connection");
    case 401: return t('يلزم تسجيل الدخول', 'Please sign in');
    case 403: return t('غير مسموح', 'Not allowed');
    case 404: return t('غير موجود', 'Not found');
    case 429: return t('محاولات كثيرة، انتظري دقيقة ثم حاولي مجددًا', 'Too many attempts. Wait a minute and try again');
  }
  if (error.status >= 500) return t('حدث خطأ في الخادم، حاولي لاحقًا', 'Server error. Please try again later');
  return error.message;
}

// First message for a form field from a 400 VALIDATION_FAILED (keys are camelCase paths like "customer.phone").
export function fieldError(error: unknown, field: string): string | undefined {
  if (!(error instanceof ApiError) || !error.problem.errors) return undefined;
  const key = Object.keys(error.problem.errors).find((k) => k.toLowerCase() === field.toLowerCase());
  return key ? error.problem.errors[key][0] : undefined;
}
