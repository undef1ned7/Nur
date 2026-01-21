import { Font } from "@react-pdf/renderer";

let fontsRegistered = false;

export function registerPdfFonts() {
  if (fontsRegistered) return;

  try {
    // В Vite статика из public доступна по абсолютному пути
    const regularPath = "/fonts/roboto/Roboto-Regular.ttf";
    const boldPath = "/fonts/roboto/Roboto-Bold.ttf";

    Font.register({
      family: "Roboto",
      fonts: [
        { src: regularPath, fontWeight: "normal" },
        { src: boldPath, fontWeight: "bold" },
      ],
    });

    fontsRegistered = true;
  } catch (error) {
    // Не ломаем рендеринг, просто логируем
    // eslint-disable-next-line no-console
    console.warn("Не удалось зарегистрировать шрифты Roboto для PDF:", error);
  }
}

