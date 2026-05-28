const nodemailer = require("nodemailer");

// ── Singleton transporter ─────────────────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host:   process.env.MAIL_HOST,
    port:   Number(process.env.MAIL_PORT) || 587,
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
    subject  = "(no subject)",
    message,
    submittedAt,
  } = contact;

  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  await getTransporter().sendMail({
    from:    process.env.MAIL_FROM || process.env.MAIL_USER,
    to:      process.env.MAIL_TO,
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

module.exports = { sendContactEmail };
