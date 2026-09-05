const mongoose = require("mongoose");
const { Schema } = mongoose;
require("dotenv").config({ path: ".env.local" }); // Load from .env.local

const JobSchema = new Schema({ jobId: String, companyName: String }, { strict: false });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/aotf_v2");
  const Job = mongoose.model("Job", JobSchema, "jobs");
  const jobs = await Job.find({ companyName: { $exists: true, $ne: null } }).select("jobId companyName").lean();
  console.log(JSON.stringify(jobs, null, 2));
  process.exit(0);
}
main().catch(console.error);
