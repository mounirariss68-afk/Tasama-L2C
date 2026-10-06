const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

/** Use only the current question, never persona names or earlier replies. */
export function responseLanguage(question: string): 'English' | 'Arabic' {
  return count(question, /\p{Script=Arabic}/gu) > count(question, /\p{Script=Latin}/gu) ? 'Arabic' : 'English';
}

export function needsLanguageCorrection(text: string, language: 'English' | 'Arabic') {
  const latin = count(text, /\p{Script=Latin}/gu);
  const arabic = count(text, /\p{Script=Arabic}/gu);
  const allLetters = count(text, /\p{L}/gu);
  // Names, record IDs and currency abbreviations may legitimately be mixed.
  return language === 'English' ? allLetters > 20 && latin < allLetters * 0.6 : latin > 20 && arabic < latin * 0.5;
}
