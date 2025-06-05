import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Adjust path
import { v2 as cloudinary } from 'cloudinary'; // Using Cloudinary v2 SDK

// Configure Cloudinary. This block will run when the API route is loaded.
// Ensure your environment variables are set in .env.local:
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true, // Use https
    });
    console.log("Cloudinary configured successfully via environment variables.");
} else {
    console.warn('Cloudinary environment variables not fully set. Signature generation will likely fail if this persists.');
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Optional: Role check if needed
  // if ((session.user as { role?: string })?.role !== 'admin') { // Or specific role
  //    return res.status(403).json({ message: 'Forbidden' });
  // }


  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Double check Cloudinary config at runtime, in case env vars were loaded after initial config.
  // This is mostly for serverless environments or if there are concerns about init order.
  if (!cloudinary.config().cloud_name || !cloudinary.config().api_key || !cloudinary.config().api_secret) {
    console.error('Cloudinary is not configured. Check server logs for environment variable issues.');
    // Attempt to reconfigure if variables are present now but weren't at module load time
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });
        console.log("Cloudinary re-configured successfully at runtime.");
    } else {
        return res.status(500).json({ message: 'Cloudinary service not properly configured on the server.' });
    }
  }


  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const paramsToSign: Record<string, any> = {
      timestamp: timestamp,
    };

    const folder = req.body.folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'ecommerce_platform_default';
    if (folder) {
        paramsToSign.folder = folder;
    }
    if (req.body.public_id) { // Optional: Allow client to suggest a public_id
        paramsToSign.public_id = req.body.public_id;
    }
    if (req.body.tags) { // Optional: Allow client to send tags
        paramsToSign.tags = req.body.tags;
    }
    // Example of other parameters that might be useful for signed uploads:
    // if (req.body.upload_preset) paramsToSign.upload_preset = req.body.upload_preset; // If using unsigned uploads with a named preset
    // if (req.body.transformation) paramsToSign.transformation = req.body.transformation; // For applying transformations on upload
    // if (req.body.format) paramsToSign.format = req.body.format; // To convert format on upload


    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return res.status(200).json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder: paramsToSign.folder,
      public_id: paramsToSign.public_id, // Return if it was part of paramsToSign
      tags: paramsToSign.tags, // Return if it was part of paramsToSign
    });

  } catch (error) {
    console.error('Error generating Cloudinary signature:', error);
    // Check if error is due to Cloudinary config issues not caught above
    if ((error as Error).message.toLowerCase().includes('must supply api_secret')) {
        return res.status(500).json({ message: 'Cloudinary API secret not configured correctly on server.'});
    }
    return res.status(500).json({ message: 'Error generating Cloudinary signature', error: (error as Error).message });
  }
}
