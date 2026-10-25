export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const port = Number(source.PORT || 3002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  if (source.STELLAR_NETWORK && source.STELLAR_NETWORK !== 'testnet') throw new Error('Only Stellar Testnet is supported.');
  const webOrigins = [...new Set((source.WEB_ORIGIN || 'http://127.0.0.1:5174').split(',').map(value => {
    try {
      const url = new URL(value.trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.hostname.includes('*') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
      return url.origin;
    } catch { throw new Error('WEB_ORIGIN must contain comma-separated HTTP(S) origins without paths, credentials, queries or wildcards.'); }
  }))];
  return {
    port,
    host: source.HOST || '127.0.0.1',
    webOrigins,
    supabaseUrl: source.SUPABASE_URL || '',
    supabaseSecretKey: source.SUPABASE_SECRET_KEY || '',
    paiflowBaseUrl: source.PAIFLOW_BASE_URL || 'https://beta.app.paiflow.xyz',
    paiflowApiToken: source.PAIFLOW_API_TOKEN || '',
    paiflowDeploymentId: source.PAIFLOW_DEPLOYMENT_ID || '',
  };
}

export type Config = ReturnType<typeof readEnv>;
