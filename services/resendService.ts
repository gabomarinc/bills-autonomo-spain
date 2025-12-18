
import { Invoice, UserProfile } from '../types';

// Strict System Sender Logic
const getSender = (name: string = 'Kônsul Bills') => {
  const verifiedEmail = process.env.RESEND_FROM_EMAIL;
  if (verifiedEmail) {
    return `${name} <${verifiedEmail}>`;
  }
  console.warn("⚠️ RESEND_FROM_EMAIL no está configurado en .env. Usando modo Sandbox (onboarding@resend.dev).");
  return `${name} <onboarding@resend.dev>`;
};

interface Attachment {
  content: string; // Base64 string
  filename: string;
}

interface EmailPayload {
  to: string;
  cc?: string;
  subject: string;
  html?: string;
  templateId?: string;
  data?: any;
  senderName?: string;
  attachments?: Attachment[];
}

/**
 * Sends an email by calling the internal Vercel Serverless Function (/api/send).
 */
export const sendEmail = async (
  payload: EmailPayload
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const sender = getSender(payload.senderName || 'Kônsul Bills');
    const body: any = {
      from: sender, 
      to: [payload.to],
      subject: payload.subject,
    };
    if (payload.cc) {
      body.cc = [payload.cc];
    }
    if (payload.html) {
        body.html = payload.html;
    } else if (payload.templateId) {
        body.template_id = payload.templateId;
        body.data = payload.data || {};
    } else {
        body.html = '<p>No content provided</p>';
    }
    if (payload.attachments && payload.attachments.length > 0) {
      body.attachments = payload.attachments;
    }
    const response = await fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Error al enviar email' };
    }
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Email Service Error:', error);
    return { success: false, error: 'Error de conexión con el servidor de envíos.' };
  }
};

/**
 * Sends the Password Reset Email.
 */
export const sendPasswordResetEmail = async (email: string) => {
    const origin = window.location.origin;
    // En un app real, esto incluiría un token único
    const resetUrl = `${origin}/reset-password?email=${encodeURIComponent(email)}`;
    
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            .container { font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px; background: white; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0; }
            .button { display: inline-block; background-color: #27bea5; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 20px; }
            .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; }
        </style>
    </head>
    <body style="background-color: #f8fafc; padding: 40px;">
        <div class="container">
            <h1 style="color: #1c2938;">Recuperar Acceso 🔐</h1>
            <p style="color: #64748b; font-size: 16px; line-height: 1.5;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Kônsul Bills</strong>.
                <br/><br/>
                Haz clic en el botón de abajo para elegir una nueva contraseña. Si no solicitaste esto, puedes ignorar este correo.
            </p>
            <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
            <div class="footer">
                Enviado por el equipo de seguridad de Kônsul Bills.
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Instrucciones para restablecer tu contraseña 🔑',
        html: html,
        senderName: 'Seguridad Kônsul'
    });
};

/**
 * Sends the Password Changed Notification Email.
 */
export const sendPasswordChangedEmail = async (email: string, name: string) => {
    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            .container { font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px; background: white; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0; }
            .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; }
            .alert { background-color: #fff9f0; border: 1px solid #ffcc80; color: #e65100; padding: 16px; border-radius: 12px; margin-top: 20px; text-align: left; }
        </style>
    </head>
    <body style="background-color: #f8fafc; padding: 40px;">
        <div class="container">
            <h1 style="color: #1c2938;">Contraseña Actualizada ✅</h1>
            <p style="color: #64748b; font-size: 16px; line-height: 1.5;">
                Hola <strong>${name}</strong>, te confirmamos que la contraseña de tu cuenta en <strong>Kônsul Bills</strong> ha sido cambiada exitosamente.
            </p>
            <div class="alert">
                <strong>¿No fuiste tú?</strong> Si no realizaste este cambio, por favor contacta a nuestro equipo de seguridad de inmediato respondiendo a este correo o ingresando a la plataforma para restablecer tu acceso.
            </div>
            <div class="footer">
                Enviado por el equipo de seguridad de Kônsul Bills.
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Tu contraseña ha sido cambiada 🛡️',
        html: html,
        senderName: 'Seguridad Kônsul'
    });
};

/**
 * Checks the status of a sent email
 */
export const getEmailStatus = async (id: string): Promise<any> => {
  try {
    const response = await fetch(`/api/status?id=${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
};

/**
 * Sends the Welcome Email
 */
export const sendWelcomeEmail = async (user: UserProfile) => {
    const loginUrl = window.location.origin; 
    return sendEmail({
        to: user.email!,
        subject: 'Bienvenido a Kônsul 🚀',
        templateId: 'welcome-to-konsul-bills',
        senderName: 'Equipo Kônsul',
        data: {
            name: user.name,
            login_url: loginUrl,
            email: user.email
        }
    });
};

/**
 * Generates the Professional HTML Template for Invoice/Quote.
 */
export const generateDocumentHtml = (invoice: Invoice, issuer: UserProfile): string => {
  const isQuote = invoice.type === 'Quote';
  const docTypeLabel = isQuote ? 'Cotización' : 'Factura';
  const color = issuer.branding?.primaryColor || '#1c2938';
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%;">
        <tr>
            <td style="padding: 40px 0; text-align: center;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="background-color: ${color}; padding: 40px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">${issuer.name}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="color: #64748b; font-size: 16px; margin-bottom: 24px;">Hola <strong>${invoice.clientName}</strong>,</p>
                            <p style="color: #334155; font-size: 18px; line-height: 1.6; margin-bottom: 32px;">
                                Te enviamos la <strong>${docTypeLabel} #${invoice.id}</strong>.
                                <br>Encontrarás el documento PDF adjunto a este correo para tu revisión.
                            </p>
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                                <tr>
                                    <td style="padding: 24px; text-align: center;">
                                        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; margin: 0 0 8px 0;">Total a Pagar</p>
                                        <p style="color: #1c2938; font-size: 32px; font-weight: 800; margin: 0;">${invoice.currency} ${invoice.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
                            <p style="color: #94a3b8; font-size: 12px; margin: 0;">Enviado a través de Kônsul por ${issuer.name}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
};
