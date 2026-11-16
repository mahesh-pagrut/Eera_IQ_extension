import { EERA_IDENTITY, createEeraIdentity } from '../../data/personality/eeraIdentity.js';
import { PERSONALITY_RESPONSES } from '../../data/personality/personalityResponses.js';
import { createConversationContext } from './conversationContext.js';
import {
  detectConversationLanguage,
  getSpeechLanguage,
} from './languageDetector.js';
import { createResponseSelector } from './responseSelector.js';

const INTENT_PATTERNS = Object.freeze({
  greeting:
    /^(?:hi|hello|hey|hiya|good morning|good afternoon|good evening|namaste|नमस्ते|नमस्कार)(?:\s+eera)?(?:\b|[,!.?]|$)/iu,
  introduction:
    /\b(?:who are you|what(?:'s| is) your name|tell me (?:about yourself|your name))\b|तुम कौन हो|आप कौन हैं|तुम्हारा नाम क्या है|आपका नाम क्या है/iu,
  aboutAssistant:
    /\b(?:are you human|are you a person|are you real|do you have feelings|where do you live)\b|क्या तुम इंसान हो|क्या आप इंसान हैं|क्या तुम्हारी भावनाएँ हैं|क्या आपकी भावनाएँ हैं/iu,
  creator:
    /\b(?:who (?:made|created|built|developed) you|who is your creator)\b|तुम्हें किसने बनाया|तुम्हे किसने बनाया|आपको किसने बनाया|तुम्हारा निर्माता कौन है/iu,
  capabilities:
    /\b(?:what can you do|what are your capabilities|how can you help|what do you do|can you help me)\b|तुम क्या कर सकती हो|आप क्या कर सकती हैं|तुम मेरी मदद कैसे करोगी|आप मेरी मदद कैसे करेंगी/iu,
  thanks:
    /\b(?:thank you|thanks|many thanks|appreciate it)\b|धन्यवाद|शुक्रिया|बहुत अच्छा/iu,
  mood:
    /\b(?:how are you|how are you doing|how is your day)\b|तुम कैसी हो|आप कैसी हैं|तुम्हारा दिन कैसा है|आपका दिन कैसा है/iu,
  farewell:
    /\b(?:bye|goodbye|see you|talk to you later|good night)\b|अलविदा|फिर मिलेंगे|शुभ रात्रि/iu,
  apology:
    /\b(?:i am sorry|i'm sorry|sorry(?: about that)?|my apologies)\b|माफ़ कीजिए|माफ कीजिए|मुझे माफ़ करना|क्षमा करें/iu,
  followUp:
    /\b(?:tell me more|say more|what did i ask|what did i say|what about that|can you explain|go on|repeat that)\b|और बताओ|थोड़ा और बताओ|मैंने क्या पूछा|मैंने क्या कहा|फिर से बताओ/iu,
});

function classifyIntent(text) {
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(text.trim())) return intent;
  }
  return 'unknown';
}

function responseText(value, eeraIdentity) {
  return typeof value === 'function' ? value(eeraIdentity) : value;
}

export function createConversationEngine({
  identity = EERA_IDENTITY,
  context = createConversationContext(),
  selectResponse = createResponseSelector(),
} = {}) {
  const eeraIdentity = createEeraIdentity(identity);

  function chooseResponse(intent, language) {
    const localized = PERSONALITY_RESPONSES[intent] ?? PERSONALITY_RESPONSES.unknown;
    const variations =
      localized[language] ?? localized.en ?? PERSONALITY_RESPONSES.unknown.en;
    const selected = selectResponse(variations, `${intent}:${language}`);
    return responseText(selected, eeraIdentity);
  }

  function getFollowUpResponse(text, language) {
    const previousTurn = context.getLastTurn();
    if (!previousTurn) return chooseResponse('followUp', language);

    const normalized = text.toLowerCase();
    if (/what did i (?:ask|say)|मैंने क्या (?:पूछा|कहा)/iu.test(normalized)) {
      const recentUserMessage = previousTurn.user;
      const prefix = {
        en: `You asked, “${recentUserMessage}.”`,
        hi: `आपने पूछा था, “${recentUserMessage}।”`,
        hinglish: `Aapne poochha tha, “${recentUserMessage}.”`,
      }[language];
      return prefix;
    }

    if (previousTurn.intent === 'capabilities') {
      return {
        en: 'For example, you can ask me the time, ask about myself, open YouTube, search Google, or open a new tab.',
        hi: 'जैसे, आप मुझसे समय पूछ सकते हैं, मेरे बारे में जान सकते हैं, YouTube खोल सकते हैं या Google पर खोज सकते हैं।',
        hinglish: 'Jaise, aap mujhse time pooch sakte hain, mere baare mein jaan sakte hain, YouTube khol sakte hain ya Google search kar sakte hain.',
      }[language];
    }
    if (previousTurn.intent === 'introduction') {
      return {
        en: `I'm ${eeraIdentity.description}, and I try to keep our conversations helpful and easy.`,
        hi: 'मैं आपकी ब्राउज़र सहायक हूँ और कोशिश करती हूँ कि बातचीत आसान और मददगार रहे।',
        hinglish: 'Main aapki browser assistant hoon aur koshish karti hoon ki conversation simple aur helpful rahe.',
      }[language];
    }
    return chooseResponse('followUp', language);
  }

  function respond(
    text,
    { preferredLanguage = eeraIdentity.defaultLanguage } = {},
  ) {
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError('Conversation message must be a non-empty string.');
    }

    const language = detectConversationLanguage(text, { preferredLanguage });
    const intent = classifyIntent(text);
    const response =
      intent === 'followUp'
        ? getFollowUpResponse(text, language)
        : chooseResponse(intent, language);
    const result = {
      response,
      intent,
      language,
      speechLanguage: getSpeechLanguage(language, preferredLanguage),
    };

    context.addTurn({
      user: text,
      assistant: response,
      intent,
      language,
    });
    return result;
  }

  return {
    respond,
    remember: context.addTurn,
    clear: context.clear,
    getRecentTurns: context.getRecentTurns,
    getIdentity: () => createEeraIdentity(eeraIdentity),
  };
}
