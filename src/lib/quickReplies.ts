export type ConversationLanguage = 'auto' | 'urdu' | 'english';

export interface QuickReplyMatch {
  reply: string;
  nextLanguage?: ConversationLanguage;
}

function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isUrduScript(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function looksLikeRomanUrdu(text: string): boolean {
  const norm = ` ${normalizePhrase(text)} `;
  if (/\s(urdu|roman\s+urdu)\s+(me|main|mein)\s/.test(norm)) {
    return true;
  }
  return /\s(kya|kaise|kese|haal|hai|hain|hoon|hun|mujhe|mjhe|batao|btao|samjhao|likho|karo|kro|krna|karna|nahi|nhi|haan|aap|mein|shukriya|madad|chahiye|chahie|zaroor|theek|bilkul|kyun|kahan|kab|kon|kaun)\s/.test(
    norm,
  );
}

export function matchInstantReply(
  text: string,
  currentLanguage: ConversationLanguage = 'auto',
): QuickReplyMatch | null {
  const rawTrimmed = text.trim();
  if (!rawTrimmed || rawTrimmed.length > 60) return null;

  const norm = normalizePhrase(rawTrimmed);
  if (!norm) return null;

  // Language switch commands
  if (
    /^(please\s+)?(can\s+you\s+)?(urdu\s*(me|mein|main|mai|m)?\s*(bat|baat|jawab)\s*(karo|kro|kren|karein|karen|karain|bol|bolo|do|dein|den)|speak\s+in\s+urdu|talk\s+in\s+urdu|reply\s+in\s+urdu|urdu\s+please|urdu)$/.test(
      norm,
    ) ||
    rawTrimmed === 'اردو میں بات کرو' ||
    rawTrimmed === 'اردو میں جواب دو'
  ) {
    return {
      reply: 'Bilkul! Ab main aap se Urdu mein baat karunga. Aap kya poochna chahte hain?',
      nextLanguage: 'urdu',
    };
  }

  if (
    /^(please\s+)?(can\s+you\s+)?(english\s*(me|mein|main|mai|m)?\s*(bat|baat|jawab)\s*(karo|kro|kren|karein|do|dein)|speak\s+in\s+english|talk\s+in\s+english|reply\s+in\s+english|english\s+please)$/.test(
      norm,
    )
  ) {
    return {
      reply: "Sure! I'll respond in English from now on. How can I help you?",
      nextLanguage: 'english',
    };
  }

  const preferUrdu =
    currentLanguage === 'urdu' || isUrduScript(rawTrimmed) || looksLikeRomanUrdu(rawTrimmed);

  // Salam variants (handles common spellings like "assalam alikum", "as salamu alaykum", "aoa", etc.)
  if (
    /^(as+\s*s?alam\s*(o|u|al)?\s*(a?l+a?[iy]+k+u?m|ale?kum|alikum)|aslam\s*(o|u)?\s*(alaikum|alikum|alekum|alaykum)|salam(\s+alaikum|\s+alikum|\s+alaykum)?|aoa|walaikum\s*assalam)$/.test(
      norm,
    ) ||
    rawTrimmed === 'السلام علیکم' ||
    rawTrimmed === 'سلام'
  ) {
    return {
      reply: 'Wa Alaikum Assalam! Kya haal hain? Main aap ki kya madad kar sakta hoon?',
    };
  }

  // Simple English greetings
  if (/^(hi+(\s+there)?|hello+(\s+there)?|helo+|hey+(\s+there)?|hlo|good\s+(morning|afternoon|evening))$/.test(norm)) {
    if (currentLanguage === 'urdu') {
      return {
        reply: 'Assalam Alaikum! Main aap ki kya madad kar sakta hoon?',
      };
    }
    if (norm.startsWith('good morning')) {
      return { reply: 'Good morning! How can I help you today?' };
    }
    if (norm.startsWith('good afternoon')) {
      return { reply: 'Good afternoon! How can I help you today?' };
    }
    if (norm.startsWith('good evening')) {
      return { reply: 'Good evening! How can I help you today?' };
    }
    return {
      reply: 'Hi! How can I help you?',
    };
  }

  // How are you variants
  if (
    /^(how\s+(are|r)\s+(you|u)|how\s+do\s+you\s+do|kya\s+haal\s+(hai|hain)|kese\s+ho|kaise\s+ho|theek\s+ho|ap\s+kaise\s+hain|aap\s+kaise\s+hain)$/.test(
      norm,
    )
  ) {
    if (preferUrdu) {
      return {
        reply: 'Alhamdulillah, main bilkul theek hoon! Aap sunayein, main aap ki kya madad kar sakta hoon?',
      };
    }
    return {
      reply: "I'm doing great, thanks for asking! How can I help you?",
    };
  }

  // Thanks variants
  if (
    /^(thanks|thank\s+you|thank\s+u|thx|ty|shukriya|shukria|jazakallah(\s+khair)?|meherbani)$/.test(
      norm,
    )
  ) {
    if (preferUrdu) {
      return {
        reply: 'Aap ka shukriya! Agar koi aur sawal ho to zaroor poochein.',
      };
    }
    return {
      reply: "You're welcome! Let me know if you need anything else.",
    };
  }

  // Goodbye variants
  if (/^(bye+|goodbye|see\s+you|allah\s+hafiz|khuda\s+hafiz)$/.test(norm)) {
    if (preferUrdu || norm.includes('hafiz')) {
      return {
        reply: 'Allah Hafiz! Jab zaroorat ho dobara baat karein.',
      };
    }
    return {
      reply: 'Goodbye! Feel free to come back anytime.',
    };
  }

  return null;
}
