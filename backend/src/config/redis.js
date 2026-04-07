const Redis = require('ioredis');

// Build config: prefer REDIS_URL (Upstash/production), fall back to individual vars (local)
const redisUrl = process.env.REDIS_URL || null;

function parseRedisUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
  };
}

const redisConfig = redisUrl
  ? {
      ...parseRedisUrl(redisUrl),
      maxRetriesPerRequest: null, // required for BullMQ
      enableReadyCheck: false,
      tls: {},
      retryStrategy(times) {
        if (times > 5) {
          console.warn('[redis] Max retries reached — giving up reconnection');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    }
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB, 10) || 0,
      maxRetriesPerRequest: null, // required for BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 5) {
          console.warn('[redis] Max retries reached — giving up reconnection');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    };

function createRedisClient(label) {
  const client = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, redisConfig)
    : new Redis(redisConfig);

  client.on('error', (err) => console.error(`[redis] ${label} error:`, err.message));
  client.on('connect', () => console.log(`[redis] ${label} connected`));
  client.connect().catch(() => {}); // trigger lazy connect
  return client;
}

let _client = null;
let _subscriber = null;
let _publisher = null;

function getClient() {
  if (!_client) {
    _client = createRedisClient('Client');
  }
  return _client;
}

function getSubscriber() {
  if (!_subscriber) {
    _subscriber = createRedisClient('Subscriber');
  }
  return _subscriber;
}

function getPublisher() {
  if (!_publisher) {
    _publisher = createRedisClient('Publisher');
  }
  return _publisher;
}

async function closeRedis() {
  const promises = [];
  if (_client) promises.push(_client.quit());
  if (_subscriber) promises.push(_subscriber.quit());
  if (_publisher) promises.push(_publisher.quit());
  await Promise.allSettled(promises);
  _client = _subscriber = _publisher = null;
}

module.exports = { redisConfig, getClient, getSubscriber, getPublisher, closeRedis };
