import { Role, Permission, hasPermission, rolePermissions } from './permissions';

describe('hasPermission', () => {
  // Test Superadmin
  it('Superadmin should have all defined permissions', () => {
    const allPermissions = Object.values(Permission);
    allPermissions.forEach(permission => {
      expect(hasPermission(Role.SUPERADMIN, permission)).toBe(true);
    });
  });

  it('Superadmin should have a specific permission like CREATE_ORDER', () => {
    expect(hasPermission(Role.SUPERADMIN, Permission.CREATE_ORDER)).toBe(true);
  });

  it('Superadmin should have a specific permission like MANAGE_PAYMENT_METHODS', () => {
    expect(hasPermission(Role.SUPERADMIN, Permission.MANAGE_PAYMENT_METHODS)).toBe(true);
  });

  // Test Admin
  it('Admin should have CREATE_ORDER permission', () => {
    expect(hasPermission(Role.ADMIN, Permission.CREATE_ORDER)).toBe(true);
  });

  it('Admin should have MANAGE_PAYMENT_METHODS permission', () => {
    expect(hasPermission(Role.ADMIN, Permission.MANAGE_PAYMENT_METHODS)).toBe(true);
  });

  it('Admin should not have a permission not assigned to them (if we add more specific ones later)', () => {
    // Example: if a MANAGE_USERS permission was added and not given to ADMIN
    // For now, this test is more of a placeholder for future expansion.
    // We can test against a hypothetical permission.
    const hypotheticalPermission = 'MANAGE_USERS' as Permission;
    // Ensure this hypothetical permission is not accidentally part of ADMIN's actual permissions
    if (!rolePermissions[Role.ADMIN].includes(hypotheticalPermission)) {
        expect(hasPermission(Role.ADMIN, hypotheticalPermission)).toBe(false);
    } else {
        // This case means the hypothetical permission is actually assigned, so the test setup is wrong.
        // This acts as a safeguard for the test itself.
        console.warn(`Warning: Hypothetical permission ${hypotheticalPermission} is actually assigned to Admin. Test needs adjustment.`);
        expect(true).toBe(true); // Avoid failing the test due to test setup
    }
  });

  // Test Order Manager
  it('Order Manager should have CREATE_ORDER permission', () => {
    expect(hasPermission(Role.ORDER_MANAGER, Permission.CREATE_ORDER)).toBe(true);
  });

  it('Order Manager should NOT have MANAGE_PAYMENT_METHODS permission', () => {
    expect(hasPermission(Role.ORDER_MANAGER, Permission.MANAGE_PAYMENT_METHODS)).toBe(false);
  });

  // Test edge cases or invalid inputs
  it('should return false for a role that does not exist', () => {
    const fakeRole = 'FAKE_ROLE' as Role;
    expect(hasPermission(fakeRole, Permission.CREATE_ORDER)).toBe(false);
  });

  it('should return false for a permission that does not exist for a valid role', () => {
    const fakePermission = 'FAKE_PERMISSION' as Permission;
    expect(hasPermission(Role.ADMIN, fakePermission)).toBe(false);
  });

  it('should return false if the role has no permissions array (though current setup always assigns one)', () => {
    // This tests a hypothetical scenario where a role might be in the enum but not in rolePermissions map
    const originalRolePermissions = { ...rolePermissions };
    const testRoleWithoutEntry = "TEST_ROLE_NO_ENTRY" as Role;

    // Temporarily modify rolePermissions for this test case if the role isn't already there
    // @ts-ignore
    if (!rolePermissions[testRoleWithoutEntry]) {
        // @ts-ignore
        delete rolePermissions[testRoleWithoutEntry]; // Ensure it's deleted if it was somehow added by other tests
    }

    // @ts-ignore
    expect(hasPermission(testRoleWithoutEntry, Permission.CREATE_ORDER)).toBe(false);

    // Restore original (not strictly necessary if run in isolation but good practice)
    // @ts-ignore
    Object.keys(originalRolePermissions).forEach(key => rolePermissions[key] = originalRolePermissions[key]);
    // @ts-ignore
    Object.keys(rolePermissions).filter(key => !originalRolePermissions[key]).forEach(key => delete rolePermissions[key]);


  });
});
