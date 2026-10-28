import QRCode from "qrcode";

export async function generateQrCodeDataUrl(data: string | object): Promise<string> {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 256,
    color: {
      dark: "#064e3b", // Emerald dark
      light: "#ffffff",
    },
  });
}
