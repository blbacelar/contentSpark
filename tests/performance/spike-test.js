import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Spike test: Sudden traffic surge
export const options = {
    stages: [
        { duration: '10s', target: 10 },   // Normal load
        { duration: '10s', target: 200 },  // Sudden spike!
        { duration: '3m', target: 200 },   // Sustain spike
        { duration: '10s', target: 10 },   // Back to normal
        { duration: '1m', target: 10 },    // Recovery period
        { duration: '10s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // Should recover quickly
        http_req_failed: ['rate<0.10'],    // Max 10% errors during spike
    },
};

const BASE_URL = 'https://n8n.bacelardigital.tech/webhook';
const TEST_USER_ID = '5610e481-186e-4ec1-89aa-775c5214bdfc';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';

export default function () {
    const response = http.get(`${BASE_URL}/get-user-ideas?user_id=${TEST_USER_ID}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
    });

    check(response, {
        'spike test status OK': (r) => r.status === 200,
        'spike test response time acceptable': (r) => r.timings.duration < 3000,
    }) || errorRate.add(1);

    sleep(1);
}
