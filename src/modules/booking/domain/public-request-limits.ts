/**
 * Public request limits (security audit S-5). Every limit answers with the
 * same key, booking.request_limit, so a caller learns nothing about whoever
 * owns the phone (their pending requests, their history).
 */
export const PUBLIC_REQUEST_LIMIT_KEY = "booking.request_limit";
/** Future PENDING requests one phone may have open at one stadium. */
export const PUBLIC_MAX_PENDING_PER_PHONE = 3;
export const PUBLIC_REQUEST_WINDOW_MS = 60 * 60 * 1000;
/** Requests per phone per stadium per hour (taken hours included). */
export const PUBLIC_MAX_REQUESTS_PER_PHONE = 5;
/** Requests per client IP per hour, all stadiums; only with TRUSTED_CLIENT_IP_HEADER. */
export const PUBLIC_MAX_REQUESTS_PER_IP = 60;

export function publicRequestLimitKeys(tenantId: string, phone: string, ip: string | null) {
  return {
    phone: `public:phone:${tenantId}:${phone}`,
    ip: ip ? `public:ip:${ip}` : null,
  };
}
