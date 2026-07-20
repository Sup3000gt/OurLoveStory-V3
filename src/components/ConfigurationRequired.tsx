import { KeyRound } from 'lucide-react';

export function ConfigurationRequired() {
  return (
    <main className="configuration-required">
      <KeyRound size={42} />
      <h1>One small setup step remains.</h1>
      <p>
        Add your Clerk publishable key to <code>VITE_CLERK_PUBLISHABLE_KEY</code>, then restart the app.
        The secret key belongs only in Cloudflare Worker secrets.
      </p>
    </main>
  );
}
