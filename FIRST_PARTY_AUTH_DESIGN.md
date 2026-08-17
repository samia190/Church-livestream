# First-party authentication design

## Authentication model

The project will use local email/password accounts stored in the existing MongoDB user collection. Passwords will be hashed with Node’s built-in `scrypt` function and a per-user random salt. The server will create a signed JWT session using the existing `app_session_id` HTTP-only cookie, with secure and same-site settings derived from the request.

Users may sign up with a display name, email, and password. A normalized email is unique. Sign-in returns the same session cookie and the existing `auth.me` query reads the current user from that session. Admin authorization remains role-based on the server; an administrator account can be bootstrapped with `LOCAL_ADMIN_EMAIL` and `LOCAL_ADMIN_PASSWORD` on first sign-in.

The Manus OAuth callback, Manus OAuth SDK exchange, and Manus login portal are removed. Public procedures remain accessible without a session, protected procedures require the local session, and admin procedures require `role=admin`.

## UI direction

The new `/auth` page uses a dark futuristic glassmorphism treatment: layered aurora gradients, subtle grid/noise texture, translucent blurred panels, luminous violet/cyan accents, animated orbital rings, and a two-mode sign-in/sign-up form. The interface remains keyboard accessible, uses visible focus rings, communicates password requirements, and respects reduced-motion preferences through the project’s global CSS rules.

## Admin request gating

The admin page continues to mount its queries only when the current local session is loaded and the user has `role=admin`. Unauthenticated visitors are routed to `/auth?next=/admin`, preventing the browser from issuing protected admin requests that can only return 401.

## Development server

The Manus runtime Vite plugin and Manus debug collector are removed. Vite uses ordinary React, Tailwind, and JSX-location plugins with explicit local HMR defaults so the development server does not attempt to connect to a Manus tokenized WebSocket endpoint.
