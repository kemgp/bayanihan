import { Paiflow } from '@paiflow/sdk';
import type { Config } from '../config/env.js';

// Construct on demand. Importing this file never prepares or submits a payment.
export function createPaiflowDeployment(config: Config) {
  if (!config.paiflowApiToken || !config.paiflowDeploymentId) {
    throw new Error('Paiflow deployment credentials are not configured.');
  }
  return new Paiflow({ baseUrl: config.paiflowBaseUrl, token: config.paiflowApiToken })
    .deployment(config.paiflowDeploymentId);
}
