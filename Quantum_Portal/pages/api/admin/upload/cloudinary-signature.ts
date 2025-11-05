import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; // Adjust path
import { createHash } from 'node:crypto';

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

const loadCloudinaryConfig = (): CloudinaryConfig | null => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
  };
};

let cachedCloudinaryConfig = loadCloudinaryConfig();

if (cachedCloudinaryConfig) {
  console.log('Cloudinary environment variables detected at module load.');
} else {
  console.warn('Cloudinary environment variables not fully set. Signature generation will fail until they are configured.');
}

const ensureCloudinaryConfig = (): CloudinaryConfig | null => {
  if (cachedCloudinaryConfig) {
    return cachedCloudinaryConfig;
  }

  const config = loadCloudinaryConfig();
  if (config) {
    cachedCloudinaryConfig = config;
    console.log('Cloudinary environment variables loaded at request time.');
  }

  return cachedCloudinaryConfig;
};

const signCloudinaryParams = (
  params: Record<string, string | number | undefined>,
  apiSecret: string,
): string => {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const normalizedValue = Array.isArray(value) ? value.join(',') : String(value);
      return `${key}=${normalizedValue}`;
    })
    .sort()
    .join('&');

  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
};


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

  const cloudinaryConfig = ensureCloudinaryConfig();
  if (!cloudinaryConfig) {
    console.error('Cloudinary environment variables missing. Signature generation unavailable.');
    return res.status(500).json({ message: 'Cloudinary service not properly configured on the server.' });
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const paramsToSign: Record<string, string | number | undefined> = {
      timestamp,
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

    const signature = signCloudinaryParams(paramsToSign, cloudinaryConfig.apiSecret);

    return res.status(200).json({
      signature,
      timestamp,
      api_key: cloudinaryConfig.apiKey,
      cloud_name: cloudinaryConfig.cloudName,
      folder: paramsToSign.folder,
      public_id: paramsToSign.public_id, // Return if it was part of paramsToSign
      tags: paramsToSign.tags, // Return if it was part of paramsToSign
    });

  } catch (error) {
    console.error('Error generating Cloudinary signature:', error);
    return res.status(500).json({ message: 'Error generating Cloudinary signature', error: (error as Error).message });
  }
}
