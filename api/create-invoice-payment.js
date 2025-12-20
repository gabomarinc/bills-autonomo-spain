
import { Client } from '@neondatabase/serverless';
import Stripe from 'stripe';

const getDbClient = () => {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    return new Client(url);
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { invoiceId, userId, amount, currency } = req.body;
    const origin = req.headers.origin || 'http://localhost:5173';

    if (!invoiceId || !userId || !amount) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const client = getDbClient();
    if (!client) {
        return res.status(500).json({ error: 'Database connection failed' });
    }

    try {
        await client.connect();
        const userRes = await client.query('SELECT profile_data FROM users WHERE id = $1', [userId]);
        await client.end();

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const profileData = userRes.rows[0].profile_data;
        const stripeSecretKey = profileData.paymentIntegration?.stripeSecretKey;

        if (!stripeSecretKey) {
            return res.status(400).json({ error: 'Stripe is not configured for this user' });
        }

        const stripe = new Stripe(stripeSecretKey);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency || 'eur',
                        product_data: {
                            name: `Pago de Factura #${invoiceId}`,
                            description: `Sincronización automática con Kônsul`,
                        },
                        unit_amount: Math.round(amount * 100), // convert to cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/view-document/${invoiceId}?payment_success=true`,
            cancel_url: `${origin}/view-document/${invoiceId}?payment_canceled=true`,
            client_reference_id: invoiceId,
            metadata: {
                invoiceId: invoiceId,
                userId: userId,
            }
        });

        return res.status(200).json({ url: session.url });
    } catch (error) {
        console.error('Create Invoice Payment Error:', error);
        return res.status(500).json({ error: error.message || 'Error creating payment session' });
    }
}
