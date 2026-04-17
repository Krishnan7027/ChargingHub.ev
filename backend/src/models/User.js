const db = require('../config/database');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const User = {
  async create({ email, password, fullName, phone, role = 'customer' }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, phone, role, avatar_url, is_active, created_at`,
      [email, passwordHash, fullName, phone, role]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await db.query(
      `SELECT id, email, full_name, phone, role, avatar_url, is_active, email_verified, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async findByMobile(mobile) {
    const { rows } = await db.query(
      `SELECT id, email, full_name, phone, mobile, role, avatar_url, is_active, email_verified, created_at, updated_at
       FROM users WHERE mobile = $1`,
      [mobile]
    );
    return rows[0] || null;
  },

  async findByEmailForAuth(email) {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT id, email, full_name, phone, role, avatar_url, is_active, email_verified, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['full_name', 'phone', 'mobile', 'avatar_url', 'is_active', 'email_verified'];
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (sets.length === 0) return null;

    values.push(id);
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, email, full_name, phone, role, is_active, email_verified, avatar_url, created_at, updated_at`,
      values
    );
    return rows[0];
  },

  async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  },

  async comparePassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  },

  async updateRole(id, role) {
    const { rows } = await db.query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, email, full_name, phone, role, is_active, created_at, updated_at`,
      [role, id]
    );
    return rows[0] || null;
  },

  async delete(id) {
    const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async findAll({ role, is_active, search, page = 1, limit = 20 } = {}) {
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = [];
    const values = [];
    let idx = 1;

    if (role) {
      conditions.push(`role = $${idx}`);
      values.push(role);
      idx++;
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${idx}`);
      values.push(is_active === 'true' || is_active === true);
      idx++;
    }

    if (search) {
      conditions.push(`(full_name ILIKE $${idx} OR email ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countValues = [...values];
    values.push(parseInt(limit, 10), offset);

    const { rows } = await db.query(
      `SELECT id, email, full_name, phone, role, is_active, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM users ${where}`,
      countValues
    );

    return { users: rows, total: parseInt(countRows[0].count, 10) };
  },
};

module.exports = User;
