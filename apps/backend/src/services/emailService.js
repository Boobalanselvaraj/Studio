let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (_) {
  // Safe fallback if nodemailer module is not installed
}

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'notifications@studioplatform.com';

let transporter = null;

if (nodemailer && SMTP_HOST && SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    console.info(`[EmailService] Dev Mode (No SMTP). Mail to <${to}> Subject: "${subject}"`);
    return { success: true, mode: 'logged_console' };
  }

  try {
    const info = await transporter.sendMail({
      from: `Photo Studio SaaS <${FROM_EMAIL}>`,
      to,
      subject,
      text: text || subject,
      html,
    });
    return { success: true, messageId: info.messageId, mode: 'smtp_sent' };
  } catch (err) {
    console.warn(`[EmailService] Failed to send email to <${to}>:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendGalleryShareEmail({ customerEmail, customerName, albumTitle, galleryUrl, brandName }) {
  const subject = `✨ Your Private Gallery Collection "${albumTitle}" is Ready`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
      <h2 style="color: #1e293b;">${brandName || 'Photo Studio'}</h2>
      <p>Hello ${customerName || 'Client'},</p>
      <p>Your studio has published a new private gallery collection: <strong>${albumTitle}</strong>.</p>
      <div style="margin: 25px 0;">
        <a href="${galleryUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Your Gallery</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">If you have any questions, reply directly to your studio manager.</p>
    </div>
  `;
  return await sendEmail({ to: customerEmail, subject, html });
}

async function sendShootStatusEmail({ customerEmail, customerName, shootTitle, newStatus, note, brandName }) {
  const subject = `📸 Shoot Update: "${shootTitle}" is now ${newStatus.toUpperCase()}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
      <h2 style="color: #1e293b;">${brandName || 'Photo Studio'}</h2>
      <p>Hello ${customerName || 'Client'},</p>
      <p>Your shoot status for <strong>${shootTitle}</strong> has been updated to <strong>${newStatus.toUpperCase()}</strong>.</p>
      ${note ? `<p style="font-style: italic; background: #f8fafc; padding: 10px; border-left: 3px solid #3b82f6;">"${note}"</p>` : ''}
      <p style="color: #64748b; font-size: 13px;">Thank you for working with ${brandName || 'us'}.</p>
    </div>
  `;
  return await sendEmail({ to: customerEmail, subject, html });
}

module.exports = {
  sendEmail,
  sendGalleryShareEmail,
  sendShootStatusEmail,
};
