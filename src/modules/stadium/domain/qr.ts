import QRCode from "qrcode";

/**
 * QR codes for the public page, SERVER ONLY (the `qrcode` package never ships to the
 * browser: the owner pages fetch the image from /owner/qr). Black on white, a 4-module quiet
 * zone, error correction Q. The text is whatever the caller passes; the route passes the
 * canonical public URL of the tenant resolved from the host, never anything from the query.
 */
const OPTIONS = {
  errorCorrectionLevel: "Q",
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
} as const;

export const QR_PNG_SIZE = 1024;

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...OPTIONS, type: "svg" });
}

/** A square PNG, 1024 x 1024 unless a smaller `size` is asked for (tests only: Jest renders it slowly). */
export function qrPng(text: string, size: number = QR_PNG_SIZE): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...OPTIONS, type: "png", width: size });
}
