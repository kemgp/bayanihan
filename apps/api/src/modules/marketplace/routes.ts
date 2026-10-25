import { Router, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '../../middleware/auth.js';

type ServiceKey = 'plumbing' | 'electrician' | 'carpenter' | 'appliances' | 'cleaner' | 'painter' | 'gardener' | 'hvac';
const catalogue: { key: ServiceKey; title: string; description: string }[] = [
  { key: 'plumbing', title: 'Plumbing', description: 'Leaks, pipes, drains and fixtures.' },
  { key: 'electrician', title: 'Electrician', description: 'Electrical repairs, lights and wiring.' },
  { key: 'carpenter', title: 'Carpenter', description: 'Furniture assembly and wood repairs.' },
  { key: 'appliances', title: 'Appliances Repair', description: 'Appliance repairs and installation.' },
  { key: 'cleaner', title: 'Cleaner', description: 'Deep cleaning and maintenance.' },
  { key: 'painter', title: 'Painter', description: 'Interior and exterior painting.' },
  { key: 'gardener', title: 'Gardener', description: 'Lawn care and landscaping.' },
  { key: 'hvac', title: 'Hvac repair', description: 'Repair and maintenance.' },
];
const SLOT_TIMES = ['09:00:00', '11:30:00', '14:00:00'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(response: Response, status: number, code: string, message: string) {
  response.status(status).json({ error: { code, message } });
}

function getPilotSlots(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const result: string[] = [];
  for (let offset = 1; offset <= 14; offset++) {
    const parts = Object.fromEntries(day.formatToParts(new Date(now.getTime() + offset * 86400000)).map(part => [part.type, part.value]));
    if (parts.weekday === 'Sun') continue;
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    for (const time of SLOT_TIMES) {
      const slot = new Date(`${date}T${time}+08:00`);
      if (slot > now) result.push(slot.toISOString());
    }
  }
  return result;
}

export function createMarketplaceRouter(db: SupabaseClient | null) {
  const router = Router();
  const authenticated = requireAuth(db);
  router.get('/services', async (_request, response) => {
    if (!db) return fail(response, 503, 'DATABASE_UNAVAILABLE', 'Configure the development database and seed an active Carpenter service before loading pilot details.');
    const { data: service, error } = await db.from('services')
      .select('id,worker_id,title,scope,duration_minutes,amount_stroops,workers!inner(service_area,profile_id)')
      .eq('active', true).ilike('title', 'Furniture assembly').maybeSingle();
    if (error) return fail(response, 503, 'SERVICE_UNAVAILABLE', 'Could not load the current service pilot.');

    let workerName: string | null = null;
    let serviceArea: string | null = null;
    if (service) {
      const worker = Array.isArray(service.workers) ? service.workers[0] : service.workers;
      serviceArea = worker?.service_area ?? null;
      if (worker?.profile_id) {
        const { data: profile, error: profileError } = await db.from('profiles').select('display_name').eq('id', worker.profile_id).maybeSingle();
        if (profileError) return fail(response, 503, 'WORKER_UNAVAILABLE', 'Could not load the public worker profile.');
        workerName = profile?.display_name ?? null;
      }
    }

    const slots = getPilotSlots();
    let availableSlots = slots;
    if (service?.worker_id && slots.length > 0) {
      const { data: occupied, error: slotsError } = await db.from('bookings').select('scheduled_at')
        .eq('worker_id', service.worker_id).in('scheduled_at', slots);
      if (slotsError) return fail(response, 503, 'SLOTS_UNAVAILABLE', 'Could not load current appointment availability.');
      const reserved = new Set((occupied ?? []).map(booking => new Date(booking.scheduled_at).toISOString()));
      availableSlots = slots.filter(slot => !reserved.has(slot));
    }

    response.json({ services: catalogue.map(item => ({
      ...item,
      status: item.key === 'carpenter' ? 'pilot' : 'planned',
      available: item.key === 'carpenter' && !!service,
      ...(item.key === 'carpenter' && service ? {
        id: service.id,
        scope: service.scope,
        durationMinutes: service.duration_minutes,
        amountStroops: String(service.amount_stroops),
        serviceArea,
        workerName,
        availableSlots,
      } : {}),
    })) });
  });

  router.get('/bookings', authenticated, async (_request, response) => {
    if (!db) return fail(response, 503, 'DATABASE_UNAVAILABLE', 'Booking storage is not configured.');
    const user = response.locals.user as { id: string };
    const { data: profile, error: profileError } = await db.from('profiles').select('id,role').eq('id', user.id).maybeSingle();
    if (profileError) return fail(response, 503, 'PROFILE_UNAVAILABLE', 'Could not load the protected account profile.');
    if (!profile) return fail(response, 403, 'PROFILE_MISSING', 'Set up the account profile first.');
    let query = db.from('bookings').select('id,customer_id,worker_id,service_id,scheduled_at,task_description,service_address,amount_stroops,job_status,payment_status,created_at,updated_at').order('scheduled_at', { ascending: true });
    if (profile.role === 'customer') query = query.eq('customer_id', user.id);
    else {
      const { data: worker, error } = await db.from('workers').select('id').eq('profile_id', user.id).maybeSingle();
      if (error) return fail(response, 503, 'WORKER_UNAVAILABLE', 'Could not load the worker profile.');
      if (!worker) return fail(response, 403, 'WORKER_PROFILE_MISSING', 'This account has no worker profile.');
      query = query.eq('worker_id', worker.id);
    }
    const { data, error } = await query;
    if (error) return fail(response, 503, 'BOOKINGS_UNAVAILABLE', 'Could not load bookings.');
    response.json({ bookings: (data ?? []).map(booking => ({ ...booking, amount_stroops: String(booking.amount_stroops) })) });
  });

  router.post('/bookings', authenticated, async (request, response) => {
    if (!db) return fail(response, 503, 'DATABASE_UNAVAILABLE', 'Booking storage is not configured.');
    const user = response.locals.user as { id: string };
    const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError) return fail(response, 503, 'PROFILE_UNAVAILABLE', 'Could not load the protected account profile.');
    if (!profile) return fail(response, 403, 'PROFILE_MISSING', 'Set up the account profile first.');
    if (profile.role !== 'customer') return fail(response, 403, 'CUSTOMER_REQUIRED', 'Only the customer can request a service.');
    const body = request.body as Record<string, unknown> | null;
    if (!body || Object.keys(body).some(key => !['serviceId', 'scheduledAt', 'taskDescription', 'serviceAddress'].includes(key))) {
      return fail(response, 400, 'INVALID_INPUT', 'Supply the service, an available fixed slot, a task description and the service address.');
    }
    const serviceId = typeof body.serviceId === 'string' ? body.serviceId : '';
    const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt : '';
    const scheduledDate = new Date(scheduledAt);
    const canonicalSlot = Number.isNaN(scheduledDate.valueOf()) ? '' : scheduledDate.toISOString();
    const taskDescription = typeof body.taskDescription === 'string' ? body.taskDescription.trim() : '';
    const serviceAddress = typeof body.serviceAddress === 'string' ? body.serviceAddress.trim() : '';
    if (!UUID.test(serviceId) || !canonicalSlot || !getPilotSlots().includes(canonicalSlot)
      || taskDescription.length < 1 || taskDescription.length > 2000
      || serviceAddress.length < 1 || serviceAddress.length > 500) {
      return fail(response, 400, 'INVALID_INPUT', 'Choose a current fixed slot and enter a task description (up to 2,000 characters) and address (up to 500 characters).');
    }
    const { data: service, error: serviceError } = await db.from('services')
      .select('id,worker_id,title,amount_stroops').eq('id', serviceId).eq('active', true).ilike('title', 'Furniture assembly').maybeSingle();
    if (serviceError) return fail(response, 503, 'SERVICE_UNAVAILABLE', 'Could not load the selected service.');
    if (!service) return fail(response, 404, 'SERVICE_UNAVAILABLE', 'That service is not currently available for booking.');
    const { data: booking, error } = await db.from('bookings').insert({
      customer_id: user.id,
      worker_id: service.worker_id,
      service_id: service.id,
      scheduled_at: canonicalSlot,
      task_description: taskDescription,
      service_address: serviceAddress,
      amount_stroops: String(service.amount_stroops),
    }).select('id,customer_id,worker_id,service_id,scheduled_at,task_description,service_address,amount_stroops,job_status,payment_status,created_at,updated_at').single();
    if (error?.code === '23505') return fail(response, 409, 'SLOT_TAKEN', 'That appointment slot was just taken. Choose another available time.');
    if (error || !booking) return fail(response, 503, 'BOOKING_UNAVAILABLE', 'Could not save the booking.');
    response.status(201).json({ booking: { ...booking, amount_stroops: String(booking.amount_stroops) } });
  });

  router.patch('/bookings/:id/status', authenticated, async (request, response) => {
    if (!db) return fail(response, 503, 'DATABASE_UNAVAILABLE', 'Booking storage is not configured.');
    const id = String(request.params.id);
    if (!UUID.test(id)) return fail(response, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    const body = request.body as Record<string, unknown> | null;
    if (!body || Object.keys(body).length !== 1 || !['accepted', 'work_done', 'completed'].includes(String(body.status))) {
      return fail(response, 400, 'INVALID_STATUS', 'Supply one valid next booking status.');
    }
    const user = response.locals.user as { id: string };
    const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError) return fail(response, 503, 'PROFILE_UNAVAILABLE', 'Could not load the protected account profile.');
    if (!profile) return fail(response, 403, 'PROFILE_MISSING', 'Set up the account profile first.');
    const { data: booking, error } = await db.from('bookings').select('id,customer_id,worker_id,job_status,payment_status').eq('id', id).maybeSingle();
    if (error) return fail(response, 503, 'BOOKING_UNAVAILABLE', 'Could not load the booking.');
    if (!booking) return fail(response, 404, 'BOOKING_NOT_FOUND', 'Booking not found.');

    const nextStatus = body.status as 'accepted' | 'work_done' | 'completed';
    let assignedWorker = false;
    if (profile.role === 'worker') {
      const { data: worker, error: workerError } = await db.from('workers').select('id').eq('profile_id', user.id).maybeSingle();
      if (workerError) return fail(response, 503, 'WORKER_UNAVAILABLE', 'Could not load the worker profile.');
      assignedWorker = booking.worker_id === worker?.id;
    }
    const allowed = profile.role === 'worker'
      ? assignedWorker && ((booking.job_status === 'requested' && nextStatus === 'accepted') || (booking.job_status === 'accepted' && nextStatus === 'work_done'))
      : profile.role === 'customer' && booking.customer_id === user.id && booking.job_status === 'work_done' && nextStatus === 'completed';
    if (!allowed) return fail(response, 403, 'TRANSITION_FORBIDDEN', 'This account cannot make that booking status change.');

    const { data: updated, error: updateError } = await db.from('bookings').update({ job_status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', id).eq('job_status', booking.job_status)
      .select('id,customer_id,worker_id,service_id,scheduled_at,task_description,service_address,amount_stroops,job_status,payment_status,created_at,updated_at').maybeSingle();
    if (updateError) return fail(response, 503, 'BOOKING_UPDATE_FAILED', 'Could not update the booking.');
    if (!updated) return fail(response, 409, 'BOOKING_CHANGED', 'The booking changed. Reload it and try the permitted next action.');
    response.json({ booking: { ...updated, amount_stroops: String(updated.amount_stroops) } });
  });

  return router;
}
