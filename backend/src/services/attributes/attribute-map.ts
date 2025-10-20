/**
 * Attribute Mapping Configuration
 *
 * Maps ability strings (from Claude) to combat attributes with sprite animations.
 * This configuration is now built dynamically from the abilities catalog.
 *
 * MIGRATED TO CONFIG: See /config/abilities-catalog.ts for ability definitions
 */

import type { CombatAttribute } from './types.js';
import { abilitiesCatalog, abilityToAttribute, findAbilityByKeywords } from '../../config/abilities-catalog.js';

/**
 * Build attribute map from abilities catalog
 * Creates mappings for:
 * 1. Ability ID → Combat Attribute
 * 2. All keywords → Combat Attribute (for semantic matching)
 */
function buildAttributeMap(): Record<string, CombatAttribute> {
  const map: Record<string, CombatAttribute> = {};

  for (const ability of abilitiesCatalog) {
    const attribute = abilityToAttribute(ability);

    // Add primary ID mapping
    map[ability.id] = attribute;

    // Add keyword mappings for variations
    for (const keyword of ability.keywords) {
      const keywordKey = keyword.toLowerCase().replace(/\s+/g, '_');
      // Only add if not already defined (avoid overwriting primary IDs)
      if (!map[keywordKey]) {
        map[keywordKey] = attribute;
      }
    }
  }

  return map;
}

/**
 * Attribute mapping configuration
 * Dynamically built from abilities catalog
 */
export const attributeMap: Record<string, CombatAttribute> = buildAttributeMap();

/**
 * Get combat attribute definition for an ability string
 * Tries exact match first, then falls back to keyword-based semantic matching
 *
 * @param ability - Ability string from Claude
 * @returns Combat attribute definition or null if not found
 */
export function getAttributeForAbility(ability: string): CombatAttribute | null {
  const normalized = ability.toLowerCase().trim().replace(/\s+/g, '_');

  // Try exact match first (includes keyword mappings)
  if (attributeMap[normalized]) {
    return attributeMap[normalized];
  }

  // Fall back to semantic keyword matching
  const match = findAbilityByKeywords(normalized);
  if (match) {
    return abilityToAttribute(match);
  }

  return null;
}

/**
 * Get all unique attribute IDs from ability list
 *
 * @param abilities - List of ability strings
 * @returns Array of unique combat attributes
 */
export function extractUniqueAttributes(abilities: string[]): CombatAttribute[] {
  const uniqueMap = new Map<string, CombatAttribute>();

  for (const ability of abilities) {
    const attribute = getAttributeForAbility(ability);
    if (attribute && !uniqueMap.has(attribute.attributeId)) {
      uniqueMap.set(attribute.attributeId, attribute);
    }
  }

  return Array.from(uniqueMap.values());
}
