import { Router } from 'express';
import Service from '../models/Service.js';
import ServiceCenter from '../models/ServiceCenter.js';
import Token from '../models/Token.js';
import { authenticateUser, authorizeRole } from '../middleware/authMiddleware.js';
import { buildQueue } from '../utils/queueCalculator.js';

const router = Router();
router.use(authenticateUser, authorizeRole('staff'));

router.get('/queues', async (req, res, next) => {
  try {
    const center = await ServiceCenter.findOne({ _id: req.serviceCenterId, isActive: true });
    if (!center) return res.status(403).json({ message: 'Staff service center is unavailable' });
    const services = await Service.find({ serviceCenter: center._id, isActive: true }).sort({ name: 1 });
    const queues = await Promise.all(services.map(async (service) => ({ service, queue: await buildQueue({ Token, service }) })));
    res.json({ serviceCenter: center, services: queues });
  } catch (error) { next(error); }
});

router.get('/history', async (req, res, next) => {
  try {
    const records = await Token.find({
      serviceCenter: req.serviceCenterId,
      status: 'COMPLETED',
      customer: { $exists: true, $ne: null },
      service: { $exists: true, $ne: null },
      serviceStartTime: { $exists: true, $ne: null },
      serviceEndTime: { $exists: true, $ne: null },
      serviceDuration: { $exists: true, $ne: null, $gte: 0 }
    })
      .populate('customer', 'name email phone')
      .populate('service', 'name')
      .populate('serviceCenter', 'name')
      .sort({ serviceEndTime: -1 });
    const history = records.filter((record) => record.customer && record.service && record.serviceCenter && record.serviceStartTime && record.serviceEndTime && record.serviceDuration !== null && record.serviceDuration !== undefined);
    res.json({ history });
  } catch (error) { next(error); }
});

export default router;
