// This is the root page.
// It will now render the content from our main store homepage,
// which is defined in app/(store)/page.tsx.

import StoreHomePage from './(store)/page';

export default StoreHomePage;

// Alternatively, if StoreHomePage needs to remain a server component
// and you want this root page.tsx to also be a server component that
// potentially does other root-level things before rendering the store home:
// export default async function RootPage() {
//   // Any root-specific logic or data fetching can go here if needed in future.
//   // For now, just render the StoreHomePage.
//   return <StoreHomePage />;
// }

// The metadata for the homepage should ideally be in app/(store)/page.tsx
// or this root page.tsx if it's considered the primary entry.
// For now, root layout.tsx has generic metadata.
// Specific page metadata can be exported from app/(store)/page.tsx if needed.
/*
export const metadata = {
  title: 'Welcome to Our Store!', // Example specific title for homepage
  description: 'Discover amazing products and offers.',
};
*/
