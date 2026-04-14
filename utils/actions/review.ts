/**
 * Review Actions
 * 
 * Server actions for property reviews and ratings
 * @module actions/review
 */

'use server';

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { createReviewSchema, validateWithZodSchema } from '../schemas';
import db from '../db';
import { ConflictError, handleServerActionError, ensureExists } from '../errors';
import { getAuthUser } from './auth';

/**
 * Create a new review for a property
 * 
 * Validates that the property exists and the user hasn't already reviewed it.
 * Invalidates related caches after creation.
 * 
 * @param {any} prevState - Previous form state (unused)
 * @param {FormData} formData - Form data containing propertyId, rating, and comment
 * @returns {Promise<{message: string}>} Success message
 * @throws {ConflictError} If user has already reviewed this property
 * @throws {NotFoundError} If property doesn't exist
 * 
 * @example
 * ```ts
 * const result = await createReviewAction({}, formData);
 * ```
 */
export async function createReviewAction(prevState: any, formData: FormData) {
  const user = await getAuthUser();
  try {
    const rawData = Object.fromEntries(formData);
    const validatedFields = validateWithZodSchema(createReviewSchema, rawData);

    // Verify property exists
    const property = await db.property.findUnique({
      where: { id: validatedFields.propertyId },
      select: { id: true },
    });
    ensureExists(property, 'Property');

    // Check if user has already reviewed this property
    const existingReview = await db.review.findFirst({
      where: {
        propertyId: validatedFields.propertyId,
        profileId: user.id,
      },
    });
    if (existingReview) {
      throw new ConflictError('You have already reviewed this property');
    }

    await db.review.create({
      data: {
        ...validatedFields,
        profileId: user.id,
      },
    });
    // Invalidate related caches
    revalidatePath(`/properties/${validatedFields.propertyId}`);
    revalidateTag('property-reviews');
    revalidateTag('property-rating');
    revalidateTag(`property-${validatedFields.propertyId}`);
    return { message: 'Review submitted successfully' };
  } catch (error) {
    return handleServerActionError(error);
  }
}

/**
 * Fetch all reviews for a property
 * 
 * Uses caching to optimize queries (10 minute cache).
 * Limits results to 50 reviews to avoid excessive data loading.
 * 
 * @param {string} propertyId - Property ID
 * @returns {Promise<Review[]>} Array of reviews with profile information
 * 
 * @example
 * ```ts
 * const reviews = await fetchPropertyReviews('prop_123');
 * ```
 */
// Module-level cache for property reviews (10 minute cache)
const getCachedReviews = unstable_cache(
  async (propertyId: string) => {
    return db.review.findMany({
      where: { propertyId },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },
  ['property-reviews'],
  {
    revalidate: 600, // 10 minute cache
    tags: ['property-reviews'],
  }
);

/**
 * Fetch all reviews for a property
 *
 * Uses module-level caching to optimize queries (10 minute cache).
 */
export async function fetchPropertyReviews(propertyId: string) {
  return getCachedReviews(propertyId);
}

/**
 * Fetch all reviews created by the current user
 * 
 * @returns {Promise<Review[]>} Array of user's reviews with property information
 * 
 * @example
 * ```ts
 * const myReviews = await fetchPropertyReviewsByUser();
 * ```
 */
export async function fetchPropertyReviewsByUser() {
  const user = await getAuthUser();
  const reviews = await db.review.findMany({
    where: {
      profileId: user.id,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      property: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });
  return reviews;
}

/**
 * Delete a review
 * 
 * Validates that the review exists and belongs to the current user.
 * 
 * @param {Object} prevState - Previous state containing reviewId
 * @param {string} prevState.reviewId - Review ID to delete
 * @returns {Promise<{message: string}>} Success message
 * @throws {NotFoundError} If review doesn't exist or doesn't belong to user
 * 
 * @example
 * ```ts
 * const result = await deleteReviewAction({ reviewId: 'review_123' });
 * ```
 */
export async function deleteReviewAction(prevState: { reviewId: string }) {
  const { reviewId } = prevState;
  const user = await getAuthUser();

  try {
    // Verify review exists and belongs to current user
    const review = await db.review.findFirst({
      where: {
        id: reviewId,
        profileId: user.id,
      },
    });
    ensureExists(review, 'Review');

    await db.review.delete({
      where: {
        id: reviewId,
        profileId: user.id,
      },
    });

    revalidatePath('/reviews');
    return { message: 'Review deleted successfully' };
  } catch (error) {
    return handleServerActionError(error);
  }
}

/**
 * Find an existing review by user and property
 * 
 * @param {string} userId - User ID
 * @param {string} propertyId - Property ID
 * @returns {Promise<Review | null>} Review if exists, null otherwise
 * 
 * @example
 * ```ts
 * const review = await findExistingReview('user_123', 'prop_123');
 * ```
 */
export async function findExistingReview(
  userId: string,
  propertyId: string
) {
  return db.review.findFirst({
    where: {
      profileId: userId,
      propertyId: propertyId,
    },
  });
}

/**
 * Fetch property rating statistics
 * 
 * Calculates average rating and total review count for a property.
 * Uses caching to optimize queries (15 minute cache).
 * 
 * @param {string} propertyId - Property ID
 * @returns {Promise<{rating: string, count: number}>} Rating (as string with 1 decimal) and review count
 * 
 * @example
 * ```ts
 * const rating = await fetchPropertyRating('prop_123');
 * // { rating: '4.5', count: 10 }
 * ```
 */
// Module-level cache for property ratings (15 minute cache)
const getCachedRating = unstable_cache(
  async (propertyId: string) => {
    const result = await db.review.groupBy({
      by: ['propertyId'],
      _avg: { rating: true },
      _count: { rating: true },
      where: { propertyId },
    });
    return {
      rating: result[0]?._avg.rating?.toFixed(1) ?? '0',
      count: result[0]?._count.rating ?? 0,
    };
  },
  ['property-rating'],
  {
    revalidate: 900, // 15 minute cache
    tags: ['property-rating'],
  }
);

/**
 * Fetch property rating statistics
 *
 * Uses module-level caching to optimize queries (15 minute cache).
 */
export async function fetchPropertyRating(propertyId: string) {
  return getCachedRating(propertyId);
}

