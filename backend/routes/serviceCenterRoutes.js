import { Router } from 'express';
import ServiceCenter from '../models/ServiceCenter.js';
import { authenticateUser, authorizeRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try { res.json({ serviceCenters: await ServiceCenter.find({ isActive: true }).sort({ name: 1 }) }); }
  catch (error) { next(error); }
});

router.post('/', authenticateUser, authorizeRole('ADMIN'), async (req, res, next) => {
  try { res.status(201).json({ serviceCenter: await ServiceCenter.create(req.body) }); }
  catch (error) { next(error); }
});

export default router;
