
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!stripe || !stripeKey) {
    return res.status(503).json({ error: 'Stripe no está configurado. Contacta al administrador.' });
  }

  const { customerId } = req.body;
  
  // The URL to return to after the user finishes in the portal
  const origin = req.headers.origin || 'http://localhost:5173';
  const returnUrl = `${origin}/`; 

  if (!customerId) {
    return res.status(400).json({ error: 'Missing Customer ID' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal Error:', error);
    return res.status(500).json({ error: 'Error creating portal session' });
  }
}
