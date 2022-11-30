import "dotenv/config.js";

import { parentPort } from "worker_threads";
import { capture } from "../lib/capture.js";
import { login } from "masto/fetch";

async function bot() {
  const masto = await login({
    url: process.env.INSTANCE,
    accessToken: process.env.TOKEN,
  });

  const { image, url, title } = await capture();

  const response = await fetch(image);
  const blob = await response.blob();

  const attachment = await masto.mediaAttachments.create({
    file: new Blob([blob]),
    description: title,
  });

  const toot = await masto.statuses.create({
    status: `
 ${title}
 
 ${url}
    `,
    visibility: "public",
    mediaIds: [attachment.id],
  });

  return toot;
}

(async () => {
  try {
    const toot = await bot();

    if (parentPort) {
      parentPort.postMessage(toot.url);
    } else {
      process.exit(0);
    }
  } catch (e) {
    if (parentPort) {
      throw e;
    } else {
      console.error(e);
      process.exit(1);
    }
  }
})();
