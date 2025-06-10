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
  return `@${number}_1:sayance.org`;
}
