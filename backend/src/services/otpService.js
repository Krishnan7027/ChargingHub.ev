const { getClient } = require('../config/redis');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const crypto = require('crypto');

const OTP_EXPIRY = 300; // 5 minutes
const OTP_PREFIX = 'otp:';

const otpService = {
  generateOTP() {
    return String(crypto.randomInt(100000, 999999));
  },

  normalizeMobile(mobile) {
    let normalized = mobile.replace(/[\s\-\(\)]/g, '');
    if (normalized.startsWith('0')) normalized = normalized.slice(1);
    if (!normalized.startsWith('+')) {
      if (normalized.length === 10) normalized = '+91' + normalized;
      else if (!normalized.startsWith('91') || normalized.length < 12) normalized = '+91' + normalized;
      else normalized = '+' + normalized;
    }
    return normalized;
  },

  async sendOTP({ identifier, type }) {
    if (type === 'mobile') {
      identifier = this.normalizeMobile(identifier);
    }

    // OTP is login-only — verify user exists before sending
    let user;
    if (type === 'email') {
      user = await User.findByEmail(identifier);
    } else {
      user = await User.findByMobile(identifier);
    }

    if (!user) {
      const err = new Error('No account found with this ' + type + '. Please sign up first.');
      err.statusCode = 404;
      throw err;
    }

    if (!user.is_active) {
      const err = new Error('Account is disabled. Contact support.');
      err.statusCode = 403;
      throw err;
    }

    const otp = this.generateOTP();
    const redis = getClient();
    const key = `${OTP_PREFIX}${type}:${identifier}`;

    // Rate limit: check if OTP was sent recently (60s cooldown)
    const ttl = await redis.ttl(key);
    if (ttl > OTP_EXPIRY - 60) {
      const err = new Error('OTP already sent. Please wait before requesting again.');
      err.statusCode = 429;
      throw err;
    }

    await redis.setex(key, OTP_EXPIRY, otp);

    // In production, send via email/SMS service
    // For dev, log to console
    console.log(`[OTP] ${type}:${identifier} => ${otp}`);

    return { message: 'OTP sent successfully', expiresIn: OTP_EXPIRY };
  },

  async verifyOTP({ identifier, type, otp }) {
    if (type === 'mobile') {
      identifier = this.normalizeMobile(identifier);
    }

    const redis = getClient();
    const key = `${OTP_PREFIX}${type}:${identifier}`;
    const stored = await redis.get(key);

    if (!stored) {
      const err = new Error('OTP expired or not found');
      err.statusCode = 400;
      throw err;
    }

    // Track failed attempts — brute-force protection
    const attemptsKey = `${OTP_PREFIX}attempts:${type}:${identifier}`;
    if (stored !== otp) {
      const attempts = await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, OTP_EXPIRY);
      if (attempts >= 5) {
        await redis.del(key);
        await redis.del(attemptsKey);
        const err = new Error('Too many wrong attempts. Please request a new OTP.');
        err.statusCode = 429;
        throw err;
      }
      const err = new Error('Invalid OTP');
      err.statusCode = 401;
      throw err;
    }
    // Clear attempts on success
    await redis.del(attemptsKey);

    // Delete OTP after successful verification
    await redis.del(key);

    // Find existing user — OTP is login-only, user must exist
    let user;
    if (type === 'email') {
      user = await User.findByEmail(identifier);
    } else {
      user = await User.findByMobile(identifier);
    }

    if (!user) {
      const err = new Error('Account not found. Please sign up first.');
      err.statusCode = 404;
      throw err;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    );

    return { user, token };
  },
};

module.exports = otpService;
