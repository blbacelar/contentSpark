# n8n Cache Implementation Guide

## Overview
This guide shows how to add in-memory caching to your `get-user-ideas` workflow in n8n.

## Nodes to Add

### 1. Cache Check (Code Node)
**Position**: After "Map fields", before Supabase query
**Name**: "Check Cache"

```javascript
// Simple in-memory cache for user ideas
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Initialize global cache if it doesn't exist
if (!global.userIdeasCache) {
  global.userIdeasCache = new Map();
}

const userId = $('Map fields').item.json.query.user_id;
const cacheKey = `ideas_${userId}`;
const cached = global.userIdeasCache.get(cacheKey);

// Check if cache exists and is not expired
if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
  console.log(`Cache HIT for user ${userId}`);
  
  // Return cached data and set flag
  return [{
    json: {
      ...cached.data,
      _fromCache: true
    }
  }];
}

console.log(`Cache MISS for user ${userId}`);

// Cache miss - pass through to Supabase
return [{
  json: {
    ...$('Map fields').item.json,
    _cacheKey: cacheKey
  }
}];
```

### 2. Cache Store (Code Node)
**Position**: After Supabase query, before "Respond to Webhook"
**Name**: "Store in Cache"

```javascript
// Only cache if this is NOT from cache
if (!$input.first().json._fromCache) {
  const cacheKey = $('Check Cache').item.json._cacheKey;
  const userId = $('Map fields').item.json.query.user_id;
  
  // Store all items in cache
  global.userIdeasCache.set(cacheKey, {
    data: $input.all().map(item => item.json),
    timestamp: Date.now()
  });
  
  console.log(`Cached ${$input.all().length} ideas for user ${userId}`);
}

// Pass through all data
return $input.all();
```

## Workflow Flow

```
get-user-ideas Webhook
  ↓
Map fields
  ↓
Check Cache (Code) ──┐
  ↓                  │ (Cache HIT)
  │                  ↓
  │            Respond to Webhook
  │
  ↓ (Cache MISS)
Supabase Query
  ↓
Store in Cache (Code)
  ↓
Respond to Webhook
```

## Implementation Steps

1. **Open n8n workflow editor**
2. **Find the "get-user-ideas" path** in your Switch node
3. **Add "Check Cache" Code node** after "Map fields"
4. **Add "Store in Cache" Code node** after Supabase query
5. **Update connections**:
   - Map fields → Check Cache
   - Check Cache → Supabase Query (cache miss)
   - Check Cache → Respond to Webhook (cache hit)
   - Supabase Query → Store in Cache
   - Store in Cache → Respond to Webhook

## Expected Performance

- **First Request** (Cache MISS): ~1.8s (unchanged)
- **Subsequent Requests** (Cache HIT): ~50-100ms ✅
- **Cache Duration**: 5 minutes
- **Memory Usage**: ~1KB per user

## Testing

1. **First request**: Should see "Cache MISS" in n8n logs
2. **Second request** (within 5 min): Should see "Cache HIT" in logs
3. **After 5 minutes**: Cache expires, "Cache MISS" again

## Monitoring

Check n8n execution logs for:
- `Cache HIT for user <id>` - Cached data returned
- `Cache MISS for user <id>` - Querying database
- `Cached X ideas for user <id>` - Data stored in cache

## Notes

- Cache is **per n8n instance** (not shared across multiple instances)
- Cache **resets on n8n restart**
- For production with multiple instances, use Redis instead
- Cache automatically expires after 5 minutes
