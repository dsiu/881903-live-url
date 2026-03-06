import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";

const isVercel = () => Boolean(process.env.VERCEL || process.env.AWS_REGION);

export const launchChromium = async () => {
  if (isVercel()) {
    const executablePath = await chromium.executablePath();
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: true
    });
  }

  return playwrightChromium.launch({ headless: true });
};
