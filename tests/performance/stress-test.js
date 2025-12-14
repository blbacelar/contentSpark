import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Stress test: Find the breaking point
export const options = {
    stages: [
        { duration: '2m', target: 100 },   // Ramp to 100 users
        { duration: '2m', target: 200 },   // Ramp to 200 users
        { duration: '2m', target: 300 },   // Ramp to 300 users
        { duration: '2m', target: 400 },   // Ramp to 400 users
        { duration: '2m', target: 500 },   // Ramp to 500 users
        { duration: '5m', target: 500 },   // Stay at 500 users
        { duration: '2m', target: 0 },     // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'], // More lenient threshold
        http_req_failed: ['rate<0.20'],    // Allow up to 20% errors to find breaking point
    },
};

const BASE_URL = 'https://n8n.bacelardigital.tech/webhook';
const TEST_USER_ID = '5610e481-186e-4ec1-89aa-775c5214bdfc';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';

export default function () {
    const response = http.get(`${BASE_URL}/get-user-ideas?user_id=${TEST_USER_ID}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
        timeout: '10s', // Longer timeout for stress test
    });

    const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 5s': (r) => r.timings.duration < 5000,
    });

    if (!success) {
        errorRate.add(1);
    }

    sleep(0.5); // Shorter sleep to increase load
}
