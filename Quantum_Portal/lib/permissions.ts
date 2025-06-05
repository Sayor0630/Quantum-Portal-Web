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
  // Add more permissions as needed
}

// Assign Permissions to Roles
export const rolePermissions: Record<Role, Permission[]> = {
  [Role.SUPERADMIN]: Object.values(Permission), // Superadmin can do everything
  [Role.ADMIN]: [Permission.CREATE_ORDER, Permission.MANAGE_PAYMENT_METHODS],
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
