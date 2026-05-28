const mongoose = require("mongoose");

// ── Contact schema (mirrors the one in profile-master) ────────────────────────
// We only need it here to update the `status` field after email delivery.
const contactSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["queued", "sent", "failed"], default: "queued" },
  },
  {
    strict: false,   // allow other fields without re-declaring them
    timestamps: true,
  }
);

let ContactModel = null;

async function connectDb() {
  const uri    = process.env.MONGO_URI;
  const dbName = process.env.MONGODB_DB_NAME || "portfolio";

  await mongoose.connect(uri, { dbName });
  console.log("[DB] Connected to MongoDB");

  ContactModel = mongoose.model("contacts", contactSchema);
}

// Update the status field of a contact document by its _id string
async function updateContactStatus(contactId, status) {
  if (!ContactModel) return;
  await ContactModel.findByIdAndUpdate(contactId, { status });
}

module.exports = { connectDb, updateContactStatus };
