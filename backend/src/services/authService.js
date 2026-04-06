const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

const authService = {
  async register({ email, password, fullName, phone, role }) {
    const existing = await User.findByEmail(email);
    if (existing) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    const allowedRoles = ['customer', 'manager'];
    if (role && !allowedRoles.includes(role)) {
      const err = new Error('Invalid role. Must be customer or manager');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.create({ email, password, fullName, phone, role: role || 'customer' });
    const token = this.generateToken(user);
    return { user, token };
  },

  async login({ email, password }) {
    const user = await User.findByEmailForAuth(email);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (!user.is_active) {
      const err = new Error('Account is disabled. Contact support.');
      err.statusCode = 403;
      throw err;
    }

    const valid = await User.comparePassword(password, user.password_hash);
    if (!valid) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = this.generateToken(user);
    const { password_hash, ...safeUser } = user;
    return { user: safeUser, token };
  },

  generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwt.secret,
      { expiresIn: env.jwt.expiresIn }
    );
  },

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  },

  async updateProfile(userId, { fullName, phone, avatarUrl }) {
    const fields = {};
    if (fullName !== undefined) fields.full_name = fullName;
    if (phone !== undefined) fields.phone = phone;
    if (avatarUrl !== undefined) fields.avatar_url = avatarUrl;

    if (Object.keys(fields).length === 0) {
      const err = new Error('No fields to update');
      err.statusCode = 400;
      throw err;
    }

    const updated = await User.update(userId, fields);
    if (!updated) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return updated;
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await User.findByEmailForAuth((await User.findById(userId)).email);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const valid = await User.comparePassword(currentPassword, user.password_hash);
    if (!valid) {
      const err = new Error('Current password is incorrect');
      err.statusCode = 401;
      throw err;
    }

    await User.updatePassword(userId, newPassword);
  },
};

module.exports = authService;
