# Local Troubleshooting Guide

If you are experiencing issues running the project locally, please follow these steps to ensure your environment is correctly configured.

## 1. Fix "Invalid URL" Error
This error usually occurs when the `VITE_OAUTH_PORTAL_URL` is missing from your `.env` file. I have added defensive code to prevent the app from crashing, but you should ensure your `.env` file contains:
```env
VITE_OAUTH_PORTAL_URL=http://localhost:3000
```

## 2. Fix WebSocket / HMR Connection
The error `[vite] failed to connect to websocket` happens when Vite tries to connect to a development server that isn't where it expects. 
- **The Correct Way**: You should run the project using the backend server (`npm run dev` or `node server/index.ts`). This starts Express on port 3000, and Express will "host" Vite for you.
- **Avoid Port 5173**: Do not try to access the site via `localhost:5173`. Always use `localhost:3000`.
- **HMR Config**: I have updated `vite.config.ts` to be more flexible. If you still see WebSocket errors, check if you have any other services running on port 3000.

## 3. Fix Logo / 500 Errors
The logo was failing to load because it was trying to use a "Storage Proxy" that requires specific API keys.
- **Solution**: I have added an `onError` fallback to the logo in `Navigation.tsx`. If the server cannot find the logo, it will now display a professional placeholder instead of a broken image icon.

## 4. Fix HTML Placeholder Errors
The errors regarding `%VITE_ANALYTICS_ENDPOINT%` were caused by placeholders in `index.html` that weren't being replaced because the variables were missing.
- **Solution**: I have commented out the analytics script in `client/index.html`. You can re-enable it once you have a real Umami analytics endpoint to use.

## Summary of Fixed Files
- `client/src/const.ts`: Added fallback for OAuth URL.
- `client/src/_core/hooks/useAuth.ts`: Made the auth hook lazy so it doesn't crash on boot.
- `client/index.html`: Removed broken analytics placeholders.
- `client/src/components/Navigation.tsx`: Added logo fallback.
- `server/_core/storageProxy.ts`: Changed 500 error to 404 for missing storage.
- `vite.config.ts`: Cleaned up hard-coded HMR settings.
- `.env`: Added missing variables.
