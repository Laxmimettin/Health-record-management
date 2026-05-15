/**
 * Frontend translation utility - handles displaying messages in different languages
 */

/**
 * Get the appropriate text for a message based on user's preferred language
 * @param {Object} message - Message object with text, translations, originalLanguage
 * @param {string} userLanguage - User's preferred language (english, kannada, hindi)
 * @returns {string} - Text in user's preferred language
 */
export function getMessageInLanguage(message, userLanguage = 'english') {
  // If message has translations object, use it
  if (message.translations && message.translations[userLanguage]) {
    return message.translations[userLanguage];
  }
  
  // Fallback to original text or generic text
  return message.text || message.originalText || '';
}

/**
 * Get badge label for language
 */
export function getLanguageBadge(language) {
  const badges = {
    english: '🇬🇧 English',
    kannada: '🇮🇳 ಕನ್ನಡ',
    hindi: '🇮🇳 हिंदी',
  };
  return badges[language] || 'English';
}

/**
 * Get language display name
 */
export function getLanguageName(language) {
  const names = {
    english: 'English',
    kannada: 'ಕನ್ನಡ (Kannada)',
    hindi: 'हिंदी (Hindi)',
  };
  return names[language] || 'English';
}

/**
 * Language options for dropdown
 */
export const LANGUAGE_OPTIONS = [
  { value: 'english', label: '🇬🇧 English' },
  { value: 'kannada', label: '🇮🇳 ಕನ್ನಡ (Kannada)' },
  { value: 'hindi', label: '🇮🇳 हिंदी (Hindi)' },
];
