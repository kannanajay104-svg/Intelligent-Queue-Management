import { Router } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ServiceCenter from '../models/ServiceCenter.js';
import Staff from '../models/Staff.js';
import { authorizeRole } from '../middleware/authMiddleware.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = Router();
const publicUser = (user, serviceCenter = null) => ({ id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, serviceCenter });
const sign = (user, serviceCenterId = null) => jwt.sign({ userId: user._id, role: user.role, serviceCenterId }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicStaff = (staff) => ({ id: staff._id, username: staff.username, role: staff.role, serviceCenterId: staff.serviceCenterId, serviceCenterName: staff.serviceCenterName });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;
    if (!name || !email || !phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ message: 'Name, email and a valid 10-digit phone number are required' });
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must contain at least 6 characters' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
    const existingUser = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (existingUser) {
      if (existingUser.role !== 'CUSTOMER' || /^\d{10}$/.test(existingUser.phone || '')) return res.status(409).json({ message: 'Already registered account' });
      if (!(await existingUser.comparePassword(password || ''))) return res.status(401).json({ message: 'Invalid email or password' });
      existingUser.phone = phone;
      await existingUser.save();
      res.status(200).json({ message: 'Phone number added successfully.' });
      return;
    }
    const user = await User.create({ name, email, password, phone, role: 'CUSTOMER' });
    res.status(201).json({ message: 'Account created successfully.' });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    if (!req.body.serviceCenterId) return res.status(400).json({ message: 'Please select a service center.' });
    if (!mongoose.Types.ObjectId.isValid(req.body.serviceCenterId)) return res.status(400).json({ message: 'Please select a valid service center.' });
    const serviceCenter = await ServiceCenter.findOne({ _id: req.body.serviceCenterId, isActive: true });
    if (!serviceCenter) return res.status(400).json({ message: 'Please select a valid service center.' });
    const user = await User.findOne({ email: req.body.email?.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(req.body.password || ''))) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.role === 'CUSTOMER' && !/^\d{10}$/.test(user.phone || '')) return res.status(400).json({ message: 'Create account with ph no.' });
    res.json({ token: sign(user, serviceCenter._id), user: publicUser(user, serviceCenter) });
  } catch (error) { next(error); }
});

router.post('/staff/login', async (req, res, next) => {
  try {
    const staff = await Staff.findOne({ username: req.body.username?.trim(), role: 'staff' }).select('+passwordHash');
    if (!staff || !(await staff.comparePassword(req.body.password || ''))) return res.status(401).json({ message: 'Invalid staff username or password' });
    res.json({ token: sign(staff, staff.serviceCenterId), user: publicStaff(staff) });
  } catch (error) { next(error); }
});

router.get('/me', authenticateUser, async (req, res, next) => {
  try {
    if (req.user.role === 'staff') return res.json({ user: publicStaff(req.user) });
    const serviceCenter = req.serviceCenterId ? await ServiceCenter.findById(req.serviceCenterId) : null; res.json({ user: publicUser(req.user, serviceCenter) });
  }
  catch (error) { next(error); }
});
router.patch('/me', authenticateUser, async (req, res, next) => {
  try {
    const updates = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
    if (typeof req.body.phone === 'string') {
      const phone = req.body.phone.trim();
      if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ message: 'Phone number must contain 10 digits' });
      updates.phone = phone;
    }
    if (typeof req.body.email === 'string' && req.body.email.trim().toLowerCase() !== req.user.email) {
      const email = req.body.email.trim().toLowerCase();
      if (await User.exists({ email, _id: { $ne: req.user._id } })) return res.status(409).json({ message: 'Email is already registered' });
      updates.email = email;
    }
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    const serviceCenter = req.serviceCenterId ? await ServiceCenter.findById(req.serviceCenterId) : null;
    res.json({ user: publicUser(user, serviceCenter) });
  } catch (error) { next(error); }
});
export default router;
