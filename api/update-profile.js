import { updateUserProfileInDb } from '../services/neon';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile } = req.body;

  if (!profile || !profile.id) {
    return res.status(400).json({ error: 'Profile data is required' });
  }

  try {
    const success = await updateUserProfileInDb(profile);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update profile in database' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ error: error.message || 'Error updating profile' });
  }
}
