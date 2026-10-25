import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  serviceCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  prefix: { type: String, required: true, uppercase: true, trim: true, maxlength: 3 },
  averageServiceDuration: { type: Number, default: 10, min: 1 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Service', serviceSchema);
