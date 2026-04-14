/**
 * Security Headers Configuration
 * 
 * Provides security headers for Next.js responses
 * Implements OWASP security best practices
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Content Security Policy configuration
 * Adjust based on your application's needs
 */
const CSP_POLICY = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Next.js
    "'unsafe-eval'", // Required for Next.js in development
    'https://js.stripe.com', // Stripe
    'https://*.clerk.accounts.dev', // Clerk
    'https://*.clerk.com', // Clerk
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Tailwind CSS
    'https://fonts.googleapis.com',
  ],
  fontSrc: [
    "'self'",
    'https://fonts.gstatic.com',
    'data:',
  ],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https://*.supabase.co', // Supabase storage
    'https://*.stripe.com', // Stripe images
    'https://*.clerk.com', // Clerk avatars
  ],
  connectSrc: [
    "'self'",
    'https://*.supabase.co', // Supabase API
    'https://api.stripe.com', // Stripe API
    'https://*.clerk.accounts.dev', // Clerk
    'https://*.clerk.com', // Clerk
    'https://*.accounts.dev', // Clerk dev instance (e.g. devoted-mastiff-36.accounts.dev)
    'https://clerk.com', // Clerk
  ],
  workerSrc: [
    "'self'",
    'blob:', // Clerk creates workers from blob URLs
  ],
  frameSrc: [
    "'self'",
    'https://js.stripe.com', // Stripe checkout
    'https://*.stripe.com', // Stripe
    'https://*.clerk.accounts.dev', // Clerk
    'https://*.accounts.dev', // Clerk dev instance
    'https://*.clerk.com', // Clerk
  ],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : undefined,
} as const;

/**
 * Convert camelCase to kebab-case for CSP directive names
 * e.g. "defaultSrc" -> "default-src", "imgSrc" -> "img-src"
 */
function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * Generate Content Security Policy header string
 */
function generateCSP(): string {
  const directives: string[] = [];

  for (const [directive, sources] of Object.entries(CSP_POLICY)) {
    if (sources === undefined) continue;

    const kebabDirective = camelToKebab(directive);

    if (Array.isArray(sources) && sources.length === 0) {
      // Directives like upgrade-insecure-requests take no values
      directives.push(kebabDirective);
    } else if (Array.isArray(sources) && sources.length > 0) {
      directives.push(`${kebabDirective} ${sources.join(' ')}`);
    }
  }

  return directives.join('; ');
}

/**
 * Security headers configuration
 */
export const securityHeaders = {
  // Content Security Policy
  'Content-Security-Policy': generateCSP(),
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS Protection (legacy, but still useful)
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()', // Disable FLoC
  ].join(', '),
  
  // Strict Transport Security (HSTS) - only in production with HTTPS
  ...(process.env.NODE_ENV === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }),
} as const;

/**
 * CORS configuration
 */
export interface CORSConfig {
  origin: string | string[] | ((origin: string | null) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'https://homeaway-hub.vercel.app',
].filter(Boolean) as string[];

export const corsConfig: CORSConfig = {
  origin: (origin) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return true;
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) return true;
    
    // In development, allow localhost
    if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost')) {
      return true;
    }
    
    return false;
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Apply all security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  return response;
}

/**
 * Handle CORS preflight request
 */
export function handleCORS(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  
  // Handle preflight request
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    // Check if origin is allowed
    const isAllowed = typeof corsConfig.origin === 'function'
      ? corsConfig.origin(origin)
      : Array.isArray(corsConfig.origin)
      ? corsConfig.origin.includes(origin || '')
      : corsConfig.origin === origin;
    
    if (isAllowed && origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', corsConfig.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', corsConfig.allowedHeaders?.join(', ') || 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', corsConfig.credentials ? 'true' : 'false');
      response.headers.set('Access-Control-Max-Age', String(corsConfig.maxAge || 86400));
    }
    
    return applySecurityHeaders(response);
  }
  
  return null;
}

/**
 * Apply CORS headers to response
 */
export function applyCORSHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin');
  
  const isAllowed = typeof corsConfig.origin === 'function'
    ? corsConfig.origin(origin)
    : Array.isArray(corsConfig.origin)
    ? corsConfig.origin.includes(origin || '')
    : corsConfig.origin === origin;
  
  if (isAllowed && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', corsConfig.credentials ? 'true' : 'false');
    
    // Add exposed headers
    if (corsConfig.exposedHeaders) {
      response.headers.set('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
    }
  }
  
  return response;
}

