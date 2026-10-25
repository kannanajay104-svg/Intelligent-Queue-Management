import bcrypt from 'bcryptjs';
import Staff from '../models/Staff.js';
import ServiceCenter from '../models/ServiceCenter.js';

const centerConfigs = [
  { centerNames: ['Bank'], username: 'staffA', legacyUsername: 'bank_staff', usernameKey: 'STAFF_BANK_USERNAME', password: 'staffA1', passwordKey: 'STAFF_BANK_PASSWORD' },
  { centerNames: ['Clinic'], username: 'staffB', legacyUsername: 'clinic_staff', usernameKey: 'STAFF_CLINIC_USERNAME', password: 'staffB2', passwordKey: 'STAFF_CLINIC_PASSWORD' },
  { centerNames: ['College'], username: 'staffC', legacyUsername: 'college_staff', usernameKey: 'STAFF_COLLEGE_USERNAME', password: 'staffC3', passwordKey: 'STAFF_COLLEGE_PASSWORD' },
  { centerNames: ['Govt Office', 'Government Office'], username: 'staffD', legacyUsername: 'government_office_staff', usernameKey: 'STAFF_GOVERNMENT_USERNAME', password: 'staffD4', passwordKey: 'STAFF_GOVERNMENT_PASSWORD' },
  { centerNames: ['Hospital'], username: 'staffE', legacyUsername: 'hospital_staff', usernameKey: 'STAFF_HOSPITAL_USERNAME', password: 'staffE5', passwordKey: 'STAFF_HOSPITAL_PASSWORD' },
  { centerNames: ['Railway Station'], username: 'staffF', legacyUsername: 'railway_station_staff', usernameKey: 'STAFF_RAILWAY_USERNAME', password: 'staffF6', passwordKey: 'STAFF_RAILWAY_PASSWORD' }
];

export async function ensureStaffAccounts() {
  let provisioned = 0;
  for (const config of centerConfigs) {
    const username = process.env[config.usernameKey] || config.username;
    const password = process.env[config.passwordKey] || config.password;
    const center = await ServiceCenter.findOne({ name: { $in: config.centerNames }, isActive: true });
    if (!center) continue;
    let staff = await Staff.findOne({ username });
    const legacy = await Staff.findOne({ username: config.legacyUsername });
    if (!staff && legacy) staff = legacy;
    if (!staff) staff = new Staff({ username });
    if (legacy && staff._id.toString() !== legacy._id.toString()) await Staff.deleteOne({ _id: legacy._id });
    staff.username = username;
    staff.role = 'staff';
    staff.serviceCenterId = center._id;
    staff.serviceCenterName = center.name;
    staff.passwordHash = await bcrypt.hash(password, 12);
    await staff.save();
    provisioned += 1;
  }
  console.log(`Staff accounts ready: ${provisioned}`);
}

export { centerConfigs };
