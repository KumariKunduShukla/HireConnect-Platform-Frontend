import axios from 'axios';

// In development, keep requests relative so CRA proxy routes them via :8080
// and browser-side CORS is avoided.
const BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '');

const createApiClient = (baseURL) => {
  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    // JWT is passed in Authorization header; avoid cookies to reduce CORS complexity.
    withCredentials: false,
  });

  // Attach JWT token to every request
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('hc_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // On 401 Unauthorized, clear stale token and redirect to login
  client.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem('hc_token');
        localStorage.removeItem('hc_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(err);
    }
  );

  return client;
};

const api = createApiClient(BASE_URL);
// Default profile requests to gateway to avoid direct browser->service CORS failures.
const PROFILE_SERVICE_URL = process.env.REACT_APP_PROFILE_URL || BASE_URL;
const profileClient = PROFILE_SERVICE_URL === BASE_URL ? api : createApiClient(PROFILE_SERVICE_URL);

const PROFILE_BASE = '/api/profiles';
const PROFILE_BASE_V1 = '/api/v1/profiles';

const isProfilePath = (url) =>
  typeof url === 'string' &&
  (url === PROFILE_BASE ||
    url.startsWith(`${PROFILE_BASE}/`) ||
    url === PROFILE_BASE_V1 ||
    url.startsWith(`${PROFILE_BASE_V1}/`));

const buildProfileUrlVariants = (url) => {
  if (!isProfilePath(url)) return [url];

  if (url === PROFILE_BASE_V1 || url.startsWith(`${PROFILE_BASE_V1}/`)) {
    return [url, url.replace(PROFILE_BASE_V1, PROFILE_BASE)];
  }

  if (url === PROFILE_BASE || url.startsWith(`${PROFILE_BASE}/`)) {
    return [url.replace(PROFILE_BASE, PROFILE_BASE_V1), url];
  }

  return [url];
};

const requestWithProfileFallback = async (config) => {
  const variants = buildProfileUrlVariants(config.url);
  let last404Error = null;

  for (const url of variants) {
    try {
      return await api.request({ ...config, url });
    } catch (err) {
      if (err.response?.status === 404) {
        last404Error = err;
        continue;
      }
      throw err;
    }
  }

  // Optional direct-service fallback only when explicitly configured.
  if (profileClient !== api && isProfilePath(config.url)) {
    return profileClient.request(config);
  }

  throw last404Error;
};

// ─── AUTH SERVICE (/auth/**) ──────────────────────────────────────────────────
export const authAPI = {
  // Candidate registration (sends OTP)
  register: (data) => api.post('/api/v1/auth/register', data),

  // OTP verification
  verifyOtp: (email, otp, userData) =>
    api.post(`/api/v1/auth/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`, userData),

  //  FIX: sends { email, password } — backend LoginRequestDTO expects "password" key
  login: (email, password) =>
    api.post('/api/v1/auth/login', { email, password }),

  // Recruiter self-registration (no password needed at this stage)
  recruiterApply: (data) => api.post('/api/v1/auth/recruiter/apply', data),

  // Recruiter sets password after admin approval OTP
  recruiterSetPassword: (email, otp, newPassword) =>
    api.post(
      `/api/v1/auth/recruiter/set-password?email=${encodeURIComponent(email)}&otp=${otp}&newPassword=${encodeURIComponent(newPassword)}`
    ),

  githubLogin: (code) => api.post('/api/v1/auth/oauth2/github', { code }),

  // Password Management
  forgotPassword: (email) => api.post('/api/v1/auth/forgot-password', null, { params: { email } }),
  resetPassword: (email, otp, newPassword) => api.post('/api/v1/auth/reset-password', null, { params: { email, otp, newPassword } }),

  // Email Management
  requestEmailChange: (oldEmail, newEmail) => api.post('/api/v1/auth/request-email-change', null, { params: { oldEmail, newEmail } }),
  verifyEmailChange: (oldEmail, otp) => api.post('/api/v1/auth/verify-email-change', null, { params: { oldEmail, otp } }),
};

export const adminAPI = {
  /** Admin JWT is sent automatically via axios interceptor. */
  getPendingRecruiters: () => api.get('/api/v1/auth/admin/pending-recruiters'),
  approveRecruiter: (recruiterId) =>
    api.post('/api/v1/auth/admin/approve-recruiter', null, {
      params: { recruiterId },
    }),
  rejectRecruiter: (recruiterId) =>
    api.post('/api/v1/auth/admin/reject-recruiter', null, {
      params: { recruiterId },
    }),
  getAllUsers: (role) => api.get(`/api/v1/auth/admin/users?role=${role}`),
};

// ─── PROFILE SERVICE (/api/profiles/**) ───────────────────────────────────────
export const profileAPI = {
  getAllProfiles: () => requestWithProfileFallback({ method: 'get', url: PROFILE_BASE }),
  getProfileById: (id) => requestWithProfileFallback({ method: 'get', url: `${PROFILE_BASE}/${id}` }),
  getProfileByEmail: (email) =>
    requestWithProfileFallback({
      method: 'get',
      url: `${PROFILE_BASE}/by-email`,
      params: { email },
    }),
  getMyProfile: () => {
    const stored = localStorage.getItem('hc_user');
    if (!stored) return Promise.resolve({ data: null });
    try {
      const parsed = JSON.parse(stored);
      if (!parsed?.email) return Promise.resolve({ data: null });
      return requestWithProfileFallback({
        method: 'get',
        url: `${PROFILE_BASE}/by-email`,
        params: { email: parsed.email },
      });
    } catch {
      return Promise.resolve({ data: null });
    }
  },
  createCandidateProfile: (formData) =>
    requestWithProfileFallback({
      method: 'post',
      url: `${PROFILE_BASE}/candidate`,
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  createRecruiterProfile: (data) =>
    requestWithProfileFallback({ method: 'post', url: `${PROFILE_BASE}/recruiter`, data }),
  updateProfile: (id, updates) =>
    requestWithProfileFallback({ method: 'patch', url: `${PROFILE_BASE}/${id}`, data: updates }),
  deleteProfile: (id) => requestWithProfileFallback({ method: 'delete', url: `${PROFILE_BASE}/${id}` }),
  upsertByRole: (role, data, id = null) => {
    const normalizedRole = String(role || 'CANDIDATE').replace(/^ROLE_/, '').toUpperCase();
    if (id) {
      return requestWithProfileFallback({ method: 'patch', url: `${PROFILE_BASE}/${id}`, data });
    }
    return normalizedRole === 'RECRUITER'
      ? requestWithProfileFallback({ method: 'post', url: `${PROFILE_BASE}/recruiter`, data })
      : requestWithProfileFallback({
        method: 'post',
        url: `${PROFILE_BASE}/candidate`,
        data,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
  },
};

// ─── JOB SERVICE (/api/jobs/**) ───────────────────────────────────────────────
export const jobAPI = {
  getAllJobs: () => api.get('/api/v1/jobs/all'),
  getJobById: (id) => api.get(`/api/v1/jobs/id/${id}`),
  getJobsByCategory: (category) => api.get(`/api/v1/jobs/category/${category}`),
  getJobsByLocation: (location) => api.get(`/api/v1/jobs/location/${location}`),
  searchJobs: async (title, category, minSalary = 0, maxSalary = 0) => {
    const res = await api.get('/api/v1/jobs/all');
    const filtered = (res.data || []).filter((job) => {
      const titleOk = !title || (job.title || '').toLowerCase().includes(title.toLowerCase());
      const categoryOk = !category || (job.category || '').toLowerCase() === category.toLowerCase();
      const salary = Number(job.salary || job.packageAmount || 0);
      const salaryOk = salary >= Number(minSalary || 0) && salary <= Number(maxSalary || Number.MAX_SAFE_INTEGER);
      return titleOk && categoryOk && salaryOk;
    });
    return { ...res, data: filtered };
  },
  addJob: (data) => api.post('/api/v1/jobs/add', data),
  updateJob: (id, data) => api.put('/api/v1/jobs/update', { ...data, id }),
  deleteJob: (id) => api.delete(`/api/v1/jobs/delete/${id}`),
};

// ─── ANALYTICS SERVICE (/api/analytics/**) ──────────────────────────────────
export const analyticsAPI = {
  getRecruiterStats: (id) => api.get(`/api/v1/analytics/recruiter/${id}`),
};

// ─── APPLICATION SERVICE (/api/applications/**) ───────────────────────────────
export const applicationAPI = {
  submitApplication: (data) => api.post('/api/v1/applications', data),
  getById: (id) => api.get(`/api/v1/applications/${id}`),
  getByCandidate: (candidateId) => api.get(`/api/v1/applications/candidate/${candidateId}`),
  getByJob: (jobId) => api.get(`/api/v1/applications/job/${jobId}`),
  updateStatus: (id, status) =>
    api.patch(`/api/v1/applications/${id}/status?status=${encodeURIComponent(status)}`),
  withdrawApplication: (id) => api.put(`/api/v1/applications/${id}/withdraw`),
  getApplicationCount: async (jobId) => {
    const res = await api.get(`/api/v1/applications/job/${jobId}`);
    return { ...res, data: Array.isArray(res.data) ? res.data.length : 0 };
  },
  getAll: () => api.get('/api/v1/applications/all'),
};

// ─── INTERVIEW SERVICE (/api/interviews/**) ───────────────────────────────────
export const interviewAPI = {
  schedule: (data) => api.post('/api/v1/interviews/schedule', data),
  confirm: (id) => api.patch(`/api/v1/interviews/confirm/${id}`),
  reschedule: (id, newTime) =>
    api.patch(`/api/v1/interviews/reschedule/${id}?newTime=${encodeURIComponent(newTime)}`),
  cancel: (id) => api.delete(`/api/v1/interviews/cancel/${id}`),
  getByApplication: (appId) => api.get(`/api/v1/interviews/application/${appId}`),
};

// ─── NOTIFICATION SERVICE (/api/notifications/**) ─────────────────────────────
export const notificationAPI = {
  send: (data) => api.post('/api/v1/notifications/send', data),
  getByUser: (userId) => api.get(`/api/v1/notifications/user/${userId}`),
  markRead: (id) => api.patch(`/api/v1/notifications/read/${id}`),
  markAllRead: (userId) => api.patch(`/api/v1/notifications/read-all/${userId}`),
  getByType: (type) => api.get(`/api/v1/notifications/type/${type}`),
  delete: (id) => api.delete(`/api/v1/notifications/delete/${id}`),
  getUnreadCount: (userId) => api.get(`/api/v1/notifications/unread-count/${userId}`),
};

// ─── SUBSCRIPTION SERVICE (/api/subscriptions/**) ────────────────────────────
/** Plan codes: FREE | PROFESSIONAL | ENTERPRISE (same as backend). */
export const subscriptionAPI = {
  getPlans: () => api.get('/api/v1/subscriptions/plans'),
  createOrder: ({ recruiterId, plan, billingEmail }) => {
    const rid = Number(recruiterId);
    if (!Number.isFinite(rid) || rid <= 0) {
      return Promise.reject(new Error('Invalid recruiter id'));
    }
    return api.post('/api/v1/subscriptions/create-order', {
      recruiterId: rid,
      plan: plan == null ? plan : String(plan),
      ...(billingEmail ? { billingEmail } : {}),
    });
  },
  verifyPayment: (payload) =>
    api.post('/api/v1/subscriptions/verify-payment', {
      razorpayOrderId: payload.razorpayOrderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpaySignature: payload.razorpaySignature,
      ...(payload.billingEmail ? { billingEmail: payload.billingEmail } : {}),
    }),
  cancel: (id) => api.put(`/api/v1/subscriptions/cancel/${id}`),
  renew: (id) => api.post(`/api/v1/subscriptions/renew/${id}`),
  getInvoices: (subId) => api.get(`/api/v1/subscriptions/${subId}/invoices`),
  getInvoicesByRecruiter: async (recruiterId) => {
    const res = await api.get(`/api/v1/subscriptions/recruiter/${recruiterId}/invoices`);
    return { data: res.data || [] };
  },
  getByRecruiter: (recruiterId) =>
    api.get(`/api/v1/subscriptions/recruiter/${recruiterId}`),
  /** Returns axios response with responseType blob — save with fileSaver pattern in UI. */
  downloadInvoicePdf: (invoiceId, recruiterId) =>
    api.get(`/api/v1/subscriptions/invoices/${invoiceId}/pdf`, {
      params: { recruiterId },
      responseType: 'blob',
    }),
  getAll: () => api.get('/api/v1/subscriptions/all'),
};

/** Origin of the API gateway (needed so resume links open in a new tab with the correct host/path). */
export function getGatewayOrigin() {
  const base =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '');
  return String(base).replace(/\/$/, '');
}

/** Absolute URL to stream the uploaded resume PDF through the gateway (profile-service GET). */
export function getProfileResumeDownloadUrl(profileId) {
  if (profileId == null || profileId === '') return '';
  return `${getGatewayOrigin()}/api/v1/profiles/${profileId}/resume`;
}

/**
 * Stored resumeUrl may be `/api/profiles/...` (legacy), `/api/v1/profiles/...`, or an external https URL.
 * Always returns an absolute URL suitable for <a href target="_blank">.
 */
export function normalizeResumeLink(url, profileIdFallback) {
  if ((!url || String(url).trim() === '') && profileIdFallback != null) {
    return getProfileResumeDownloadUrl(profileIdFallback);
  }
  if (!url) return '';
  const u = String(url).trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  const origin = getGatewayOrigin();
  if (!origin) return u;
  if (u.startsWith('/api/v1/')) return `${origin}${u}`;
  if (u.startsWith('/api/profiles/')) {
    return `${origin}${u.replace('/api/profiles', '/api/v1/profiles')}`;
  }
  return `${origin}${u.startsWith('/') ? u : `/${u}`}`;
}

export default api;
