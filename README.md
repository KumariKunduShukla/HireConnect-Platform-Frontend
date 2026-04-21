# HireConnect — React Frontend

A production-grade, feature-driven React frontend for the HireConnect Spring Boot Microservices ecosystem.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | React 18 |
| **Routing** | React Router v6 |
| **State Management** | React Context API |
| **HTTP Client** | Axios (with JWT interceptors) |
| **Notifications** | React Hot Toast |
| **Icons** | Lucide React |
| **Styling** | Vanilla CSS (`index.css`) |
| **Payments** | Razorpay Web SDK |

## Microservices Mapped

| Microservice | API Base Path | Client Module |
| :--- | :--- | :--- |
| **auth-service** | `/api/v1/auth` | `src/api/index.js (authAPI, adminAPI)` |
| **profile-service** | `/api/v1/profiles` | `src/api/index.js (profileAPI)` |
| **job-service** | `/api/v1/jobs` | `src/api/index.js (jobAPI)` |
| **analytics-service** | `/api/v1/analytics` | `src/api/index.js (analyticsAPI)` |
| **application-service** | `/api/v1/applications` | `src/api/index.js (applicationAPI)` |
| **interview-service** | `/api/v1/interviews` | `src/api/index.js (interviewAPI)` |
| **notification-service** | `/api/v1/notifications`| `src/api/index.js (notificationAPI)`|
| **subscription-service**| `/api/v1/subscriptions`| `src/api/index.js (subscriptionAPI)`|
| **api-gateway** | `(port 8080)` | Proxied via CRA (`package.json`) |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (proxies /api → localhost:8080)
npm start
```

## Folder Structure

```text
src/
├── api/               # Axios service modules for each microservice
│   └── index.js       # Centralized API clients and interceptors
├── components/        # Shared UI components and Layouts
├── context/           # React Context for global state (e.g., AuthProvider)
├── hooks/             # Custom React Hooks
├── pages/             # Page components (Dashboard, JobDetail, Login...)
├── utils/             # Helper functions and utilities
├── index.css          # Global styles
└── App.js             # Main application routing and providers
```

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `REACT_APP_API_URL` | API Gateway URL (default in dev: `http://localhost:8080`) |
| `REACT_APP_PROFILE_URL` | Fallback direct URL for the profile service |

## Authentication Flow

1. **Registration**: `POST /api/v1/auth/register` → Creates account, sends OTP.
2. **Verification**: `POST /api/v1/auth/verify-otp` → Verifies OTP, activates account.
3. **Login**: `POST /api/v1/auth/login` → Returns JWT. The token is stored in `localStorage` under the key `hc_token`.
4. **Interceptors**: All subsequent API calls attach `Authorization: Bearer <token>` via Axios interceptors.
5. **Unauthorized Handling**: `401` responses automatically clear the auth state (`hc_token` & `hc_user` removed) and redirect the user to `/login`.
6. **OAuth**: Supports GitHub login via `/api/v1/auth/oauth2/github`.

## Payment Integration

**Razorpay**: Used for Recruiter subscription plan purchases (Free, Professional, Enterprise).
- **Order Flow**:
  1. Recruiter initiates subscription plan purchase.
  2. Frontend calls `/api/v1/subscriptions/create-order` to generate a Razorpay order ID.
  3. Razorpay modal opens for the user to complete the payment.
  4. On success, frontend calls `/api/v1/subscriptions/verify-payment` to verify the signature and activate the subscription.
- Users can download subscription invoices in PDF format.
