const nodemailer = require("nodemailer");

// ── Singleton transporter ─────────────────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: Number(process.env.MAIL_PORT) === 465, // true only for port 465
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  return transporter;
}

/**
 * Send a contact-form notification email to the site owner.
 *
 * @param {object} contact - The contact payload from the queue
 * @param {string} contact.contactId
 * @param {string} contact.firstName
 * @param {string} contact.lastName
 * @param {string} contact.email
 * @param {string} contact.subject
 * @param {string} contact.message
 * @param {string} contact.submittedAt
 */
async function sendContactEmail(contact) {
  const {
    contactId,
    firstName,
    lastName = "",
    email,
    subject = "(no subject)",
    message,
    submittedAt,
  } = contact;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: process.env.MAIL_TO,
    replyTo: email,
    subject: `[Contact] ${subject} — from ${fullName}`,
    text: [
      `New contact message received on your portfolio website.`,
      ``,
      `Name      : ${fullName}`,
      `Email     : ${email}`,
      `Subject   : ${subject}`,
      `Submitted : ${new Date(submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      `Contact ID: ${contactId}`,
      ``,
      `─────────────────────────────────────`,
      `${message}`,
      `─────────────────────────────────────`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#1a1a2e">New Contact Message 📬</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 12px;font-weight:bold;color:#555">Name</td><td style="padding:6px 12px">${fullName}</td></tr>
          <tr style="background:#f5f5f5"><td style="padding:6px 12px;font-weight:bold;color:#555">Email</td><td style="padding:6px 12px"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;color:#555">Subject</td><td style="padding:6px 12px">${subject}</td></tr>
          <tr style="background:#f5f5f5"><td style="padding:6px 12px;font-weight:bold;color:#555">Submitted</td><td style="padding:6px 12px">${new Date(submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;color:#555">Contact ID</td><td style="padding:6px 12px;color:#999;font-size:12px">${contactId}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#f9f9f9;border-left:4px solid #6c63ff;border-radius:4px">
          <p style="margin:0;white-space:pre-wrap">${message}</p>
        </div>
      </div>
    `,
  });
}

/**
 * Send an acknowledgement email back to the person who submitted the form.
 * Called after sendContactEmail() succeeds.
 *
 * @param {object} contact - Same payload from the queue
 */
async function sendAcknowledgementEmail(contact) {
  const {
    firstName,
    lastName = "",
    email,
    subject = "(no subject)",
    message,
  } = contact;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const ownerName = process.env.OWNER_NAME || "Vyshnav P C";
  const ownerEmail = process.env.MAIL_TO || process.env.MAIL_USER;

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: email,
    replyTo: ownerEmail,
    subject: `Got your message! I'll be in touch soon — ${ownerName}`,
    text: [
      `Hi ${firstName},`,
      ``,
      `Thanks for reaching out! I've received your message and will get back to you within 24 hours.`,
      ``,
      `Here's a copy of what you sent:`,
      `Subject : ${subject}`,
      `Message : ${message}`,
      ``,
      `Talk soon,`,
      `${ownerName}`,
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;color:#1a1a2e">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:36px 32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="margin:0;font-size:24px;color:#fff;letter-spacing:-0.5px">
            Message received! 🚀
          </h1>
          <p style="margin:8px 0 0;color:#a0a0c0;font-size:14px">
            I'll get back to you within 24 hours.
          </p>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;padding:32px;border:1px solid #e8e8f0;border-top:none">
          <p style="margin:0 0 16px">Hi <strong>${fullName}</strong>,</p>
          <p style="margin:0 0 24px;line-height:1.6;color:#444">
            Thanks for reaching out! I've received your message and will reply
            as soon as possible — usually within 24 hours.
          </p>

          <!-- Copy of their message -->
          <div style="background:#f7f7fb;border-left:4px solid #6c63ff;border-radius:4px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888">Your message</p>
            <p style="margin:0 0 8px"><strong>Subject:</strong> ${subject}</p>
            <p style="margin:0;white-space:pre-wrap;line-height:1.6;color:#333">${message}</p>
          </div>

          <p style="margin:0;line-height:1.6;color:#444">
            Talk soon,<br/>
            <strong>${ownerName}</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f0f0f8;padding:16px 32px;border-radius:0 0 12px 12px;text-align:center">
          <p style="margin:0;font-size:12px;color:#999">
            This is an automated acknowledgement — please reply to this email if you need to follow up.
          </p>
        </div>

      </div>
    `,
  });
}

/**
 * Send the admin password email generated on startup.
 */
async function sendAdminCredentialsEmail(contact) {
  const { password } = contact;
  const mailTo = process.env.MAIL_TO;
  const mailUser = process.env.MAIL_USER;

  await getTransporter().sendMail({
    from: `"Vyshnav PC Portfolio" <${mailUser}>`,
    to: mailTo,
    subject: "🚨 Portfolio Admin Access - New Startup Password",
    text: `Your portfolio server just started.\n\nHere is your new temporary admin password: ${password}\n\nLogin at: http://localhost:3000/admin/login\n\nThis password changes every time the server restarts.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #1a1a2e;">Portfolio Admin Access 🔐</h2>
        <p>Your portfolio server has just restarted.</p>
        <p>A new, single-use administrative password has been generated for this session:</p>
        <div style="background: #f4f4f8; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 2px;">
          ${password}
        </div>
        <p style="margin-top: 20px;">
          <a href="http://localhost:3000/admin/login" style="background: #7c6ef7; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 4px; display: inline-block;">Go to Login</a>
        </p>
        <p style="color: #777; font-size: 12px; margin-top: 30px;">
          * This password changes every time your server restarts. Keep it secure.
        </p>
      </div>
    `
  });
}

/**
 * Send OTP or Password Reset email (from SSO)
 *
 * @param {object} data
 * @param {string} data.toUser
 * @param {string} data.Otp
 */
async function sendOtpEmail(data) {
  const { toUser, Otp } = data;
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: toUser,
    subject: "Security Notification (OTP / Reset Link)",
    text: Otp,
  });
}

module.exports = { sendContactEmail, sendAcknowledgementEmail, sendAdminCredentialsEmail, sendOtpEmail };
