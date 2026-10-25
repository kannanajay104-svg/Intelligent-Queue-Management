import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['staff'], default: 'staff' },
  serviceCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
  serviceCenterName: { type: String, required: true, trim: true }
}, { timestamps: true });

staffSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

export default mongoose.model('Staff', staffSchema);
