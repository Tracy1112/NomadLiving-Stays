/**
 * Property Actions
 * 
 * Server actions for property (rental listing) management
 * @module actions/property
 */

'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { propertySchema, imageSchema, validateWithZodSchema } from '../schemas';
import db from '../db';
import { uploadImage } from '../supabase';
import {
  ValidationError,
  DatabaseError,
  ExternalServiceError,
  handleServerActionError,
  ensureExists,
} from '../errors';
import { getAuthUser } from './auth';

/**
 * Create a new property listing
 * 
 * Creates a property with validated form data and uploads the property image.
 * Invalidates the properties cache after creation.
 * 
 * @param {any} prevState - Previous form state (unused)
 * @param {FormData} formData - Form data containing property details and image
 * @returns {Promise<{message: string}>} Redirects to home page on success
 * @throws {ValidationError} If image is missing or invalid
 * @throws {ExternalServiceError} If image upload fails
 * @throws {DatabaseError} If property creation fails
 * 
 * @example
 * ```ts
 * await createPropertyAction({}, formData);
 * ```
 */
export async function createPropertyAction(
  prevState: any,
  formData: FormData
): Promise<{ message: string }> {
  const user = await getAuthUser();
  try {
    const rawData = Object.fromEntries(formData);
    const file = formData.get('image') as File;
    
    if (!file) {
      throw new ValidationError('Property image is required', 'image');
    }

    const validatedFields = validateWithZodSchema(propertySchema, rawData);
    const validatedFile = validateWithZodSchema(imageSchema, { image: file });
    
    let fullPath: string;
    try {
      fullPath = await uploadImage(validatedFile.image);
    } catch (error) {
      throw new ExternalServiceError('Supabase', 'Failed to upload property image', { error });
    }

    try {
      await db.property.create({
        data: {
          ...validatedFields,
          image: fullPath,
          profileId: user.id,
        },
      });
      // Invalidate properties cache
      revalidateTag('properties');
    } catch (error) {
      throw new DatabaseError('Failed to create property', { error, validatedFields });
    }
  } catch (error) {
    return handleServerActionError(error);
  }
  redirect('/');
}

// Module-level cache for property listings (10 minute cache)
const getCachedProperties = unstable_cache(
  async (searchParam: string, categoryParam?: string) => {
    return db.property.findMany({
      where: {
        ...(categoryParam && { category: categoryParam }),
        ...(searchParam && {
          OR: [
            { name: { contains: searchParam, mode: 'insensitive' } },
            { tagline: { contains: searchParam, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        tagline: true,
        country: true,
        price: true,
        image: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  },
  ['properties'],
  {
    revalidate: 600, // 10 minute cache
    tags: ['properties'],
  }
);

/**
 * Fetch properties with optional search and category filters
 *
 * Uses module-level caching to optimize frequent queries (10 minute cache).
 * Limits results to 100 properties to avoid excessive data loading.
 */
export async function fetchProperties({
  search = '',
  category,
}: {
  search?: string;
  category?: string;
}) {
  return getCachedProperties(search, category);
}

/**
 * Fetch detailed property information by ID
 * 
 * Includes related profile information and confirmed bookings.
 * Uses caching to optimize queries (10 minute cache).
 * 
 * @param {string} id - Property ID
 * @returns {Promise<Property | null>} Property with profile and bookings, or null if not found
 * 
 * @example
 * ```ts
 * const property = await fetchPropertyDetails('prop_123');
 * ```
 */
// Module-level cache for property detail pages (10 minute cache)
const getCachedPropertyDetails = unstable_cache(
  async (propertyId: string) => {
    return db.property.findUnique({
      where: { id: propertyId },
      include: {
        profile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            clerkId: true,
          },
        },
        bookings: {
          select: {
            checkIn: true,
            checkOut: true,
          },
          where: {
            paymentStatus: true,
          },
        },
      },
    });
  },
  ['property-details'],
  {
    revalidate: 600, // 10 minute cache
    tags: ['property-details'],
  }
);

/**
 * Fetch detailed property information by ID
 *
 * Uses module-level caching to optimize queries (10 minute cache).
 */
export async function fetchPropertyDetails(id: string) {
  return getCachedPropertyDetails(id);
}

/**
 * Update an existing property
 * 
 * Validates that the property exists and belongs to the current user.
 * Updates property fields with validated form data.
 * 
 * @param {any} prevState - Previous form state (unused)
 * @param {FormData} formData - Form data containing property ID and fields to update
 * @returns {Promise<{message: string}>} Success message
 * @throws {ValidationError} If property ID is missing
 * @throws {NotFoundError} If property doesn't exist or doesn't belong to user
 * 
 * @example
 * ```ts
 * const result = await updatePropertyAction({}, formData);
 * ```
 */
export async function updatePropertyAction(
  prevState: any,
  formData: FormData
): Promise<{ message: string }> {
  const user = await getAuthUser();
  const propertyId = formData.get('id') as string;

  try {
    if (!propertyId) {
      throw new ValidationError('Property ID is required', 'id');
    }

    // Verify property exists and belongs to current user
    const property = await db.property.findFirst({
      where: {
        id: propertyId,
        profileId: user.id,
      },
    });
    ensureExists(property, 'Property');

    const rawData = Object.fromEntries(formData);
    const validatedFields = validateWithZodSchema(propertySchema, rawData);
    
    await db.property.update({
      where: {
        id: propertyId,
        profileId: user.id,
      },
      data: {
        ...validatedFields,
      },
    });

    revalidatePath(`/rentals/${propertyId}/edit`);
    return { message: 'Update Successful' };
  } catch (error) {
    return handleServerActionError(error);
  }
}

/**
 * Update property image
 * 
 * Uploads a new image to Supabase and updates the property record.
 * Validates that the property exists and belongs to the current user.
 * 
 * @param {any} prevState - Previous form state (unused)
 * @param {FormData} formData - Form data containing property ID and image file
 * @returns {Promise<{message: string}>} Success message
 * @throws {ValidationError} If property ID or image is missing
 * @throws {ExternalServiceError} If image upload fails
 * @throws {NotFoundError} If property doesn't exist or doesn't belong to user
 * 
 * @example
 * ```ts
 * const result = await updatePropertyImageAction({}, formData);
 * ```
 */
export async function updatePropertyImageAction(
  prevState: any,
  formData: FormData
): Promise<{ message: string }> {
  const user = await getAuthUser();
  const propertyId = formData.get('id') as string;

  try {
    if (!propertyId) {
      throw new ValidationError('Property ID is required', 'id');
    }

    // Verify property exists and belongs to current user
    const property = await db.property.findFirst({
      where: {
        id: propertyId,
        profileId: user.id,
      },
    });
    ensureExists(property, 'Property');

    const image = formData.get('image') as File;
    if (!image) {
      throw new ValidationError('Image is required', 'image');
    }

    const validatedFields = validateWithZodSchema(imageSchema, { image });
    
    let fullPath: string;
    try {
      fullPath = await uploadImage(validatedFields.image);
    } catch (error) {
      throw new ExternalServiceError('Supabase', 'Failed to upload property image', { error });
    }

    await db.property.update({
      where: {
        id: propertyId,
        profileId: user.id,
      },
      data: {
        image: fullPath,
      },
    });
    revalidatePath(`/rentals/${propertyId}/edit`);
    return { message: 'Property Image Updated Successful' };
  } catch (error) {
    return handleServerActionError(error);
  }
}

