import { Router } from 'express';
import User from '../models/User.js';
import Token from '../models/Token.js';
import { authenticateUser, authorizeRole } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authenticateUser, authorizeRole('ADMIN'));
router.get('/users', async (req, res, next) => { try { res.json({ users: await User.find().sort({ createdAt: -1 }) }); } catch (e) { next(e); } });
router.get('/statistics', async (req, res, next) => { try { const [customers, staff, totalTokens, waiting, serving, completed, cancelled, durations] = await Promise.all([User.countDocuments({ role: 'CUSTOMER' }), User.countDocuments({ role: 'STAFF' }), Token.countDocuments(), Token.countDocuments({ status: 'WAITING' }), Token.countDocuments({ status: 'IN_PROGRESS' }), Token.countDocuments({ status: 'COMPLETED' }), Token.countDocuments({ status: 'CANCELLED' }), Token.find({ status: 'COMPLETED', serviceDuration: { $gt: 0 } }).select('serviceDuration')]); const average = durations.length ? durations.reduce((sum, token) => sum + token.serviceDuration, 0) / durations.length : 0; res.json({ statistics: { customers, staff, totalTokens, waiting, serving, completed, cancelled, averageServiceDuration: Math.round(average * 100) / 100 } }); } catch (e) { next(e); } });
export default router;
