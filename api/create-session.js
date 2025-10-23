import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { person, document, callback } = req.body;

  try {
    const response = await fetch('https://stationapi.veriff.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': process.env.VERIFF_API_KEY,
      },
      body: JSON.stringify({
        verification: {
          person,
          document,
          callback
        }
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Veriff API Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
