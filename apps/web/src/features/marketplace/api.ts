import { apiFetch } from '../../lib/api';

export type ApiService = {
  key: string;
  title: string;
  description: string;
  status: 'pilot' | 'planned';
  available: boolean;
  id?: string;
  scope?: string;
  durationMinutes?: number;
  amountStroops?: string;
  serviceArea?: string | null;
  workerName?: string | null;
  availableSlots?: string[];
};

export type Booking = {
  id: string;
  customer_id: string;
  worker_id: string;
  service_id: string;
  scheduled_at: string;
  task_description: string;
  service_address: string;
  amount_stroops: string;
  job_status: 'requested' | 'accepted' | 'work_done' | 'completed';
  payment_status: 'unpaid' | 'pending' | 'paid';
  created_at: string;
};

export function listServices() {
  return apiFetch<{ services: ApiService[] }>('/api/services');
}

export function listBookings(token: string) {
  return apiFetch<{ bookings: Booking[] }>('/api/bookings', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createBooking(token: string, input: {
  serviceId: string;
  scheduledAt: string;
  taskDescription: string;
  serviceAddress: string;
}) {
  return apiFetch<{ booking: Booking }>('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateBookingStatus(token: string, id: string, status: Booking['job_status']) {
  return apiFetch<{ booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}
