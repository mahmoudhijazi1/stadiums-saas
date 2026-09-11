/**
 * Build a WhatsApp click-to-chat URL (BR-30 / BR-69). Domain only — no send, no Booking.
 * Lebanon: 03… → 961…; already-961 stays. Owner taps send in WhatsApp.
 */
export function whatsAppHref(phoneDigits: string, text: string): string {
  const e164 = toLebanonWhatsAppNumber(phoneDigits);
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}

/**
 * English “slot now available” body (BR-71 this slice). Times are already local strings.
 */
export function slotAvailableMessage(input: {
  stadiumName: string;
  pitchName: string;
  startLocal: string;
  endLocal: string;
}): string {
  return `${input.stadiumName}: ${input.pitchName} ${input.startLocal}–${input.endLocal} is free again if you still want it.`;
}

function toLebanonWhatsAppNumber(phoneDigits: string): string {
  if (!/^\d+$/.test(phoneDigits)) {
    throw new Error("Phone cannot be used for WhatsApp");
  }

  let e164: string;
  if (phoneDigits.startsWith("961")) {
    e164 = phoneDigits;
  } else if (phoneDigits.startsWith("0")) {
    e164 = `961${phoneDigits.slice(1)}`;
  } else {
    e164 = `961${phoneDigits}`;
  }

  if (!/^961\d{7,}$/.test(e164)) {
    throw new Error("Phone cannot be used for WhatsApp");
  }
  return e164;
}
