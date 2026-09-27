/** The current data version for client code (makroskop-gko), injected at build time by vite.config.ts
 *  (define __DATA_VERSION__) so the manifest itself stays out of the client bundle. */
export { DATA_PAGE } from './opendata';

export const DATA_VERSION: string = __DATA_VERSION__;
