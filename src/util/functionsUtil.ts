import { getCountryCallingCode, CountryCode } from 'libphonenumber-js';

/**
 * Transforms a Matrix ID to a phone number format
 * @param matrixId - Matrix ID in format @1897989892_1:sayance.org
 * @returns Phone number in format +1897989892
 */
export function matrixIdToPhoneNumber(matrixId: string): string {
  // Extract the number part between @ and _1:
  const match = matrixId.match(/^@(\d+)_1:/);
  if (!match || !match[1]) {
    throw new Error('Invalid Matrix ID format');
  }
  return `+${match[1]}`;
}

/**
 * Transforms a phone number to Matrix ID format
 * @param phoneNumber - Phone number in format +1897989892
 * @returns Matrix ID in format @1897989892_1:sayance.org
 */
export function phoneNumberToMatrixId(phoneNumber: string): string {
  // Remove the + prefix and create Matrix ID
  const number = phoneNumber.replace(/^\+/, '');
  if (!/^\d+$/.test(number)) {
    throw new Error('Invalid phone number format');
  }
  return `@${number}_1:sayance.localhost`;
}

/**
 * Transforms a partial Matrix ID format to phone number format
 * @param partialId - Partial Matrix ID in format 2348166406459_1
 * @returns Phone number in format +2348166406459
 */
export function partialMatrixIdToPhoneNumber(partialId: string): string {
  // Remove the _1 suffix and add + prefix
  const match = partialId.match(/^(\d+)_1$/);
  if (!match || !match[1]) {
    return partialId;
  }
  return `+${match[1]}`;
}

/**
 * Formats a phone number to international format for backend API calls
 * @param phoneNumber - Phone number in various formats (e.g., "08166406459", "8166406459", "+2348166406459")
 * @param countryCode - Country code (e.g., "NG", "US")
 * @returns Formatted phone number in international format (e.g., "+2348166406459")
 */
export function formatPhoneNumberForBackend(phoneNumber: string, countryCode: CountryCode): string {
  // Clean the phone number by removing non-digit characters except +
  let cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

  // Get the country calling code
  const callingCode = getCountryCallingCode(countryCode);

  // If the number already starts with +, check if it has the correct country code
  if (cleanNumber.startsWith('+')) {
    const expectedPrefix = `+${callingCode}`;
    if (cleanNumber.startsWith(expectedPrefix)) {
      return cleanNumber; // Already properly formatted
    }
    // Remove the + and any existing country code to reformat
    cleanNumber = cleanNumber.substring(1);
    // Remove any existing country code prefix
    if (cleanNumber.startsWith(callingCode)) {
      cleanNumber = cleanNumber.substring(callingCode.length);
    }
  }

  // Remove leading zero if present (common in local formats)
  if (cleanNumber.startsWith('0')) {
    cleanNumber = cleanNumber.substring(1);
  }

  // Ensure we have a valid number (only digits remaining)
  if (!/^\d+$/.test(cleanNumber)) {
    throw new Error('Invalid phone number format');
  }

  // Return the properly formatted international number
  return `+${callingCode}${cleanNumber}`;
}
