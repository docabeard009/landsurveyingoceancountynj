// geo/clients/index.mjs
// Static registry of clients. Add a client: import it and add to the map.
import lakeland from './lakeland.mjs';

export const CLIENTS = {
  lakeland,
};

export function getClient(slug) {
  return CLIENTS[slug] || null;
}
