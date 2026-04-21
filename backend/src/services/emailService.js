const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const emailService = {
  async sendOTPEmail({ to, otp }) {
    const mailOptions = {
      from: `"EV Charge Hub - No Reply" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Your EV Charge Hub Login OTP',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 28px 24px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 8px;">⚡</div>
            <h1 style="color: #ffffff; margin: 8px 0 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">EV Charge Hub</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">Smart EV Charging Platform</p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 24px;">
            <p style="color: #374151; font-size: 15px; margin: 0 0 8px;">Hi there,</p>
            <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">Use this one-time password to log in to your EV Charge Hub account:</p>

            <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 10px; padding: 24px; text-align: center; margin: 0 0 24px;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #065f46; font-family: 'Courier New', monospace;">${otp}</span>
            </div>

            <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px;">
              <p style="color: #92400e; font-size: 13px; margin: 0;">⏱ This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
            </div>

            <p style="color: #6b7280; font-size: 13px; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
          </div>

          <!-- Footer -->
          <div style="background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} EV Charge Hub. All rights reserved.</p>
            <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0;">This is an automated message — please do not reply.</p>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] OTP sent to ${to}, messageId: ${result.messageId}`);
    return result;
  },
};

module.exports = emailService;
