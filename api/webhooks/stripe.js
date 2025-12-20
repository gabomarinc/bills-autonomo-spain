
import { Client } from '@neondatabase/serverless';
import Stripe from 'stripe';

const getDbClient = () => {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    return new Client(url);
};

// We need the raw body for Stripe signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ error: 'Missing uid parameter' });
    }

    const sig = req.headers['stripe-signature'];
    const rawBody = await getRawBody(req);

    const client = getDbClient();
    if (!client) {
        return res.status(500).json({ error: 'Database connection failed' });
    }

    try {
        await client.connect();

        // 1. Fetch user's Stripe Secret Key and Webhook Secret
        const userRes = await client.query('SELECT profile_data FROM users WHERE id = $1', [uid]);
        if (userRes.rows.length === 0) {
            await client.end();
            return res.status(404).json({ error: 'User not found' });
        }

        const profileData = userRes.rows[0].profile_data;
        const stripeSecretKey = profileData.paymentIntegration?.stripeSecretKey;
        const webhookSecret = profileData.paymentIntegration?.stripeWebhookSecret;

        if (!stripeSecretKey || !webhookSecret) {
            await client.end();
            return res.status(400).json({ error: 'Stripe webhook is not fully configured for this user' });
        }

        const stripe = new Stripe(stripeSecretKey);
        let event;

        try {
            event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        } catch (err) {
            console.error(`❌ Webhook signature verification failed: ${err.message}`);
            await client.end();
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // 2. Handle the event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const invoiceId = session.client_reference_id;

            if (invoiceId) {
                console.log(`✅ Payment received for Invoice #${invoiceId}`);

                // Update invoice status in DB
                // We update both the column and the JSON data field to keep consistency
                await client.query(`
          UPDATE invoices 
          SET status = 'Pagada', 
              data = jsonb_set(data, '{status}', '"Pagada"'),
              updated_at = NOW() 
          WHERE id = $1 AND (user_id = $2 OR data->>'userId' = $2)
        `, [invoiceId, uid]);

                // Optional: Add to timeline if possible. 
                // For now, simple status update is enough to satisfy the "integrated" requirement.
                console.log(`🔧 Invoice ${invoiceId} marked as Pagada.`);
            }
        }

        await client.end();
        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook Handler Error:', error);
        if (client) await client.end();
        return res.status(500).json({ error: error.message });
    }
}
