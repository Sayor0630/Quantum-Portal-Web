import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import AttributeDefinition from '../../../../models/AttributeDefinition';
import Product from '../../../../models/Product'; // To update products on definition deletion
import mongoose from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { definitionId } = req.query;

  if (!definitionId || typeof definitionId !== 'string' || !mongoose.Types.ObjectId.isValid(definitionId)) {
     return res.status(400).json({ message: 'Invalid attribute definition ID' });
  }
  const definitionObjectId = new mongoose.Types.ObjectId(definitionId as string);


  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const definition = await AttributeDefinition.findById(definitionObjectId);
        if (!definition) {
          return res.status(404).json({ message: 'Attribute definition not found' });
        }
        return res.status(200).json(definition);
      } catch (error) {
        console.error(`Error fetching attribute definition ${definitionId}:`, error);
        return res.status(500).json({ message: 'Error fetching attribute definition', error: (error as Error).message });
      }

    case 'PUT':
      try {
        const { name, values } = req.body;
        // Name OR values must be provided. Values can be an empty array.
        if (name === undefined && values === undefined) {
             return res.status(400).json({ message: 'Either name or values must be provided for update.' });
        }
        if (values !== undefined && !Array.isArray(values)) {
            return res.status(400).json({ message: 'If provided, values must be an array.' });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = String(name).trim();
        if (values !== undefined) {
          // Ensure values are strings, trimmed, non-empty, and unique (model pre-save hook also does this)
          updateData.values = Array.from(new Set(values.map((v: any) => String(v).trim()).filter((v: string) => v !== '')));
        }

        const updatedDefinition = await AttributeDefinition.findByIdAndUpdate(
          definitionObjectId,
          updateData,
          { new: true, runValidators: true }
        );

        if (!updatedDefinition) {
          return res.status(404).json({ message: 'Attribute definition not found for update' });
        }
        // If name changed, may need to update products, but that's complex.
        // For now, changing definition name doesn't rename keys in Product.customAttributes.
        // This would require a more involved migration / update strategy for product data.
        return res.status(200).json(updatedDefinition);
      } catch (error) {
        if ((error as any).code === 11000 && (error as any).keyPattern?.name) {
          return res.status(409).json({ message: 'An attribute definition with this name already exists.' });
        }
        console.error(`Error updating attribute definition ${definitionId}:`, error);
        return res.status(500).json({ message: 'Error updating attribute definition', error: (error as Error).message });
      }

    case 'DELETE':
      try {
        const definitionToDelete = await AttributeDefinition.findById(definitionObjectId);
        if (!definitionToDelete) {
          return res.status(404).json({ message: 'Attribute definition not found for deletion' });
        }

        // Clear this attribute from all products' customAttributes
        // The attribute name is definitionToDelete.name
        // We need to unset the field `customAttributes.${definitionToDelete.name}`
        const attributeKeyToUnset = `customAttributes.${definitionToDelete.name}`;
        await Product.updateMany(
          { [attributeKeyToUnset]: { $exists: true } }, // Find products that have this attribute key
          { $unset: { [attributeKeyToUnset]: "" } } // Unset the key
        );

        await AttributeDefinition.findByIdAndDelete(definitionObjectId);
        return res.status(200).json({ message: `Attribute definition '${definitionToDelete.name}' deleted successfully and references in products cleared.` });
      } catch (error) {
        console.error(`Error deleting attribute definition ${definitionId}:`, error);
        return res.status(500).json({ message: 'Error deleting attribute definition', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
