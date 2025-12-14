import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Load test configuration: 0 -> 100 users
export const options = {
    stages: [
        { duration: '2m', target: 100 },  // Ramp up to 100 users over 2 minutes
        { duration: '5m', target: 100 },  // Stay at 100 users for 5 minutes
        { duration: '1m', target: 0 },    // Ramp down to 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% < 1s, 99% < 2s
        http_req_failed: ['rate<0.05'],    // Error rate < 5%
        errors: ['rate<0.10'],              // Custom error rate < 10%
    },
};

const BASE_URL = 'https://n8n.bacelardigital.tech/webhook';
const TEST_USER_ID = '5610e481-186e-4ec1-89aa-775c5214bdfc';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';

export default function () {
    // Simulate realistic user behavior

    // 1. Fetch ideas (70% of traffic)
    if (Math.random() < 0.7) {
        const response = http.get(`${BASE_URL}/get-user-ideas?user_id=${TEST_USER_ID}`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
        });

        check(response, {
            'get ideas status OK': (r) => r.status === 200,
        }) || errorRate.add(1);
    }

    // 2. Fetch personas (20% of traffic)
    if (Math.random() < 0.2) {
        const response = http.get(`${BASE_URL}/get-persona?user_id=${TEST_USER_ID}`, {
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
        });

        check(response, {
            'get personas status OK': (r) => r.status === 200,
        }) || errorRate.add(1);
    }

    // 3. Update idea (10% of traffic)
    if (Math.random() < 0.1) {
        const payload = JSON.stringify({
            id: 'test-load-id',
            user_id: TEST_USER_ID,
            title: 'Load Test Update',
            status: 'In Progress'
        });

        const response = http.patch(`${BASE_URL}/update-card`, payload, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        check(response, {
            'update idea status OK': (r) => r.status < 500,
        }) || errorRate.add(1);
    }

    sleep(Math.random() * 3 + 1); // Random sleep 1-4 seconds
}
