import { PaiflowApiError, PaiflowTimeoutError } from '@paiflow/sdk';
import type { Config } from '../../config/env.js';
import { PaymentError } from './model.js';

// Only fixed application messages may reach the public readiness endpoint.
export class ReadinessError extends PaymentError {
  constructor(code: string, message: string) { super(503, code, message); }
}

export function paiflowOrigin(config: Config) {
  let url: URL;
  try { url = new URL(config.paiflowBaseUrl); }
  catch { throw new ReadinessError('PAIFLOW_URL_INVALID', 'Set PAIFLOW_BASE_URL on Render to the Paiflow HTTPS origin.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new ReadinessError('PAIFLOW_URL_INVALID', 'PAIFLOW_BASE_URL must be an HTTPS origin without an API path, credentials or query.');
  }
  if (!config.paiflowApiToken) throw new ReadinessError('PAIFLOW_TOKEN_MISSING', 'Set PAIFLOW_API_TOKEN in the Render API environment, then redeploy.');
  if (!/^(pfk|pfd)_[a-f0-9]{64}$/.test(config.paiflowApiToken)) throw new ReadinessError('PAIFLOW_TOKEN_INVALID', 'PAIFLOW_API_TOKEN has an invalid format. Copy the complete server token into Render without quotes or whitespace.');
  if (!config.paiflowDeploymentId) throw new ReadinessError('PAIFLOW_DEPLOYMENT_MISSING', 'Set PAIFLOW_DEPLOYMENT_ID in the Render API environment, then redeploy.');
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(config.paiflowDeploymentId)) throw new ReadinessError('PAIFLOW_DEPLOYMENT_INVALID', 'PAIFLOW_DEPLOYMENT_ID must be the deployment UUID, not a wallet or contract address.');
  return url.origin;
}

export function readinessFailure(error: unknown, stage: 'paiflow' | 'stellar' | 'splitter') {
  if (error instanceof ReadinessError) return error;
  if (stage === 'paiflow') {
    if (error instanceof PaiflowApiError) {
      if (error.status === 401 || error.status === 403) return new ReadinessError('PAIFLOW_ACCESS_DENIED', 'Paiflow rejected the server token or deployment access. Check the Render token and its deployment permissions.');
      if (error.status === 404) return new ReadinessError('PAIFLOW_DEPLOYMENT_NOT_FOUND', 'Paiflow could not find the deployment. Check that the base URL and deployment UUID match your working local settings.');
    }
    if (error instanceof PaiflowTimeoutError) return new ReadinessError('PAIFLOW_TIMEOUT', 'Paiflow readiness timed out. Try checking the connection again.');
    return new ReadinessError('PAIFLOW_UNAVAILABLE', 'The API could not read Paiflow deployment capabilities and balances. Check the Render Paiflow settings and upstream availability.');
  }
  if (stage === 'stellar') return new ReadinessError('STELLAR_RPC_UNAVAILABLE', 'The API could not read the splitter from Stellar Testnet. Try checking the connection again.');
  return new ReadinessError('SPLITTER_NOT_READY', 'The deployment must be an active Testnet native-XLM deposit flow with one unpaused 85/15 splitter.');
}
