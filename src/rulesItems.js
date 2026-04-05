// Ordered list of rules display messages, shared between Mission Control nav and the host script panel
export const RULES_ITEMS = [
  { label: "Get ready!", text: "Get ready to play!" },
  { label: "No devices", text: "No electronic devices may be out during the round" },
  { label: "Don't shout", text: "Don't shout out the answers" },
  { label: "Spelling", text: "Spelling doesn't count unless we say it does" },
  { label: "Names", text: "Real people: Last names\nFictional people: First or last names\n(unless we say otherwise!)", fontSize: 119 },
  { label: "Our answer", text: "Our answer is the\ncorrect answer" },
  { label: "Phones away", text: "Put those phones away, because the contest starts NOW!" },
];

export const PHONE_AWAY_ITEM = RULES_ITEMS[RULES_ITEMS.length - 1];
