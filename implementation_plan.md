# Fix Admin Account Management Features

The superadmin actions (edit permissions, deactivate admin, change password) are failing to take full effect in the application because they are updating the local MongoDB `Admin` document, but are not propagating these changes to Clerk's `publicMetadata`.

Since the application (including the middleware and admin panel UI) relies on `sessionClaims.publicMetadata` to determine permissions and authentication state, the frontend does not receive the updated permissions or deactivated status until Clerk is manually updated.

## Proposed Changes

---

### `lib/services/clerk.service.ts`

Update the Clerk service to handle `permissions` in the metadata.

#### [MODIFY] `lib/services/clerk.service.ts`
- Add `permissions?: Record<string, boolean>` to the `UpdateAdminMetadataParams` interface.
- In `updateAdminMetadata()`, if `permissions` is provided in the parameters, attach it to the `publicMetadata` payload sent to Clerk. Since Clerk's `updateUserMetadata` performs a shallow merge, this will overwrite the old permissions object with the new one.

---

### `lib/services/admin.service.ts`

Ensure that we sync state with Clerk whenever an admin's permissions or status change.

#### [MODIFY] `lib/services/admin.service.ts`
- **`createAdmin()`**: After saving the admin to the database (where the initial `permissions` are calculated based on the role), call `clerkService.updateAdminMetadata` to push the initial `permissions` to the new user's Clerk `publicMetadata`.
- **`updateAdminPermissions()`**: After the new permissions are saved to the database, call `clerkService.updateAdminMetadata` and pass the new `admin.permissions` to synchronize them with Clerk immediately.
- **`toggleAdminStatus()`**: Deactivating an admin should revoke their session and prevent them from logging in. When `isActive` is `false`, call `clerkService.setAdminLockStatus(admin.clerkId, true)` (which bans the user in Clerk). When `isActive` is `true`, call it with `false` to unban them.

---

## Verification Plan

### Manual Verification
- Log in as a superadmin.
- Deactivate an admin and verify that they are banned in Clerk and cannot log in. Reactivate and verify they can log in.
- Edit an admin's permissions and verify that the changes immediately reflect in their Clerk `publicMetadata` (by checking the Clerk dashboard or the logged-in admin's session claims).
- Create a new admin and verify they get their initial permissions populated in their Clerk `publicMetadata` upon creation.
