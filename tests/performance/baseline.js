import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 10 },   // Stay at 10 users
        { duration: '10s', target: 0 },   // Ramp down to 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
        http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
        errors: ['rate<0.05'],             // Custom error rate < 5%
    },
};

// Test configuration
const BASE_URL = 'https://n8n.bacelardigital.tech/webhook';
const TEST_USER_ID = '5610e481-186e-4ec1-89aa-775c5214bdfc'; // Replace with actual test user ID
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

export default function () {
    // Test 1: Fetch user ideas (most common operation)
    const ideasResponse = http.get(`${BASE_URL}/get-user-ideas?user_id=${TEST_USER_ID}`, {
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
    });

    check(ideasResponse, {
        'fetch ideas status is 200': (r) => r.status === 200,
        'fetch ideas response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    sleep(1);

    // Test 2: Fetch personas
    const personasResponse = http.get(`${BASE_URL}/get-persona?user_id=${TEST_USER_ID}`, {
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
    });

    check(personasResponse, {
        'fetch personas status is 200': (r) => r.status === 200,
        'fetch personas response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);

    sleep(1);
}
