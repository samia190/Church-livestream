# First-party authentication setup

The NICA Kibugu application now uses its own email/password authentication. The sign-in and sign-up experience is rendered by the application in `client/src/pages/Auth.tsx` with a futuristic transparent glassmorphism design. No external OAuth portal is required, and the Scripture Companion uses a deterministic local reflection response rather than a model service.

## Required environment variables

Copy `.env.example` to `.env` and set the following values before running the server:

```dotenv
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/nica_kibugu
JWT_SECRET=replace-with-a-long-random-secret
LOCAL_ADMIN_EMAIL=admin@example.com
LOCAL_ADMIN_PASSWORD=replace-with-a-long-random-password
```

`MONGODB_URI` is required because users, donation records, prayer requests, journals, and the other protected resources use the existing MongoDB data layer. `JWT_SECRET` must be a long random value in production. Do not commit `.env`, passwords, salts, or JWT secrets.

## Account flow

A visitor opens `/auth` and chooses **Sign in** or **Sign up**. Sign-up accepts a display name, email, and password of at least eight characters. The server normalizes the email, creates a local user record, hashes the password with a unique random salt using Node’s built-in `scrypt`, and sets an HTTP-only `app_session_id` JWT cookie.

Sign-in verifies the stored hash and creates the same signed session cookie. `auth.me` reads the session and returns the current user. `auth.logout` clears the cookie. Protected server procedures require a valid session, and admin procedures additionally require `role=admin`.

New public registrations are ordinary users. If the configured `LOCAL_ADMIN_EMAIL` has no existing account, the first successful sign-in using the matching `LOCAL_ADMIN_PASSWORD` creates that account with the administrator role. Keep the bootstrap credentials private and configure them before first deployment.

## Admin request behavior

The admin page gates every protected query with the local authentication state. Unauthenticated users are sent to `/auth?next=/admin`, so the browser does not issue the previous burst of admin requests that returned `401 Unauthorized`. Once an administrator session is present, the dashboard queries are enabled normally.

## Development server behavior

The project is served through Express with Vite middleware. Standalone Vite HMR is disabled in middleware mode because it was attempting to connect to a second localhost port and producing a failed tokenized WebSocket. Development changes require a page refresh or a server restart; the application itself no longer depends on that WebSocket.

## Verification

The local auth tests cover salted password hashing, incorrect-password rejection, JWT session signing and verification, and removal of password credentials from client responses. TypeScript checking, the complete test suite, and the production build should be run before deployment.
