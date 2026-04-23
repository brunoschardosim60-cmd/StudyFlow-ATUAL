export interface FocusMessageRule {
  minute: number;
  text: string;
}

export const FOCUS_MESSAGE_RULES: FocusMessageRule[] = [
  { minute: 0, text: "Foca no essencial." },
  { minute: 15, text: "Segue no teu ritmo." },
  { minute: 30, text: "Boa. Continua assim." },
  { minute: 60, text: "Vale uma pausa depois disso." },
];

export function getFocusMessage(elapsedMs: number) {
  const minutes = Math.floor(elapsedMs / 60000);
  let current = FOCUS_MESSAGE_RULES[0].text;

  for (const rule of FOCUS_MESSAGE_RULES) {
    if (minutes >= rule.minute) current = rule.text;
    else break;
  }

  return current;
}
