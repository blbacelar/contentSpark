# Performance Testing with Artillery

Load testing scripts to measure backend performance and capacity using Artillery.

## Installation

```powershell
npm install -g artillery@latest
```

Verify installation:
```powershell
artillery --version
```

## Configuration

Update `YOUR_AUTH_TOKEN_HERE` in each `.yml` file with a valid token:
1. Login to your app
2. Get token from browser DevTools → Application → Local Storage
3. Replace in test files

## Test Scripts

### 1. Baseline (`baseline.yml`)
**Light load baseline**
- ~10 concurrent users
- 1.5 minute duration

```powershell
artillery run tests/performance/baseline.yml
```

### 2. Load Test (`load-test.yml`)
**Production load simulation**
- Ramp 0 → 100 users
- 70% reads, 20% personas, 10% writes
- Thresholds: P95 < 1s, P99 < 2s

```powershell
artillery run tests/performance/load-test.yml
```

### 3. Stress Test (`stress-test.yml`)
**Find breaking point**
- Ramp 100 → 500 users
- Identifies max capacity

```powershell
artillery run tests/performance/stress-test.yml
```

### 4. Spike Test (`spike-test.yml`)
**Sudden traffic surge**
- Spike 10 → 200 users instantly
- Tests resilience

```powershell
artillery run tests/performance/spike-test.yml
```

## Generate HTML Report

```powershell
artillery run --output report.json tests/performance/baseline.yml
artillery report report.json
```

## Understanding Results

```
Summary report @ 14:30:15(+0000)
  Scenarios launched:  600
  Scenarios completed: 600
  Requests completed:  1200
  Mean response/sec:   20
  Response time (msec):
    min: 120
    max: 890
    median: 230
    p95: 420
    p99: 650
  Codes:
    200: 1200
```

**Key Metrics**:
- **p95/p99**: 95th/99th percentile response times
- **Codes**: HTTP status code distribution
- **Mean response/sec**: Throughput

## Best Practices

✅ Run against staging, not production
✅ Start with baseline, then increase load
✅ Monitor backend during tests
✅ Document results for comparison

## Troubleshooting

**High error rates**: Check n8n webhook config, database connections
**Slow responses**: Analyze database queries, n8n workflow complexity
**Installation issues**: Try `npm install -g artillery@latest --force`
