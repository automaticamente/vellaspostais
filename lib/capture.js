import puppeteer from "puppeteer";
import { readFile, writeFile } from "fs/promises";

const BASE_URL = "https://biblioteca.galiciana.gal/gl";

// We can start on any page from the postcards filtered collection
const START_URL = `${BASE_URL}/consulta/resultados_ocr.do?autor_numcontrol=&materia_numcontrol=&secc_ILUSFOT_POSTAIS=on&id=19645&forma=ficha&tipoResultados=BIB&posicion=1&accion_ir=Ir`;

async function updatePublished(list) {
  await writeFile("./published.json", JSON.stringify(list));
}

export async function capture() {
  // Create browser instance
  const browser = await puppeteer.launch({
    headless: true,
  });

  // Get already published ids
  let published;

  try {
    published = JSON.parse(await readFile("./published.json", "utf8"));
  } catch {
    published = [];
  }

  // Launch a browser tab
  const page = await browser.newPage();

  // Set user agent, just to be polite
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36"
  );

  // Navigate to the initial URL
  await page.goto(START_URL, { waitUntil: "networkidle2" });

  // Get total number of items on the postcards' collection (just in the improbable case they publish more)
  const totalPagesString = await page.evaluate(() => {
    const pagesElement = document.querySelector(".nav_descrip");

    //Since we are here, reset the value of the page navigation input
    document.querySelector("#nav_posicion").value = "";

    return pagesElement.textContent.trim();
  });

  // Eventually they will change the layout and probably nothing will be returned from the previous evaluate
  if (!totalPagesString) {
    throw new Error("No pages detected");
  }

  // Get actual # of pages
  const totalPages = totalPagesString.match(/\d+ de (\d+)/);

  const pages = Number(totalPages[1]);

  // Create a range from the # of pages
  const range = [...Array(pages).keys()].map((n) => n + 1);

  // Remove already published page # from the previous range
  const validRange = range.filter((n) => !published.includes(n));

  // Throw if validRange is empty
  if (validRange.length === 0) {
    throw new Error("No remaining items");
  }

  // Choose a random page
  const chosen = validRange[Math.floor(validRange.length * Math.random())];

  // Navigate to the page using the form (we could use the url instead but since we are already here...)
  await page.type("#nav_posicion", String(chosen));
  await page.click("#boton_accion_ir");

  // Wait for the page to load until the miniature element is available
  await page.waitForSelector("p.imagen_favorita");

  // Check if content is public domain

  const publicDomain = await page.$x("//span[contains(text(), 'dominio público')]");

  if(publicDomain.length === 0) {
    await updatePublished([chosen, ...published]);
    throw new Error('No rights');
  }

  // Extract the miniature image url
  const previewURL = await page.evaluate(() => {
    const previewImage = document.querySelector("p.imagen_favorita img");

    return previewImage.getAttribute("src");
  });

  // There is no miniature at all on some pages
  if (!previewURL) {
    // Add page to published to prevent it to be chosen again
    await updatePublished([chosen, ...published]);
    throw new Error("No image detected");
  }

  // Build the miniature canonical URL and get the image id param
  const idImage = new URL(previewURL, BASE_URL).searchParams.get("idImagen");

  // Build the full size image URL using the previously extracted id
  const image = `https://biblioteca.galiciana.gal/i18n/catalogo_imagenes/imagen_id.do?idImagen=${idImage}&formato=jpg&registrardownload=0&`;

  // Get and clean the title of the image from the metadata
  const title = await page.evaluate(() => {
    const titleElement = document.querySelector("div.titulo .valor");

    return titleElement.textContent.replaceAll(/[[\]]/g, "");
  });

  // Get current page url
  const url = page.url();

  // Update the published list
  await updatePublished([chosen, ...published]);

  // Close browser
  await browser.close();

  return { title, image, url };
}

// capture()
//   .then((r) => console.log(r))
//   .catch((error) => console.error(error));
