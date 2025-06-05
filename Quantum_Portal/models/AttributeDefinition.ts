import mongoose, { Schema, Document, Model } from 'mongoose';

interface IAttributeDefinition extends Document {
  name: string; // e.g., "Color", "Size", "Material"
  values: string[]; // e.g., ["Red", "Blue", "Green"] or ["S", "M", "L"]
  createdAt: Date;
  updatedAt: Date;
}

const AttributeDefinitionSchema: Schema<IAttributeDefinition> = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  values: [{ type: String, trim: true }], // Array of possible string values
}, { timestamps: true });

// Ensure that values within the array are unique for a given attribute name
AttributeDefinitionSchema.pre('save', function(next) {
 if (this.isModified('values') && this.values) {
     // Filter out empty strings and then ensure uniqueness
     this.values = Array.from(new Set(this.values.map(v => v.trim()).filter(v => v !== '')));
 }
 next();
});

const AttributeDefinition: Model<IAttributeDefinition> = mongoose.models.AttributeDefinition || mongoose.model<IAttributeDefinition>('AttributeDefinition', AttributeDefinitionSchema);

export default AttributeDefinition;
export type { IAttributeDefinition };
