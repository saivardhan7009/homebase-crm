// src/validators/propertyValidator.js
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.js';

export const validateCreateProperty = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().isString(),
  body('price').isNumeric().withMessage('Valid numeric price is required'),
  body('property_type')
    .isIn(['apartment', 'villa', 'house', 'plot', 'commercial', 'penthouse', 'studio', 'townhouse'])
    .withMessage('Valid property type is required'),
  body('listing_type')
    .isIn(['buy', 'rent', 'lease'])
    .withMessage('Listing type must be buy, rent, or lease'),
  body('bedrooms').optional().isInt({ min: 0 }).withMessage('Bedrooms must be a non-negative integer'),
  body('bathrooms').optional().isFloat({ min: 0 }).withMessage('Bathrooms must be a non-negative number'),
  body('sqft').optional().isNumeric().withMessage('Sqft must be a positive number'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').optional().trim(),
  body('zip').optional().trim(),
  body('latitude').optional().isNumeric(),
  body('longitude').optional().isNumeric(),
  body('year_built').optional().isInt({ min: 1800, max: 2100 }),
  body('amenities').optional().isArray(),
  body('images').optional().isArray(),
  validate,
];

export const validateUpdateProperty = [
  param('id').isUUID().withMessage('Invalid property ID format'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('property_type').optional().isIn(['apartment', 'villa', 'house', 'plot', 'commercial', 'penthouse', 'studio', 'townhouse']),
  body('listing_type').optional().isIn(['buy', 'rent', 'lease']),
  body('status').optional().isIn(['active', 'under_contract', 'sold', 'rented', 'inactive']),
  validate,
];

export const validatePropertyId = [
  param('id').isUUID().withMessage('Invalid property ID format'),
  validate,
];
