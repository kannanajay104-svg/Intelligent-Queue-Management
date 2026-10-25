import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema({
  tokenNumber: { type: String, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  status: { type: String, enum: ['WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SKIPPED'], default: 'WAITING' },
  queuePosition: Number,
  peopleAhead: Number,
  estimatedWaitingTime: Number,
  tokenCreatedAt: { type: Date, default: Date.now },
  calledAt: Date,
  serviceStartTime: Date,
  serviceEndTime: Date,
  actualWaitingTime: Number,
  serviceDuration: Number
}, { timestamps: true });

tokenSchema.index({ service: 1, tokenCreatedAt: 1 });
tokenSchema.index({ service: 1, tokenNumber: 1 }, { unique: true });
tokenSchema.index(
  { customer: 1, serviceCenter: 1 },
  {
    name: 'active_customer_service_center_unique',
    unique: true,
    partialFilterExpression: { status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] } }
  }
);

export default mongoose.model('Token', tokenSchema);
