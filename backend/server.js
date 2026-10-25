import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { connectDatabase } from './config/db.js';
import { ensureDefaultServiceCenters } from './utils/defaultServices.js';
import authRoutes from './routes/authRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import serviceCenterRoutes from './routes/serviceCenterRoutes.js';
import tokenRoutes, { attachTokenSocket } from './routes/tokenRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import { ensureStaffAccounts } from './utils/defaultStaff.js';
import Token from './models/Token.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' } });
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'queuewise-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-centers', serviceCenterRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use(notFound);
app.use(errorHandler);
io.on('connection', (socket) => {
	socket.on('join-service', (selection) => {
		if (typeof selection === 'string') return socket.join(`service:${selection}`);
		if (selection?.serviceCenterId && selection?.serviceId) socket.join(`service-center:${selection.serviceCenterId}:service:${selection.serviceId}`);
	});
});
const port = process.env.PORT || 5000;
connectDatabase().then(() => Token.syncIndexes()).then(() => ensureDefaultServiceCenters()).then(() => ensureStaffAccounts()).then(() => {
  attachTokenSocket(io);
  server.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}).catch((error) => { console.error(error.message); process.exit(1); });
