const https = require('https');
const http = require('http');

// Language code mapping
const langMap = {
  english: 'en',
  kannada: 'kn',
  hindi: 'hi',
};

// Reverse mapping
const langMapReverse = {
  en: 'english',
  kn: 'kannada',
  hi: 'hindi',
};

/**
 * Translate text using MyMemory Translation API (free, no key needed)
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code (en, kn, hi)
 * @param {string} targetLang - Target language code (en, kn, hi)
 * @returns {Promise<string>} - Translated text
 */
async function translateViaAPI(text, sourceLang, targetLang) {
  return new Promise((resolve) => {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.responseStatus === 200 && json.responseData.translatedText) {
            resolve(json.responseData.translatedText);
          } else {
            resolve(text); // Fallback to original
          }
        } catch (e) {
          resolve(text); // Fallback to original
        }
      });
    }).on('error', () => resolve(text));
  });
}

/**
 * Translate text from source language to target language
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language (english, kannada, hindi)
 * @param {string} targetLang - Target language (english, kannada, hindi)
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, sourceLang, targetLang) {
  try {
    // If same language, return original text
    if (sourceLang === targetLang) {
      return text;
    }

    const sourceCode = langMap[sourceLang] || 'en';
    const targetCode = langMap[targetLang] || 'en';

    const translatedText = await translateViaAPI(text, sourceCode, targetCode);
    return translatedText || text;
  } catch (err) {
    console.error('Translation error:', err);
    // Return original text if translation fails
    return text;
  }
}

/**
 * Translate text to multiple languages
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language
 * @returns {Promise<Object>} - Object with translations for all languages
 */
async function translateToAllLanguages(text, sourceLang) {
  const translations = {
    english: text,
    kannada: text,
    hindi: text,
  };

  try {
    // Translate to each language except source
    for (const [lang] of Object.entries(langMap)) {
      if (lang !== sourceLang) {
        translations[lang] = await translateText(text, sourceLang, lang);
      }
    }
  } catch (err) {
    console.error('Batch translation error:', err);
  }

  return translations;
}

module.exports = {
  translateText,
  translateToAllLanguages,
  langMap,
  langMapReverse,
};
