// Define Roles
export enum Role {
  SUPERADMIN = "superadmin",
  ADMIN = "admin",
  ORDER_MANAGER = "order_manager",
}

// Define Permissions
export enum Permission {
  CREATE_ORDER = "create_order",
  MANAGE_PAYMENT_METHODS = "manage_payment_methods",
  MANAGE_CUSTOMERS = "manage_customers", // New permission
  // Add more permissions as needed
}

// Assign Permissions to Roles
// Important: For SUPERADMIN using Object.values(Permission), ensure this map is defined AFTER the Permission enum is fully populated.
export const rolePermissions: Record<Role, Permission[]> = {
  [Role.SUPERADMIN]: Object.values(Permission), // Superadmin can do everything
  [Role.ADMIN]: [
    Permission.CREATE_ORDER,
    Permission.MANAGE_PAYMENT_METHODS,
    Permission.MANAGE_CUSTOMERS, // Assign to Admin
  ],
  [Role.ORDER_MANAGER]: [Permission.CREATE_ORDER],
};

// Function to check if a role has a specific permission
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}
