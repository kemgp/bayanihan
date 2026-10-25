// Presentation catalog only. Booking, worker availability and additional payout mappings are deferred.
export const categories = [
  { id: 'assembly', name: 'Assembly', description: 'Furniture, fitted together.' },
  { id: 'carpentry', name: 'Carpentry', description: 'Woodwork and everyday repairs.' },
  { id: 'plumbing', name: 'Plumbing', description: 'Help with pipes and fixtures.' },
  { id: 'electrical', name: 'Electrical', description: 'Help with home electrical work.' },
  { id: 'cleaning', name: 'Cleaning', description: 'A fresh start for your space.' },
  { id: 'painting', name: 'Painting', description: 'A new look for familiar spaces.' },
] as const;
export type CategoryId = typeof categories[number]['id'];
export type CategoryFilter = CategoryId | 'all';
export const assemblyService = {
  id: 'furniture-assembly', category: 'assembly', title: 'Furniture assembly',
  description: 'A helping hand for your next flat-pack project. Explore the labor-only service example, then try a transparent Testnet payment.',
  tags: ['Furniture', 'Flat-pack', 'Labor only'],
  includes: ['Assembly of a small freestanding furniture item', 'Following the manufacturer’s assembly instructions', 'A basic stability check and tidy work area'],
  excludes: ['Furniture, replacement parts and materials', 'Wall mounting, electrical work or structural changes', 'Delivery and disposal of existing furniture'],
} as const;
export function filterServices(category: CategoryFilter, query: string) {
  const search = query.trim().toLocaleLowerCase();
  return [assemblyService].filter(service => (category === 'all' || category === service.category)
    && `${service.title} ${service.description} ${service.tags.join(' ')}`.toLocaleLowerCase().includes(search));
}
