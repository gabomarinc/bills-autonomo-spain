
import { Client } from '@neondatabase/serverless';
import Stripe from 'stripe';

const getDbClient = () => {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    return new Client(url);
};

export default async function handler(req, res) {
    // Support both GET for PDF links and POST for standard UI calls
    const { invoiceId, userId } = req.query;
    const origin = req.headers.origin || `https://${req.headers.host}` || 'http://localhost:5173';

    if (!invoiceId || !userId) {
        return res.status(400).send('Missing parameters');
    }

    const client = getDbClient();
    if (!client) {
        return res.status(500).send('Database connection failed');
    }

    try {
        await client.connect();

        // 1. Fetch user profile for Stripe credentials
        const userRes = await client.query('SELECT profile_data FROM users WHERE id = $1', [userId]);

        // 2. Fetch invoice to get original amount and currency
        const invoiceRes = await client.query(`
      SELECT data FROM invoices WHERE id = $1 AND (user_id = $2 OR data->>'userId' = $2)
    `, [invoiceId, userId]);

        await client.end();

        if (userRes.rows.length === 0 || invoiceRes.rows.length === 0) {
            return res.status(404).send('Not found');
        }

        const profileData = userRes.rows[0].profile_data;
        const invoiceData = invoiceRes.rows[0].data;
        const stripeSecretKey = profileData.paymentIntegration?.stripeSecretKey;

        if (!stripeSecretKey) {
            return res.status(400).send('Stripe not configured');
        }

        const stripe = new Stripe(stripeSecretKey);
        const amount = invoiceData.total - (invoiceData.amountPaid || 0);
        const currency = invoiceData.invoiceCurrency || invoiceData.currency || 'eur';

        // 3. Create fresh checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: `Pago de Factura #${invoiceId}`,
                            description: `Sincronización automática con Kônsul`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/view-document/${invoiceId}?payment_success=true`,
            cancel_url: `${origin}/view-document/${invoiceId}?payment_canceled=true`,
            client_reference_id: invoiceId,
            metadata: { invoiceId, userId }
        });

        // 4. Redirect the user to Stripe
        return res.redirect(303, session.url);
    } catch (error) {
        console.error('Pay Redirect Error:', error);
        return res.status(500).send('Error creating payment session');
    }
}
