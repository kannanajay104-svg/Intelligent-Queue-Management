import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Staff from '../models/Staff.js';

export async function authenticateUser(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const user = payload.role === 'staff'
      ? await Staff.findById(payload.userId)
      : await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = user;
    req.serviceCenterId = payload.serviceCenterId || null;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorizeRole(...roles) {
  return (req, res, next) => roles.map((role) => role.toLowerCase()).includes(String(req.user.role).toLowerCase())
    ? next()
    : res.status(403).json({ message: 'You do not have permission for this action' });
}
