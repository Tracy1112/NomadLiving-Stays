import NavSearch from './NavSearch';
import LinksDropdown from './LinksDropdown';
import DarkMode from './DarkMode';
import Logo from './Logo';
import Link from 'next/link';
import { Button } from '../ui/button';
import { LuShoppingBag, LuSparkles } from 'react-icons/lu';

/**
 * Main navigation bar component
 * 
 * Features:
 * - Logo and brand name
 * - Search functionality
 * - "Shop the Look" button linking to NomadLiving Boutique
 * - Dark mode toggle
 * - User menu dropdown
 */
function Navbar() {
  return (
    <nav className='border-b'>
      <div className='container flex flex-col sm:flex-row sm:justify-between sm:items-center flex-wrap gap-4 py-8'>
        <Logo />
        <NavSearch />
        <div className='flex gap-4 items-center'>
          <Button variant='outline' asChild className='hidden sm:flex border-2 border-primary text-primary bg-background hover:bg-primary/20 hover:text-primary hover:border-primary shadow-sm hover:shadow-md transition-all duration-200 font-semibold'>
            <Link href='/assistant'>
              <LuSparkles className='w-4 h-4 mr-2' />
              Ask AI
            </Link>
          </Button>
          <Button variant='default' asChild className='hidden sm:flex bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 font-semibold'>
            <Link href='https://nomadliving-boutique.vercel.app' target='_blank' rel='noopener noreferrer'>
              <LuShoppingBag className='w-4 h-4 mr-2' />
              Shop the Look
            </Link>
          </Button>
          <DarkMode />
          <LinksDropdown />
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
