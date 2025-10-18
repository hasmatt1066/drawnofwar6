/**
 * Task 4.4: Error Classification and Handling - Tests
 *
 * Tests for classifying errors from PixelLab API and determining retry eligibility.
 */

import { describe, it, expect } from 'vitest';
import { ErrorClassifier, ErrorType, ClassifiedError } from './error-classifier';
import { PixelLabError, PixelLabErrorType } from '../pixellab/errors';

describe('ErrorClassifier', () => {
  describe('classify', () => {
    describe('PixelLabError classification', () => {
      it('classifies authentication errors (401) as non-retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.AUTHENTICATION,
          message: 'Invalid API key',
          statusCode: 401,
          retryable: false,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.AUTHENTICATION);
        expect(result.retryable).toBe(false);
        expect(result.userMessage).toContain('authentication');
        expect(result.technicalDetails).toContain('Invalid API key');
        expect(result.originalError).toBe(error);
      });

      it('classifies forbidden errors (403) as non-retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.AUTHENTICATION,
          message: 'Forbidden access',
          statusCode: 403,
          retryable: false,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.AUTHENTICATION);
        expect(result.retryable).toBe(false);
      });

      it('classifies rate limit errors (429) as retryable with delay', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.RATE_LIMIT,
          message: 'Rate limit exceeded',
          statusCode: 429,
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.RATE_LIMIT);
        expect(result.retryable).toBe(true);
        expect(result.userMessage).toContain('rate limit');
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
      });

      it('classifies server errors (500) as retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Internal server error',
          statusCode: 500,
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.SERVER_ERROR);
        expect(result.retryable).toBe(true);
        expect(result.userMessage).toContain('server');
      });

      it('classifies service unavailable errors (503) as retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Service unavailable',
          statusCode: 503,
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.SERVER_ERROR);
        expect(result.retryable).toBe(true);
      });

      it('classifies timeout errors as retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.TIMEOUT,
          message: 'Request timed out',
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.TIMEOUT);
        expect(result.retryable).toBe(true);
        expect(result.userMessage).toContain('timeout');
      });

      it('classifies validation errors (400) as non-retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.VALIDATION,
          message: 'Invalid input',
          statusCode: 400,
          retryable: false,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(result.retryable).toBe(false);
        expect(result.userMessage).toContain('validation');
      });

      it('classifies unprocessable entity errors (422) as non-retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Unprocessable entity',
          statusCode: 422,
          retryable: false,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(result.retryable).toBe(false);
      });

      it('classifies network errors as retryable', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.NETWORK,
          message: 'Network connection failed',
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.NETWORK_ERROR);
        expect(result.retryable).toBe(true);
        expect(result.userMessage).toContain('network');
      });
    });

    describe('Generic Error classification', () => {
      it('classifies generic network errors (ECONNREFUSED) as retryable', () => {
        const error = new Error('connect ECONNREFUSED 127.0.0.1:8080');
        (error as any).code = 'ECONNREFUSED';

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.NETWORK_ERROR);
        expect(result.retryable).toBe(true);
        expect(result.userMessage).toContain('network');
        expect(result.technicalDetails).toContain('ECONNREFUSED');
      });

      it('classifies DNS errors (ENOTFOUND) as retryable', () => {
        const error = new Error('getaddrinfo ENOTFOUND api.example.com');
        (error as any).code = 'ENOTFOUND';

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.NETWORK_ERROR);
        expect(result.retryable).toBe(true);
      });

      it('classifies timeout errors (ETIMEDOUT) as retryable', () => {
        const error = new Error('Request timeout');
        (error as any).code = 'ETIMEDOUT';

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.TIMEOUT);
        expect(result.retryable).toBe(true);
      });

      it('classifies generic timeout errors by message as retryable', () => {
        const error = new Error('Request timed out after 30000ms');

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.TIMEOUT);
        expect(result.retryable).toBe(true);
      });
    });

    describe('HTTP status code classification (non-PixelLabError)', () => {
      it('classifies 401 errors as authentication failures', () => {
        const error = new Error('Unauthorized');
        (error as any).statusCode = 401;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.AUTHENTICATION);
        expect(result.retryable).toBe(false);
      });

      it('classifies 403 errors as authentication failures', () => {
        const error = new Error('Forbidden');
        (error as any).statusCode = 403;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.AUTHENTICATION);
        expect(result.retryable).toBe(false);
      });

      it('classifies 429 errors as rate limit', () => {
        const error = new Error('Too Many Requests');
        (error as any).statusCode = 429;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.RATE_LIMIT);
        expect(result.retryable).toBe(true);
        expect(result.retryAfter).toBeDefined();
      });

      it('classifies 500 errors as server errors', () => {
        const error = new Error('Internal Server Error');
        (error as any).statusCode = 500;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.SERVER_ERROR);
        expect(result.retryable).toBe(true);
      });

      it('classifies 502 errors as server errors', () => {
        const error = new Error('Bad Gateway');
        (error as any).statusCode = 502;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.SERVER_ERROR);
        expect(result.retryable).toBe(true);
      });

      it('classifies 503 errors as server errors', () => {
        const error = new Error('Service Unavailable');
        (error as any).statusCode = 503;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.SERVER_ERROR);
        expect(result.retryable).toBe(true);
      });

      it('classifies 400 errors as validation errors', () => {
        const error = new Error('Bad Request');
        (error as any).statusCode = 400;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(result.retryable).toBe(false);
      });

      it('classifies 422 errors as validation errors', () => {
        const error = new Error('Unprocessable Entity');
        (error as any).statusCode = 422;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(result.retryable).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('handles unknown error types as non-retryable', () => {
        const error = new Error('Something went wrong');

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.UNKNOWN);
        expect(result.retryable).toBe(false);
        expect(result.userMessage).toContain('error occurred');
        expect(result.technicalDetails).toContain('Something went wrong');
      });

      it('handles network errors with no HTTP status as retryable timeout', () => {
        const error = new Error('Network request failed');
        // No statusCode, no error code

        const result = ErrorClassifier.classify(error);

        // Should classify as unknown and non-retryable for safety
        expect(result.type).toBe(ErrorType.UNKNOWN);
        expect(result.retryable).toBe(false);
      });

      it('handles errors with empty message', () => {
        const error = new Error('');

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.UNKNOWN);
        expect(result.userMessage).toBeTruthy();
        expect(result.technicalDetails).toBeTruthy();
      });

      it('handles non-Error objects', () => {
        const error = 'String error';

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.UNKNOWN);
        expect(result.retryable).toBe(false);
        expect(result.originalError).toBeInstanceOf(Error);
      });

      it('handles null error', () => {
        const result = ErrorClassifier.classify(null);

        expect(result.type).toBe(ErrorType.UNKNOWN);
        expect(result.retryable).toBe(false);
      });

      it('handles undefined error', () => {
        const result = ErrorClassifier.classify(undefined);

        expect(result.type).toBe(ErrorType.UNKNOWN);
        expect(result.retryable).toBe(false);
      });

      it('handles error objects without message property', () => {
        const error = { statusCode: 500 };

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.SERVER_ERROR);
        expect(result.retryable).toBe(true);
        expect(result.technicalDetails).toBeTruthy();
      });

      it('does not crash during error classification', () => {
        const problematicError = {
          get message() {
            throw new Error('Property access fails');
          },
        };

        expect(() => ErrorClassifier.classify(problematicError)).not.toThrow();
      });

      it('extracts Retry-After header from rate limit errors', () => {
        const error = new Error('Rate limit exceeded');
        (error as any).statusCode = 429;
        (error as any).retryAfter = 60; // 60 seconds

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.RATE_LIMIT);
        expect(result.retryAfter).toBe(60);
      });

      it('provides default retry delay if Retry-After not present', () => {
        const error = new Error('Rate limit exceeded');
        (error as any).statusCode = 429;

        const result = ErrorClassifier.classify(error);

        expect(result.type).toBe(ErrorType.RATE_LIMIT);
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.retryAfter).toBeLessThanOrEqual(60);
      });
    });

    describe('User-friendly messages', () => {
      it('provides clear authentication error message', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.AUTHENTICATION,
          message: 'Invalid API key',
          statusCode: 401,
          retryable: false,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.userMessage).toMatch(/authentication|API key|credentials/i);
      });

      it('provides clear rate limit error message', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.RATE_LIMIT,
          message: 'Rate limit exceeded',
          statusCode: 429,
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.userMessage).toMatch(/rate limit|too many requests|try again/i);
      });

      it('provides clear timeout error message', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.TIMEOUT,
          message: 'Request timed out',
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.userMessage).toMatch(/timeout|timed out|try again/i);
      });

      it('provides clear server error message', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Internal server error',
          statusCode: 500,
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.userMessage).toMatch(/server error|try again|temporarily unavailable/i);
      });

      it('provides clear validation error message', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.VALIDATION,
          message: 'Invalid input',
          statusCode: 400,
          retryable: false,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.userMessage).toMatch(/validation|invalid|check.*parameters/i);
      });

      it('provides clear network error message', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.NETWORK,
          message: 'Network connection failed',
          retryable: true,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.userMessage).toMatch(/network|connection|connectivity/i);
      });

      it('provides generic message for unknown errors', () => {
        const error = new Error('Unknown error');

        const result = ErrorClassifier.classify(error);

        expect(result.userMessage).toMatch(/error occurred|unexpected|contact support/i);
      });
    });

    describe('Technical details logging', () => {
      it('includes error message in technical details', () => {
        const error = new Error('Detailed technical error message');

        const result = ErrorClassifier.classify(error);

        expect(result.technicalDetails).toContain('Detailed technical error message');
      });

      it('includes error type in technical details for PixelLabError', () => {
        const error = new PixelLabError({
          type: PixelLabErrorType.VALIDATION,
          message: 'Validation failed',
          statusCode: 400,
          retryable: false,
        });

        const result = ErrorClassifier.classify(error);

        expect(result.technicalDetails).toContain('validation');
      });

      it('includes status code in technical details when available', () => {
        const error = new Error('Server error');
        (error as any).statusCode = 503;

        const result = ErrorClassifier.classify(error);

        expect(result.technicalDetails).toContain('503');
      });

      it('includes error code in technical details when available', () => {
        const error = new Error('Connection refused');
        (error as any).code = 'ECONNREFUSED';

        const result = ErrorClassifier.classify(error);

        expect(result.technicalDetails).toContain('ECONNREFUSED');
      });

      it('handles errors without useful details gracefully', () => {
        const error = {};

        const result = ErrorClassifier.classify(error);

        expect(result.technicalDetails).toBeTruthy();
        expect(result.technicalDetails.length).toBeGreaterThan(0);
      });
    });
  });
});
