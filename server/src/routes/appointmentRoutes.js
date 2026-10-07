// src/routes/appointmentRoutes.js
import { Router } from 'express';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
} from '../controllers/appointmentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getAppointments);
router.post('/', createAppointment);
router.put('/:id', updateAppointment);

export default router;
