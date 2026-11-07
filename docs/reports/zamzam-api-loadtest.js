// k6 load test for the Zamzam API. Run ONLY against your own staging deployment, outside peak hours:
//   k6 run -e BASE_URL=https://staging.example.com zamzam-api-loadtest.js
// It only reads public endpoints and calls the price estimate (which writes nothing).
// It never places orders, uploads photos, logs in, or sends email.
// Run it after the proxy-secret fix, or the per-IP rate limits will answer 429 to k6 itself.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus', startVUs: 0, exec: 'browse',
      stages: [
        { duration: '1m', target: 25 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
    },
    estimate: {
      executor: 'constant-arrival-rate', exec: 'estimate',
      rate: 2, timeUnit: '1s', duration: '4m', preAllocatedVUs: 5,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:browse}': ['p(95)<800'],
    'http_req_duration{scenario:estimate}': ['p(95)<500'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:5055';
const json = { headers: { 'Content-Type': 'application/json' } };

export function browse() {
  const list = http.get(`${BASE}/api/products?pageSize=12`);
  check(list, { 'list 200': (r) => r.status === 200 });
  http.get(`${BASE}/api/site-settings`);
  sleep(5); // typical read time

  const items = list.status === 200 ? list.json('items') : [];
  if (items && items.length) {
    const slug = items[Math.floor(Math.random() * items.length)].slug;
    check(http.get(`${BASE}/api/products/${slug}`), { 'detail 200': (r) => r.status === 200 });
  }
  http.get(`${BASE}/api/categories`);
  sleep(5);
}

export function estimate() {
  const body = JSON.stringify({
    styleId: 'maxi', garment: 'dress', fabric: 'crepe', fit: 'Relaxed', lining: true,
    sizingMode: 'StandardSize', standardSize: 'M', extras: ['embroidery'],
  });
  check(http.post(`${BASE}/api/tailoring/estimate`, body, json), { 'estimate 200': (r) => r.status === 200 });
}
