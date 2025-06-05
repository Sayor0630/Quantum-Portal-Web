import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import AttributeDefinition from '../../../../models/AttributeDefinition';
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const definitions = await AttributeDefinition.find({}).sort({ name: 1 });
        return res.status(200).json(definitions);
      } catch (error) {
        console.error('Error fetching attribute definitions:', error);
        return res.status(500).json({ message: 'Error fetching attribute definitions', error: (error as Error).message });
      }

    case 'POST':
      try {
        const { name, values } = req.body;
        if (!name || !values || !Array.isArray(values)) {
          return res.status(400).json({ message: 'Name and an array of values are required.' });
        }
        // Ensure values are strings, trimmed, non-empty, and unique (model pre-save hook also does this but good to be defensive)
        const processedValues = Array.from(new Set(values.map(v => String(v).trim()).filter(v => v !== '')));

        const newDefinition = await AttributeDefinition.create({ name: String(name).trim(), values: processedValues });
        return res.status(201).json(newDefinition);
      } catch (error) {
        if ((error as any).code === 11000) {
          return res.status(409).json({ message: 'An attribute definition with this name already exists.' });
        }
        console.error('Error creating attribute definition:', error);
        return res.status(500).json({ message: 'Error creating attribute definition', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
