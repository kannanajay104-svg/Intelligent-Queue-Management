import ServiceCenter from '../models/ServiceCenter.js';
import Service from '../models/Service.js';
import Token from '../models/Token.js';

const defaultCenters = [
  { name: 'Bank', description: 'Banking and account services', isActive: true },
  { name: 'Hospital', description: 'Hospital care and support services', isActive: true },
  { name: 'Government Office', description: 'Government applications and documents', isActive: true },
  { name: 'Railway Station', description: 'Railway ticketing and passenger services', isActive: true },
  { name: 'College', description: 'College admissions and student services', isActive: true },
  { name: 'Clinic', description: 'Clinic consultations and pharmacy services', isActive: true }
];

const defaultCenterServices = [
  ['Bank', [
    ['Account Opening', 'Open a new bank account', 'B', 12], ['Cash Deposit', 'Deposit cash at the counter', 'D', 6], ['Loan Enquiry', 'Get help with loan products', 'L', 15], ['Customer Support', 'General banking support', 'S', 8]
  ]],
  ['Hospital', [
    ['General Consultation', 'General hospital consultation', 'H', 10], ['Emergency', 'Urgent care desk', 'E', 7], ['Pharmacy', 'Collect prescribed medication', 'P', 5]
  ]],
  ['Government Office', [
    ['Certificate Request', 'Request an official certificate', 'G', 12], ['Document Verification', 'Verify submitted documents', 'V', 10], ['Application Submission', 'Submit an office application', 'A', 15]
  ]],
  ['Railway Station', [
    ['Ticket Booking', 'Book a railway ticket', 'R', 8], ['Cancellation', 'Cancel or change a ticket', 'C', 7], ['Enquiry', 'Passenger information desk', 'Q', 5]
  ]],
  ['College', [
    ['Admission', 'Admissions and enrollment support', 'C', 15], ['Student Services', 'General student services', 'T', 8], ['Certificate Request', 'Request a college certificate', 'O', 10]
  ]],
  ['Clinic', [
    ['General Consultation', 'Clinic consultation', 'N', 10], ['Pharmacy', 'Collect clinic medication', 'Y', 5]
  ]]
];

export async function ensureDefaultServiceCenters() {
  const centers = new Map();
  for (const centerData of defaultCenters) {
    const center = await ServiceCenter.findOneAndUpdate({ name: centerData.name }, centerData, { new: true, upsert: true, setDefaultsOnInsert: true });
    centers.set(center.name, center);
  }

  const legacyCenterByPrefix = { A: 'Hospital', B: 'Bank', C: 'Government Office' };
  const legacyServices = await Service.find({ serviceCenter: { $exists: false } });
  for (const service of legacyServices) {
    const center = centers.get(legacyCenterByPrefix[service.prefix] || 'Hospital');
    service.serviceCenter = center._id;
    await service.save();
  }

  for (const [centerName, serviceData] of defaultCenterServices) {
    const center = centers.get(centerName);
    for (const [name, description, prefix, averageServiceDuration] of serviceData) {
      await Service.findOneAndUpdate(
        { serviceCenter: center._id, name },
        { serviceCenter: center._id, name, description, prefix, averageServiceDuration, isActive: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  const legacyTokens = await Token.find({ serviceCenter: { $exists: false } }).populate('service', 'serviceCenter');
  for (const token of legacyTokens) {
    if (token.service?.serviceCenter) {
      token.serviceCenter = token.service.serviceCenter;
      await token.save();
    }
  }
  console.log(`Service centers ready: ${centers.size}`);
}

export { defaultCenters, defaultCenterServices };
