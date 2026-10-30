import catalog from '../../metadata/clients.json' with { type: 'json' };

export const clients = catalog.clients;
export const clientIds = clients.map(client => client.id);
export function getClient(id) {
  const client = clients.find(item => item.id === id);
  if (!client) throw new Error(`Unknown client: ${id}. Expected ${clientIds.join(', ')}`);
  return client;
}
