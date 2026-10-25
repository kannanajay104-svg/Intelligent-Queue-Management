import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { ensureDefaultServiceCenters } from '../utils/defaultServices.js';
import { ensureStaffAccounts } from '../utils/defaultStaff.js';

try {
  await connectDatabase();
  await ensureDefaultServiceCenters();
  await ensureStaffAccounts();
} finally {
  await mongoose.disconnect();
}
