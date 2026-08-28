import { createDirectus, rest, readItems } from '@directus/sdk';

const client = createDirectus('https://dev-directus.rearlytech.com').with(rest());
async function run() {
  try {
    const currentTime = new Date().toISOString();
    const result = await client.request(readItems('gateway_sensor_readings', {
      filter: {
        _and: [
          { sensor_type: { _eq: 'door_uart' } },
          { created_at: { _lte: currentTime } }
        ]
      },
      limit: 1,
      sort: ['-created_at'],
      fields: ['*'],
    }));
    console.log("Success! Array length:", result.length);
  } catch (err) {
    console.error("Query failed:", err);
  }
}
run();
