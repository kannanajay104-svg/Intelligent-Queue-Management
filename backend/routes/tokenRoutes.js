import { Router } from 'express';
import mongoose from 'mongoose';
import Token from '../models/Token.js';
import Service from '../models/Service.js';
import ServiceCenter from '../models/ServiceCenter.js';
import { authenticateUser, authorizeRole } from '../middleware/authMiddleware.js';
import { nextTokenNumber } from '../utils/tokenGenerator.js';
import { buildQueue, calculateActualWaitingTime, calculateServiceDuration } from '../utils/queueCalculator.js';

const router = Router();
let io;
let queueRefreshTimer;
export function attachTokenSocket(socketIo) {
  io = socketIo;
  if (queueRefreshTimer) return;
  queueRefreshTimer = setInterval(() => {
    broadcastActiveQueues().catch((error) => console.error('Unable to refresh active queue estimates:', error.message));
  }, 5000);
  queueRefreshTimer.unref?.();
}
async function emitQueue(serviceId) {
  const service = await Service.findById(serviceId);
  if (service && io) io.to(`service-center:${service.serviceCenter}:service:${serviceId}`).emit('QUEUE_UPDATED', await buildQueue({ Token, service }));
}
async function broadcastActiveQueues() {
  if (!io) return;
  const activeServiceIds = await Token.distinct('service', { status: 'IN_PROGRESS' });
  await Promise.all(activeServiceIds.map((serviceId) => emitQueue(serviceId)));
}
function validId(id) { return mongoose.Types.ObjectId.isValid(id); }
function belongsToSelectedCenter(token, req) { return token && (!req.serviceCenterId || String(token.serviceCenter) === String(req.serviceCenterId)); }
function invalidIdResponse(id, label) {
  return validId(id) ? null : { status: 400, message: `Invalid ${label}` };
}
router.param('id', (req, res, next, id) => {
  if (!validId(id)) return res.status(400).json({ message: 'Invalid token' });
  next();
});
function activeTokenInfo(token, queue) {
  const item = queue.queue.find((entry) => String(entry.tokenId) === String(token._id));
  if (item) return { ...item, currentToken: queue.currentToken };
  if (['CALLED', 'IN_PROGRESS'].includes(token.status)) return { queuePosition: 1, peopleAhead: 0, estimatedWaitingTime: 0, currentToken: queue.currentToken };
  return { currentToken: queue.currentToken };
}

router.post('/', authenticateUser, authorizeRole('CUSTOMER'), async (req, res, next) => {
  try {
    const invalidService = invalidIdResponse(req.body.serviceId, 'service');
    if (invalidService) return res.status(invalidService.status).json({ message: invalidService.message });
    if (req.body.serviceCenterId && req.serviceCenterId && String(req.body.serviceCenterId) !== String(req.serviceCenterId)) return res.status(403).json({ message: 'Token must belong to your selected service center' });
    const serviceCenterId = req.serviceCenterId || req.body.serviceCenterId;
    const invalidCenter = invalidIdResponse(serviceCenterId, 'service center');
    if (invalidCenter) return res.status(invalidCenter.status).json({ message: 'Valid service center is required' });
    const serviceCenter = await ServiceCenter.findOne({ _id: serviceCenterId, isActive: true });
    if (!serviceCenter) return res.status(404).json({ message: 'Active service center not found' });
    const service = await Service.findOne({ _id: req.body.serviceId, serviceCenter: serviceCenter._id, isActive: true });
    if (!service) return res.status(404).json({ message: 'Active service not found' });
    const existing = await Token.findOne({
      customer: req.user._id,
      serviceCenter: serviceCenter._id,
      status: { $in: ['WAITING', 'CALLED', 'IN_PROGRESS'] }
    });
    if (existing) return res.status(409).json({ message: 'You already have an active token in this service center.' });
    let token;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        token = await Token.create({ tokenNumber: await nextTokenNumber(service), customer: req.user._id, serviceCenter: serviceCenter._id, service: service._id });
        break;
      } catch (error) {
        if (error.code !== 11000 || !error.keyPattern?.tokenNumber || attempt === 2) throw error;
      }
    }
    await token.populate('service serviceCenter');
    await emitQueue(service._id);
    const queue = await buildQueue({ Token, service });
    const info = activeTokenInfo(token, queue);
    res.status(201).json({ token: { ...token.toObject(), ...info } });
  } catch (e) {
    if (e.code === 11000 && e.keyPattern?.customer && e.keyPattern?.serviceCenter) return res.status(409).json({ message: 'You already have an active token in this service center.' });
    next(e);
  }
});

router.get('/my', authenticateUser, authorizeRole('CUSTOMER'), async (req, res, next) => {
  try {
    const filter = { customer: req.user._id };
    if (req.serviceCenterId) filter.serviceCenter = req.serviceCenterId;
    const tokens = await Token.find(filter).populate('service serviceCenter').sort({ createdAt: -1 }).limit(20);
    const queueByService = new Map();
    const result = await Promise.all(tokens.map(async (token) => {
      const serviceId = String(token.service?._id || token.service);
      if (!queueByService.has(serviceId)) queueByService.set(serviceId, await buildQueue({ Token, service: token.service }));
      const info = activeTokenInfo(token, queueByService.get(serviceId));
      return { ...token.toObject(), ...info };
    }));
    res.json({ tokens: result });
  } catch (e) { next(e); }
});
router.get('/queue/:serviceId', authenticateUser, authorizeRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    if (!validId(req.params.serviceId)) return res.status(400).json({ message: 'Invalid service' });
    const service = await Service.findOne({ _id: req.params.serviceId, ...(req.serviceCenterId ? { serviceCenter: req.serviceCenterId } : {}) });
    if (!service) return res.status(404).json({ message: 'Service not found in the selected service center' });
    res.json(await buildQueue({ Token, service }));
  } catch (e) { next(e); }
});
router.get('/:id', authenticateUser, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid token' });
    const token = await Token.findById(req.params.id).populate('customer service serviceCenter');
    if (!token) return res.status(404).json({ message: 'Token not found' });
    if (req.serviceCenterId && String(token.serviceCenter?._id || token.serviceCenter) !== String(req.serviceCenterId)) return res.status(403).json({ message: 'Token belongs to another service center' });
    if (req.user.role === 'CUSTOMER' && String(token.customer._id) !== String(req.user._id)) return res.status(403).json({ message: 'Access denied' });
    const queue = await buildQueue({ Token, service: token.service });
    res.json({ token: { ...token.toObject(), ...activeTokenInfo(token, queue) } });
  } catch (e) { next(e); }
});

router.post('/:id/call', authenticateUser, authorizeRole('STAFF', 'ADMIN'), async (req, res, next) => { try { const token = await Token.findById(req.params.id); if (!belongsToSelectedCenter(token, req) || token.status !== 'WAITING') return res.status(400).json({ message: 'Only waiting tokens in the selected service center can be called' }); token.status = 'CALLED'; token.calledAt = new Date(); await token.save(); await emitQueue(token.service); res.json({ token }); } catch (e) { next(e); } });
router.post('/:id/start', authenticateUser, authorizeRole('STAFF', 'ADMIN'), async (req, res, next) => { try { const token = await Token.findById(req.params.id); if (!belongsToSelectedCenter(token, req) || !['WAITING', 'CALLED'].includes(token.status)) return res.status(400).json({ message: 'Token cannot be started in the selected service center' }); const conflicting = await Token.findOne({ service: token.service, status: 'IN_PROGRESS', _id: { $ne: token._id } }); if (conflicting) return res.status(409).json({ message: 'Another token is already in progress for this service' }); token.status = 'IN_PROGRESS'; token.serviceStartTime = new Date(); token.actualWaitingTime = calculateActualWaitingTime(token.tokenCreatedAt, token.serviceStartTime); await token.save(); await emitQueue(token.service); res.json({ token }); } catch (e) { next(e); } });
router.post('/:id/complete', authenticateUser, authorizeRole('STAFF', 'ADMIN'), async (req, res, next) => { try { const token = await Token.findById(req.params.id); if (!belongsToSelectedCenter(token, req) || token.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Token is not in progress in the selected service center' }); token.status = 'COMPLETED'; token.serviceEndTime = new Date(); token.serviceDuration = calculateServiceDuration(token.serviceStartTime, token.serviceEndTime); await token.save(); await emitQueue(token.service); res.json({ token }); } catch (e) { next(e); } });
router.post('/:id/skip', authenticateUser, authorizeRole('STAFF', 'ADMIN'), async (req, res, next) => { try { const token = await Token.findById(req.params.id); if (!belongsToSelectedCenter(token, req) || !['WAITING', 'CALLED'].includes(token.status)) return res.status(400).json({ message: 'Token cannot be skipped in the selected service center' }); token.status = 'SKIPPED'; await token.save(); await emitQueue(token.service); res.json({ token }); } catch (e) { next(e); } });
router.patch('/:id/cancel', authenticateUser, authorizeRole('CUSTOMER'), async (req, res, next) => { try { const token = await Token.findOne({ _id: req.params.id, customer: req.user._id, ...(req.serviceCenterId ? { serviceCenter: req.serviceCenterId } : {}) }); if (!token || token.status !== 'WAITING') return res.status(400).json({ message: 'Only waiting tokens in the selected service center can be cancelled' }); token.status = 'CANCELLED'; await token.save(); await emitQueue(token.service); res.json({ token }); } catch (e) { next(e); } });
export default router;
