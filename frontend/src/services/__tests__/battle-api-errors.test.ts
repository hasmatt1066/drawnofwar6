/**
 * Battle API Errors Tests
 *
 * Unit tests for typed error classes used in battle API operations.
 * Following TDD approach - tests written first.
 */

import {
  InsufficientCreaturesError,
  BattleNotFoundError,
  BattleAlreadyFilledError,
  CannotJoinOwnBattleError,
  ActiveBattleExistsError,
  parseBattleApiError
} from '../battle-api-errors';

describe('Battle API Error Classes', () => {
  describe('InsufficientCreaturesError', () => {
    it('should create error with message', () => {
      const error = new InsufficientCreaturesError('Need 3 creatures');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InsufficientCreaturesError);
      expect(error.message).toBe('Need 3 creatures');
    });

    it('should have correct name property', () => {
      const error = new InsufficientCreaturesError('Test');

      expect(error.name).toBe('InsufficientCreaturesError');
    });

    it('should have stack trace', () => {
      const error = new InsufficientCreaturesError('Test');

      expect(error.stack).toBeDefined();
    });
  });

  describe('BattleNotFoundError', () => {
    it('should create error with message', () => {
      const error = new BattleNotFoundError('Battle not found');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BattleNotFoundError);
      expect(error.message).toBe('Battle not found');
    });

    it('should have correct name property', () => {
      const error = new BattleNotFoundError('Test');

      expect(error.name).toBe('BattleNotFoundError');
    });
  });

  describe('BattleAlreadyFilledError', () => {
    it('should create error with message', () => {
      const error = new BattleAlreadyFilledError('Battle is full');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BattleAlreadyFilledError);
      expect(error.message).toBe('Battle is full');
    });

    it('should have correct name property', () => {
      const error = new BattleAlreadyFilledError('Test');

      expect(error.name).toBe('BattleAlreadyFilledError');
    });
  });

  describe('CannotJoinOwnBattleError', () => {
    it('should create error with message', () => {
      const error = new CannotJoinOwnBattleError('Cannot join own battle');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CannotJoinOwnBattleError);
      expect(error.message).toBe('Cannot join own battle');
    });

    it('should have correct name property', () => {
      const error = new CannotJoinOwnBattleError('Test');

      expect(error.name).toBe('CannotJoinOwnBattleError');
    });
  });

  describe('ActiveBattleExistsError', () => {
    it('should create error with message', () => {
      const error = new ActiveBattleExistsError('Already in a battle');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ActiveBattleExistsError);
      expect(error.message).toBe('Already in a battle');
    });

    it('should have correct name property', () => {
      const error = new ActiveBattleExistsError('Test');

      expect(error.name).toBe('ActiveBattleExistsError');
    });
  });
});

describe('parseBattleApiError', () => {
  it('should parse INSUFFICIENT_CREATURES error', () => {
    const response = {
      error: 'INSUFFICIENT_CREATURES',
      message: 'You need at least 3 creatures to create a battle'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(InsufficientCreaturesError);
    expect(error.message).toBe('You need at least 3 creatures to create a battle');
  });

  it('should parse BATTLE_NOT_FOUND error', () => {
    const response = {
      error: 'BATTLE_NOT_FOUND',
      message: 'Battle not found'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(BattleNotFoundError);
    expect(error.message).toBe('Battle not found');
  });

  it('should parse BATTLE_NOT_AVAILABLE error (battle filled)', () => {
    const response = {
      error: 'BATTLE_NOT_AVAILABLE',
      message: 'This battle has already started or is full'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(BattleAlreadyFilledError);
    expect(error.message).toBe('This battle has already started or is full');
  });

  it('should parse BATTLE_ALREADY_FILLED error', () => {
    const response = {
      error: 'BATTLE_ALREADY_FILLED',
      message: 'This battle was just filled by another player'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(BattleAlreadyFilledError);
    expect(error.message).toBe('This battle was just filled by another player');
  });

  it('should parse CANNOT_JOIN_OWN_BATTLE error', () => {
    const response = {
      error: 'CANNOT_JOIN_OWN_BATTLE',
      message: 'You cannot join your own battle'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(CannotJoinOwnBattleError);
    expect(error.message).toBe('You cannot join your own battle');
  });

  it('should parse BATTLE_IN_PROGRESS error', () => {
    const response = {
      error: 'BATTLE_IN_PROGRESS',
      message: 'You already have an active battle'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(ActiveBattleExistsError);
    expect(error.message).toBe('You already have an active battle');
  });

  it('should handle unknown error codes', () => {
    const response = {
      error: 'UNKNOWN_ERROR',
      message: 'Something went wrong'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Something went wrong');
  });

  it('should handle missing message field', () => {
    const response = {
      error: 'SOME_ERROR'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('SOME_ERROR');
  });

  it('should handle response with only message', () => {
    const response = {
      message: 'Generic error message'
    };

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Generic error message');
  });

  it('should handle empty response', () => {
    const response = {};

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Unknown error');
  });

  it('should handle string response', () => {
    const response = 'Error occurred';

    const error = parseBattleApiError(response);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Error occurred');
  });
});
