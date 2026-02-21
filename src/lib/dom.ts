/**
 * Format a date for display
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};
