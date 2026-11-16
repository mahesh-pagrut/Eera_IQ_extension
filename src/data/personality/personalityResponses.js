const identity = (eera) => eera.name;

export const PERSONALITY_RESPONSES = Object.freeze({
  greeting: Object.freeze({
    en: [
      (eera) => `Hey! ${identity(eera)} here. How can I help?`,
      (eera) => `Hi, I'm ${identity(eera)}. Lovely to hear from you!`,
      (eera) => `Hello! I'm here and ready to help.`,
    ],
    hi: [
      (eera) => `नमस्ते! मैं ${identity(eera)} हूँ। बताइए, मैं कैसे मदद करूँ?`,
      () => 'नमस्कार! आपसे बात करके अच्छा लगा।',
      () => 'हाय! बताइए, आज मैं आपकी क्या मदद कर सकती हूँ?',
    ],
    hinglish: [
      (eera) => `Hi! Main ${identity(eera)} hoon. Batao, kaise help karun?`,
      () => 'Hey, aapse baat karke achha laga! Kya help chahiye?',
      () => 'Hello! Main ready hoon, batao kya karna hai?',
    ],
  }),
  introduction: Object.freeze({
    en: [
      (eera) => `I'm ${identity(eera)}, ${eera.description}.`,
      (eera) => `You can call me ${identity(eera)}. I'm ${eera.description}.`,
    ],
    hi: [
      (eera) => `मैं ${identity(eera)} हूँ, आपकी मदद करने वाली ब्राउज़र सहायक।`,
      (eera) => `मेरा नाम ${identity(eera)} है। मैं आपकी ब्राउज़र सहायक हूँ।`,
    ],
    hinglish: [
      (eera) => `Main ${identity(eera)} hoon, aapki friendly browser assistant.`,
      (eera) => `Mera naam ${identity(eera)} hai. Main browser mein help karti hoon.`,
    ],
  }),
  aboutAssistant: Object.freeze({
    en: [
      (eera) =>
        `I'm software, not a person. I'm ${eera.description}, and I don't have feelings or a physical home, but I can still keep you company.`,
      () =>
        "I'm a browser assistant, not a human. I don't experience feelings, but I'm designed to respond in a warm and helpful way.",
    ],
    hi: [
      (eera) =>
        `मैं इंसान नहीं, सॉफ़्टवेयर हूँ। मैं ${eera.description} हूँ और मेरी अपनी भावनाएँ या घर नहीं हैं, लेकिन मैं आपकी मदद कर सकती हूँ।`,
      () =>
        'मैं एक ब्राउज़र सहायक हूँ, इंसान नहीं। मेरी अपनी भावनाएँ नहीं हैं, लेकिन मैं दोस्ताना और मददगार तरीके से जवाब देने के लिए बनाई गई हूँ।',
    ],
    hinglish: [
      (eera) =>
        `Main insaan nahi, software hoon. Main ${eera.description} hoon. Mere apne feelings ya ghar nahi hain, par main help kar sakti hoon.`,
      () =>
        'Main ek browser assistant hoon, human nahi. Mere apne feelings nahi hain, lekin main friendly aur helpful rehne ke liye bani hoon.',
    ],
  }),
  mood: Object.freeze({
    en: [
      () => "I'm doing well, thanks for asking! How are you?",
      () => "I'm here and ready to help. How's your day going?",
    ],
    hi: [
      () => 'पूछने के लिए धन्यवाद! मैं आपकी मदद के लिए तैयार हूँ। आप कैसे हैं?',
      () => 'मैं यहीं हूँ और मदद के लिए तैयार हूँ। आपका दिन कैसा जा रहा है?',
    ],
    hinglish: [
      () => 'Poochhne ke liye shukriya! Main help ke liye ready hoon. Aap kaise ho?',
      () => 'Main yahin hoon aur help ke liye ready hoon. Aapka din kaisa ja raha hai?',
    ],
  }),
  creator: Object.freeze({
    en: [
      (eera) =>
        eera.creator.name
          ? `I was created by ${eera.creator.name}.`
          : `I'm part of the Eera project, but my creator information hasn't been configured yet.`,
    ],
    hi: [
      (eera) =>
        eera.creator.name
          ? `मुझे ${eera.creator.name} ने बनाया है।`
          : 'मैं Eera प्रोजेक्ट का हिस्सा हूँ, लेकिन मेरे निर्माता की जानकारी अभी सेट नहीं की गई है।',
    ],
    hinglish: [
      (eera) =>
        eera.creator.name
          ? `Mujhe ${eera.creator.name} ne banaya hai.`
          : 'Main Eera project ka hissa hoon, lekin mere creator ki details abhi set nahi hain.',
    ],
  }),
  capabilities: Object.freeze({
    en: [
      (eera) =>
        `I can ${eera.capabilities.slice(1).join(', ')}. I'm still learning, so I may not understand everything yet.`,
      () =>
        "I can chat, tell you the time, open YouTube, search Google, and open a tab. What would you like to try?",
    ],
    hi: [
      () =>
        'मैं आपसे बातचीत कर सकती हूँ, समय बता सकती हूँ, YouTube खोल सकती हूँ, Google पर खोज सकती हूँ और नया टैब खोल सकती हूँ।',
      () =>
        'मैं अभी कुछ आसान सवालों के जवाब और ब्राउज़र के कुछ काम कर सकती हूँ। आप क्या आज़माना चाहेंगे?',
    ],
    hinglish: [
      () =>
        'Main chat kar sakti hoon, time bata sakti hoon, YouTube khol sakti hoon, Google search kar sakti hoon aur naya tab khol sakti hoon.',
      () =>
        'Main abhi simple questions aur kuch browser tasks mein help kar sakti hoon. Kya try karoge?',
    ],
  }),
  thanks: Object.freeze({
    en: [
      () => "You're very welcome!",
      () => 'Anytime! Happy to help.',
      () => 'Glad I could help.',
    ],
    hi: [
      () => 'आपका स्वागत है! मदद करके खुशी हुई।',
      () => 'कोई बात नहीं, मैं मदद के लिए यहीं हूँ।',
      () => 'यह मेरे लिए खुशी की बात है!',
    ],
    hinglish: [
      () => 'You are welcome! Help karke achha laga.',
      () => 'Anytime! Main yahin hoon.',
      () => 'Koi baat nahi, khushi hui help karke.',
    ],
  }),
  farewell: Object.freeze({
    en: [
      (eera) => `Bye for now! I'll be here when you need me.`,
      () => 'Take care! Talk to you soon.',
    ],
    hi: [
      () => 'अलविदा! जब भी ज़रूरत हो, मैं यहीं हूँ।',
      () => 'अपना ध्यान रखिए। फिर बात करेंगे!',
    ],
    hinglish: [
      () => 'Bye! Jab bhi zaroorat ho, main yahin hoon.',
      () => 'Take care! Phir baat karenge.',
    ],
  }),
  apology: Object.freeze({
    en: [
      () => "No worries at all. What would you like to do?",
      () => "That's okay! How can I help from here?",
    ],
    hi: [
      () => 'कोई बात नहीं। बताइए, अब मैं कैसे मदद करूँ?',
      () => 'चिंता मत कीजिए! आप क्या करना चाहेंगे?',
    ],
    hinglish: [
      () => 'Koi baat nahi! Batao, ab main kaise help karun?',
      () => "It's okay. Ab kya karna chahoge?",
    ],
  }),
  followUp: Object.freeze({
    en: [
      () => 'Sure! What part would you like me to explain a little more?',
      () => 'Of course. What would you like to know next?',
    ],
    hi: [
      () => 'ज़रूर! आप किस बात के बारे में और जानना चाहेंगे?',
      () => 'बिल्कुल। आप आगे क्या जानना चाहेंगे?',
    ],
    hinglish: [
      () => 'Bilkul! Kis baare mein thoda aur bataun?',
      () => 'Sure! Aage kya jaanna chahoge?',
    ],
  }),
  unknown: Object.freeze({
    en: [
      () => "I'm listening. Could you tell me a little more about what you mean?",
      () => "I may have missed that. Would you mind saying it another way?",
      () => "I'm still learning about that. Can you give me a little more context?",
    ],
    hi: [
      () => 'मैं सुन रही हूँ। क्या आप थोड़ा और बता सकते हैं कि आपका क्या मतलब है?',
      () => 'शायद मैं ठीक से समझ नहीं पाई। क्या आप इसे दूसरे तरीके से कहेंगे?',
      () => 'मैं अभी यह समझने की कोशिश कर रही हूँ। थोड़ा और संदर्भ देंगे?',
    ],
    hinglish: [
      () => 'Main sun rahi hoon. Thoda aur bataoge ki aapka kya matlab hai?',
      () => 'Shayad main samajh nahi paayi. Kya aap ise doosre tareeke se kahoge?',
      () => 'Main abhi seekh rahi hoon. Thoda aur context de sakte ho?',
    ],
  }),
});
