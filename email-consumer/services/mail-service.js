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

async function sendOtpEmail(data) {
  const { toUser, Otp, type, resetLink } = data;
  
  let subject = "Security Notification";
  let html = "";
  
  if (type === "reset_link") {
    subject = "Reset Your Password 🔐";
    html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 30px; background-color: #f9f9fc; border-radius: 12px; border: 1px solid #e8e8f0;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: #7c6ef7; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(124, 110, 247, 0.3);">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"></path>
              <path d="m21 2-9.6 9.6"></path>
              <circle cx="7.5" cy="15.5" r="5.5"></circle>
            </svg>
          </div>
          <h1 style="color: #1a1a2e; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Password Reset Request</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
          <p style="margin: 0 0 15px; color: #444; font-size: 16px; line-height: 1.6;">Hello,</p>
          <p style="margin: 0 0 25px; color: #444; font-size: 16px; line-height: 1.6;">We received a request to reset the password for your account. Click the button below to choose a new password.</p>
          
          <div style="text-align: center; margin-bottom: 25px;">
            <a href="${resetLink}" style="background: #7c6ef7; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(124, 110, 247, 0.25);">Reset Password</a>
          </div>
          
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">If you didn't request a password reset, you can safely ignore this email. This link is only valid for 15 minutes.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
          <p style="margin: 0;">Secure SSO Authentication Service</p>
          <p style="margin: 5px 0 0;">This is an automated message, please do not reply.</p>
        </div>
      </div>
    `;
  } else {
    // Default to OTP view
    subject = "Your Verification Code 🛡️";
    html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 30px; background-color: #f9f9fc; border-radius: 12px; border: 1px solid #e8e8f0;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: #1d9e75; width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(29, 158, 117, 0.3);">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"></path>
              <path d="m21 2-9.6 9.6"></path>
              <circle cx="7.5" cy="15.5" r="5.5"></circle>
            </svg>
          </div>
          <h1 style="color: #1a1a2e; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Verification Code</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 8px; border: 1px solid #eee; box-shadow: 0 2px 5px rgba(0,0,0,0.02); text-align: center;">
          <p style="margin: 0 0 15px; color: #444; font-size: 16px; line-height: 1.6;">Hello,</p>
          <p style="margin: 0 0 25px; color: #444; font-size: 16px; line-height: 1.6;">Here is your secure verification code. Please enter it to continue.</p>
          
          <div style="background: #f4f4f8; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 32px; font-weight: bold; color: #1a1a2e; letter-spacing: 6px; margin-bottom: 25px; border: 1px dashed #d0d0d8;">
            ${Otp}
          </div>
          
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">This code is valid for a limited time. Do not share this code with anyone.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
          <p style="margin: 0;">Secure SSO Authentication Service</p>
          <p style="margin: 5px 0 0;">This is an automated message, please do not reply.</p>
        </div>
      </div>
    `;
  }

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: toUser,
    subject,
    text: Otp,
    html,
  });
}

module.exports = { sendContactEmail, sendAcknowledgementEmail, sendAdminCredentialsEmail, sendOtpEmail };
