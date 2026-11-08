// k6 load test for the deployed Zamzam Fashion site (frontend + /api through it).
// Run only against a deployment you own, ideally staging, outside peak hours:
//   k6 run -e BASE_URL=https://<your-vercel-domain> docs/reports/zamzam-fashion-loadtest.js
// It never places orders: the "write" scenario only asks for a tailoring price estimate (no DB writes, no emails).
// Note: the API rate-limits per IP (300/min global), so from one machine expect 429s past that; that is the limiter working.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus', exec: 'browse', startVUs: 0,
      stages: [{ duration: '1m', target: 25 }, { duration: '2m', target: 100 }, { duration: '1m', target: 0 }],
    },
    estimate: { executor: 'constant-arrival-rate', exec: 'estimate', rate: 1, timeUnit: '2s', duration: '4m', preAllocatedVUs: 2 },
  },
  thresholds: {
    'http_req_failed{scenario:browse}': ['rate<0.01'],
    'http_req_duration{scenario:browse}': ['p(95)<800'],
    'http_req_duration{scenario:estimate}': ['p(95)<1000'],
  },
};

let slugs = null;
export function browse() {
  check(http.get(`${BASE}/`), { 'home 200': (r) => r.status === 200 });
  const list = http.get(`${BASE}/api/products?page=1&pageSize=12`);
  check(list, { 'products 200': (r) => r.status === 200 });
  if (!slugs && list.status === 200) slugs = (list.json('items') || []).map((p) => p.slug);
  if (slugs && slugs.length) {
    const slug = slugs[Math.floor(Math.random() * slugs.length)];
    check(http.get(`${BASE}/products/${slug}`), { 'product page 200': (r) => r.status === 200 });
  }
  sleep(5); // typical read time
}

let catalog = null;
export function estimate() {
  if (!catalog) catalog = http.get(`${BASE}/api/tailoring/catalog`).json();
  const body = {
    styleId: null,
    garment: catalog.garments[0].key,
    fabric: catalog.fabrics[0].key,
    fit: catalog.fits[0].key,
    lining: false,
    sizingMode: 'StandardSize',
    standardSize: 'M',
    extras: null,
  };
  const res = http.post(`${BASE}/api/tailoring/estimate`, JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'estimate 200': (r) => r.status === 200 });
}
