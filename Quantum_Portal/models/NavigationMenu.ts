import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for a single menu item (can be nested)
interface IMenuItem extends Document { // Extending Document to allow for _id if we make it a subdocument with its own _id later
  title: string;
  url: string;
  order: number;
  children: IMenuItem[]; // Array of sub-menu items
}

// Schema for a single menu item
// We define it separately to allow recursion for the 'children' field
const MenuItemSchema = new Schema<IMenuItem>({
  title: { type: String, required: true },
  url: { type: String, required: true },
  order: { type: Number, default: 0 },
  // Children will be an array of this same schema
});
MenuItemSchema.add({ children: [MenuItemSchema] }); // Recursive definition

// Interface for the main navigation menu
interface INavigationMenu extends Document {
  name: string; // e.g., "Main Header", "Footer Links"
  items: IMenuItem[];
  createdAt: Date;
  updatedAt: Date;
}

// Schema for the main navigation menu
const NavigationMenuSchema: Schema<INavigationMenu> = new Schema({
  name: { type: String, required: true, unique: true },
  items: [MenuItemSchema],
}, { timestamps: true });

const NavigationMenu: Model<INavigationMenu> = mongoose.models.NavigationMenu || mongoose.model<INavigationMenu>('NavigationMenu', NavigationMenuSchema);

export default NavigationMenu;
export type { INavigationMenu, IMenuItem };
