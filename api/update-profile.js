import { updateUserProfileInDb } from '../services/neon.ts';

export default async function handler(req, res) {
  // Asegurar que siempre devolvamos JSON
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { profile } = req.body;

    if (!profile || !profile.id) {
      return res.status(400).json({ error: 'Profile data is required' });
    }
    
    const success = await updateUserProfileInDb(profile);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update profile in database' });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update Profile API Error:', error);
    // Asegurar que siempre devolvamos JSON, incluso en caso de error
    const errorMessage = error instanceof Error ? error.message : 'Error updating profile';
    return res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
