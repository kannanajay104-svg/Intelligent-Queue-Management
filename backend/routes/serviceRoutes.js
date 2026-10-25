import { Router } from 'express';
import mongoose from 'mongoose';
import Service from '../models/Service.js';
import ServiceCenter from '../models/ServiceCenter.js';
import { authenticateUser, authorizeRole } from '../middleware/authMiddleware.js';

const router = Router();
router.get('/', authenticateUser, async (req, res, next) => {
	try {
		if (req.query.serviceCenterId && !mongoose.Types.ObjectId.isValid(req.query.serviceCenterId)) return res.status(400).json({ message: 'Invalid service center' });
		if (['CUSTOMER', 'staff'].includes(req.user.role) && req.query.serviceCenterId && String(req.query.serviceCenterId) !== String(req.serviceCenterId)) return res.status(403).json({ message: 'You can only access your assigned service center' });
		const centerId = ['CUSTOMER', 'staff'].includes(req.user.role) ? req.serviceCenterId : (req.query.serviceCenterId || req.serviceCenterId);
		if (!centerId && req.user.role === 'CUSTOMER') return res.status(400).json({ message: 'Service center is required' });
		if (!centerId) return res.json({ services: await Service.find({ isActive: true }).populate('serviceCenter').sort({ name: 1 }) });
		const center = await ServiceCenter.findOne({ _id: centerId, isActive: true });
		if (!center) return res.status(404).json({ message: 'Active service center not found' });
		const services = await Service.find({ serviceCenter: center._id, isActive: true }).sort({ name: 1 });
		res.json({ serviceCenter: center, services });
	} catch (e) { next(e); }
});
router.post('/', authenticateUser, authorizeRole('ADMIN'), async (req, res, next) => {
	try {
		if (!mongoose.Types.ObjectId.isValid(req.body.serviceCenter)) return res.status(400).json({ message: 'Valid service center is required' });
		const center = await ServiceCenter.findOne({ _id: req.body.serviceCenter, isActive: true });
		if (!center) return res.status(404).json({ message: 'Active service center not found' });
		res.status(201).json({ service: await Service.create(req.body) });
	} catch (e) { next(e); }
});
router.put('/:id', authenticateUser, authorizeRole('ADMIN'), async (req, res, next) => { try { const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!service) return res.status(404).json({ message: 'Service not found' }); res.json({ service }); } catch (e) { next(e); } });
router.delete('/:id', authenticateUser, authorizeRole('ADMIN'), async (req, res, next) => { try { const service = await Service.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }); if (!service) return res.status(404).json({ message: 'Service not found' }); res.json({ service }); } catch (e) { next(e); } });
export default router;
