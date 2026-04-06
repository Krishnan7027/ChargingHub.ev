const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 200, 5000);
  },
};

let _client = null;
let _subscriber = null;
let _publisher = null;

function getClient() {
  if (!_client) {
    _client = new Redis(redisConfig);
    _client.on('error', (err) => console.error('[redis] Client error:', err.message));
    _client.on('connect', () => console.log('[redis] Client connected'));
  }
  return _client;
}

function getSubscriber() {
  if (!_subscriber) {
    _subscriber = new Redis(redisConfig);
    _subscriber.on('error', (err) => console.error('[redis] Subscriber error:', err.message));
  }
  return _subscriber;
}

function getPublisher() {
  if (!_publisher) {
    _publisher = new Redis(redisConfig);
    _publisher.on('error', (err) => console.error('[redis] Publisher error:', err.message));
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
