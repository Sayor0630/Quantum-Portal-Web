// Define Roles
export enum Role {
  SUPERADMIN = "superadmin",
  ADMIN = "admin",
  ORDER_MANAGER = "order_manager",
}

// Define Permissions
export enum Permission {
  CREATE_ORDER = "create_order",
  VIEW_ORDERS = "view_orders",
  MANAGE_PAYMENT_METHODS = "manage_payment_methods",
  MANAGE_CUSTOMERS = "manage_customers", // New permission
  MANAGE_BRANDS = "manage_brands", // Brand management permission
  // Add more permissions as needed
}

// Assign Permissions to Roles
// Important: For SUPERADMIN using Object.values(Permission), ensure this map is defined AFTER the Permission enum is fully populated.
export const rolePermissions: Record<Role, Permission[]> = {
  [Role.SUPERADMIN]: Object.values(Permission), // Superadmin can do everything
  [Role.ADMIN]: [
    Permission.CREATE_ORDER,
    Permission.VIEW_ORDERS,
    Permission.MANAGE_PAYMENT_METHODS,
    Permission.MANAGE_CUSTOMERS, // Assign to Admin
    Permission.MANAGE_BRANDS, // Assign to Admin
  ],
  [Role.ORDER_MANAGER]: [Permission.CREATE_ORDER, Permission.VIEW_ORDERS],
};

// Function to check if a role has a specific permission
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}
