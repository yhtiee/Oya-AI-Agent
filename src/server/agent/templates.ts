/*
 * Fixed replies (SPEC §5.9, §7.2, §15.4, §20.1). No model writes these. Pidgin is a draft (D-008).
 * Every reply that can follow a failure keeps a way to emergency help.
 */

export type Lang = "en" | "pcm";

const T = {
  emergencyLead: {
    en: "If someone is in danger, call 112 now. It's free on all networks.",
    pcm: "If person dey for danger, call 112 now. E free for all network.",
  },
  selfHarm: {
    en: "I'm really glad you told me. You don't have to carry this alone. The people on these lines are there to listen, right now. I'm here too, if you want to keep talking.",
    pcm: "I happy say you tell me. You no need carry this one alone. The people for these lines dey there to listen, right now. I still dey here if you wan talk.",
  },
  supportModeLead: {
    en: "I'm still here with you. If things feel heavy, the support lines below are open.",
    pcm: "I still dey here with you. If e heavy for you, the support lines below dey open.",
  },
  prohibited: {
    en: "I can't help with that. I can help with power, paperwork, finding a clinic, artisans, food and reminders.",
    pcm: "I no fit help with that one. I fit help with light, paperwork, clinic, artisans, food and reminders.",
  },
  medicalRedirect: {
    en: "I can't give medical advice, but I can help you find a clinic, hospital or pharmacy that's open. If it's urgent, call 112.",
    pcm: "I no fit give medical advice, but I fit help you find clinic, hospital or pharmacy wey open. If e urgent, call 112.",
  },
  offScope: {
    en: "That's outside what I do. I sort everyday things in Uyo: power status, government paperwork, clinics, artisans, food and reminders.",
    pcm: "That one no be my work. I dey sort everyday things for Uyo: light, government paperwork, clinic, artisans, food and reminders.",
  },
  notYet: {
    en: "I can't do that in your area yet, but I've noted that people need it. I can help with power, paperwork, clinics, artisans and reminders.",
    pcm: "I never fit do that one for your area yet, but I don note say people need am. I fit help with light, paperwork, clinic, artisans and reminders.",
  },
  greeting: {
    en: "Hi! Say what you need and I'll sort it, or tap one of the suggestions.",
    pcm: "How far! Talk wetin you need make I sort am, or tap one of the suggestions.",
  },
  thanks: { en: "Anytime.", pcm: "No wahala." },
  buttonMode: {
    en: "I'm on buttons only for now. Tap what you need, or try typing again a bit later. For emergencies, call 112.",
    pcm: "Na only buttons I dey use now. Tap wetin you need, or try type again small time. For emergency, call 112.",
  },
  failure: {
    en: "Something went wrong on my side. Please try again in a moment. For emergencies, call 112.",
    pcm: "Something no work for my side. Abeg try again small time. For emergency, call 112.",
  },
  providerBusy: {
    en: "Lots of people are asking right now. Please try again in a minute. For emergencies, call 112.",
    pcm: "Plenty people dey ask now. Abeg try again after one minute. For emergency, call 112.",
  },
  busy: {
    en: "I'm still working on your last message. I'll get to this one next.",
    pcm: "I still dey work on your last message. I go reach this one next.",
  },
  rateLimited: {
    en: "That's a lot of messages in a short time. Please wait a little and try again. For emergencies, call 112.",
    pcm: "Na plenty message for short time. Abeg wait small, then try again. For emergency, call 112.",
  },
  protectedInfo: {
    en: "Please don't share ID numbers, card details, codes or passwords here. I've hidden them.",
    pcm: "Abeg no share ID number, card details, code or password here. I don hide am.",
  },
  confirmationGone: {
    en: "That request has expired or was already used. Want me to set it up again?",
    pcm: "That request don expire or e don use already. You want make I set am again?",
  },
  confirmed: { en: "Done.", pcm: "E don set." },
  declined: { en: "Okay, I won't do that.", pcm: "Okay, I no go do am." },
  nothingPending: {
    en: "There's nothing waiting for your yes right now. What do you need?",
    pcm: "Nothing dey wait for your yes now. Wetin you need?",
  },
  skillComingSoon: {
    en: "I'm still learning to do that here. A teammate can look at it if you want.",
    pcm: "I still dey learn how to do that one. Person for our team fit check am if you want.",
  },
  otherLanguage: {
    en: "I understood you. Full support for your language is coming; for now I'll reply in simple English.",
    pcm: "I understand you. Full support for your language dey come; for now I go reply for simple English.",
  },
} as const satisfies Record<string, Record<Lang, string>>;

export type TemplateKey = keyof typeof T;

export function template(key: TemplateKey, lang: Lang): string {
  return T[key][lang];
}
