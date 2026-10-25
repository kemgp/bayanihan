# Shared authentication: setup and implementation guide

This guide records the Supabase authentication setup. The app now supports shared email/password sign-in and customer sign-up in `apps/web/src/App.tsx`, session restore/local sign-out and protected `/api/me`. Sign-up sends the display name as Auth metadata; migration `20261025000200_auth_profiles.sql` creates the profile with the safe `customer` role. No role picker is exposed. Worker accounts/roles remain separately provisioned. See [payment demo guide](payment-demo.md) for current setup and behavior.

## First, prepare the two accounts

Apply migrations in order to the development Supabase project:

1. `supabase/migrations/20261025000100_initial_schema.sql`, if it has not already been applied. Do not rerun it over existing tables.
2. `supabase/migrations/20261025000200_auth_profiles.sql`.

The second migration creates profiles for existing and newly created Auth users, with `customer` as the safe default. Existing profiles and assigned roles are preserved. User-editable metadata can provide a display name, but cannot grant the worker role. The profile trigger runs with an empty search path and is not callable by browser roles. Browser table access remains revoked. This follows Supabase's [Auth profile trigger approach](https://supabase.com/docs/guides/auth/managing-user-data).

Create the customer account through the app's Sign up form. Supabase creates its customer profile through the auth trigger. Create the worker email/password account in Supabase Dashboard → Authentication → Users, and confirm email addresses as required by the project's Auth settings. Keep passwords outside source control. Copy both Auth user UUIDs.

Open `supabase/seeds/demo_profiles.sql`, copy it into the development project's SQL Editor, and replace only the two UUID declaration values with those actual IDs. Run the edited copy. It assigns Ana Cruz as `customer` and Miguel Santos as `worker`. You may change those display names in the SQL Editor as needed. The script fails if the placeholders remain, the IDs are equal, either email account is missing, or the proposed customer already has a worker business record. It can be rerun with the same IDs. If a failed manual SQL run leaves a transaction open, issue `ROLLBACK` before retrying the corrected script.

Auth users/passwords belong to Supabase Auth, so neither migration inserts directly into `auth.users`. The seed assigns application profiles only. It does not create the separate `workers` record, wallet/deployment mapping or service.

## Sign-in and customer sign-up

The shared account form is in `apps/web/src/App.tsx`; it uses the browser client exported by `apps/web/src/lib/supabase.ts`. Sign-in calls `signInWithPassword`. Sign-up calls `signUp` with the trimmed display name in `options.data.display_name`. Passwords go directly to Supabase Auth. If email confirmation is enabled and sign-up returns no session, the form explains that the user should check their inbox. Configure the Auth Site URL and redirect allowlist in Supabase for the deployed frontend.

New accounts are always customers. Never add a customer/worker role selector to the public form. The profile trigger ignores role metadata and safely defaults to `customer`; worker role assignment happens through the trusted development seed/admin path.

For sign-in, use the existing browser client exported by `apps/web/src/lib/supabase.ts`:

The submit handler should prevent default form submission and call:

```ts
if (!supabase) {
  setError('Sign-in is not configured.');
  return;
}

setSubmitting(true);
setError(null);
try {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) setError('Unable to sign in. Check your email and password.');
} catch {
  setError('Unable to reach sign-in. Please try again.');
} finally {
  setSubmitting(false);
}
```

`email`, `password`, `setError` and `setSubmitting` are state values/setters in the proposed component. Disable repeat submissions while waiting. Use `type="email"`, `type="password"`, and the appropriate autocomplete attributes. Passwords go directly to Supabase, not to an Express login endpoint, application logs or storage you implement yourself. Let the auth subscription handle successful navigation. No customer/worker picker belongs on this form. [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

## Step 4: resolve the protected role through Express

Add a proposed `GET /api/me` endpoint in `apps/api/src/routes/index.ts`, protected by the existing `requireAuth` middleware. That middleware verifies the bearer token and puts the authenticated user in `response.locals.user`.

The endpoint should:

1. Take the user ID from `response.locals.user.id`, never a browser-supplied body or query parameter.
2. Use the server Supabase client to select `id, display_name, role` from `profiles` where `id` equals the verified user ID, using `maybeSingle()`.
3. Return `403 PROFILE_NOT_CONFIGURED` for a missing profile or unsupported role, and a safe `503` for a database/configuration failure. Unauthenticated/invalid sessions return `401` through the middleware.
4. Return only the safe profile fields on success. Do not include tokens, secrets, signed envelopes or other users' profiles.

The browser sends the session token to that application endpoint:

```ts
const response = await fetch('/api/me', {
  headers: { Authorization: `Bearer ${session.access_token}` },
  signal: controller.signal,
});
```

Here `controller` is an `AbortController` owned by the profile-loading effect. If frontend/API use different production origins, build the URL using the configured API base URL as in the existing API helper.

Once the profile resolves, show the customer service/booking view for `customer` and the assigned-job view for `worker`. For the MVP, conditional views in the root are sufficient; a routing library is optional. A loading or unresolved profile must not display either protected view. A temporary server failure should offer retry rather than silently converting the user to a customer or signing them out.

UI selection is navigation only. Each future Express action must independently enforce its required role and booking ownership. Roles must come from protected `profiles` records, not form inputs, local storage flags or user-editable Auth metadata. The browser cannot directly query this project's profile table under the current grants, which is why `/api/me` is needed.

## Step 5: restore sessions and sign out

Create an auth provider/hook once near the React application root. Subscribe in an effect:

```ts
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (_event, nextSession) => {
    setSession(nextSession);
    setRestoring(false);
  },
);

return () => subscription.unsubscribe();
```

Guard the nullable Supabase client before subscribing. Initialize `restoring` as true and show a loading view until the initial auth state arrives. Store `Session | null` in React state. Keep the callback synchronous; perform `/api/me` loading in a separate effect keyed by `session?.access_token`. On user/token changes, clear the old profile, abort stale profile requests and resolve the current profile again. Handle initial session, sign-in, refresh and sign-out through the same state flow. [Supabase auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

The existing browser client uses the SDK's session persistence/refresh behavior. Do not manually copy JWTs into additional local storage. Server endpoints must still validate the presented access token on each protected request.

For the Sign out button:

```ts
const { error } = await supabase.auth.signOut({ scope: 'local' });
if (error) {
  setError('Unable to sign out. Please try again.');
}
```

Guard the client here too. A successful sign-out produces the auth event that clears session/profile state and returns the user to the shared login. Clear user-specific booking caches and cancel pending UI requests. Preserve original-payment recovery records; do not clear all application/browser storage to log out. `local` signs out this session, whereas the SDK's default scope is global. Already issued access tokens can remain usable until expiry, so UI sign-out is not an instant revocation guarantee for a previously copied token. [Supabase sign-out](https://supabase.com/docs/reference/javascript/auth-signout).

## Completion checks

- Customer and worker use the same login form and reach the correct view.
- Refresh restores the session and re-resolves the protected profile before showing content.
- Wrong password and unreachable Supabase produce safe errors.
- A valid Auth user with no usable profile is blocked from protected views.
- Session expiry/refresh is handled, while temporary API failures can be retried.
- Sign-out clears account UI and prevents stale requests from restoring the old user's profile.
- Changing user metadata or browser state cannot grant worker permissions.
- Customer requests to worker-only endpoints are rejected server-side.

Local migration/seed checks run with `npm run test:db`. These use an isolated PostgreSQL runtime with a minimal Auth fixture. They do not create hosted accounts or verify a real Supabase sign-in session. Full auth integration checks belong to implementation of steps 3–5.
