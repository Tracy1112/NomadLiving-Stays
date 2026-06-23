type NavLink = {
  href: string;
  label: string;
};

export const links: NavLink[] = [
  { href: '/', label: 'home' },
  { href: '/assistant', label: 'ask ai' },
  { href: '/favorites', label: 'saved stays' },
  { href: '/bookings', label: 'my trips' },
  { href: '/reviews', label: 'reviews' },
  { href: '/reservations', label: 'host reservations' },
  { href: '/rentals/create', label: 'list your property' },
  { href: '/rentals', label: 'my properties' },
  { href: '/admin', label: 'staff portal' },
  { href: '/profile', label: 'account' },
];
