import Token from '../models/Token.js';

export async function nextTokenNumber(service) {
  const latest = await Token.findOne({ service: service._id }).sort({ createdAt: -1 }).select('tokenNumber');
  const match = latest?.tokenNumber?.match(new RegExp(`^${service.prefix}(\\d+)$`, 'i'));
  const number = match ? Number(match[1]) + 1 : 1;
  return `${service.prefix}${String(number).padStart(3, '0')}`;
}
