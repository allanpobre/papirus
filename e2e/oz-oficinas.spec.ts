import { expect, test, type Page } from "./fixtures.ts";
import { fichaModo, openPart } from "./areas.ts";

// O exemplo de Oz mostra as oficinas do mundo já preenchidas: a cultura dos Munchkins (costumes, festa e
// língua), a crença nas Bruxas (o “panteão”), tensões e comércio, causas na Linha do tempo e rotas no mapa.
async function abrir(page: Page, nome: RegExp) {
  await page
    .getByRole("region", { name: "Lista de fichas" })
    .getByRole("button", { name: nome })
    .first()
    .click();
  await fichaModo(page, "Ler");
}

test("Oz: cultura, crença, tensões e comércio já preenchidos", async ({
  page,
}) => {
  await page.goto("/app/?exemplo");
  await page
    .getByRole("navigation", { name: "Áreas" })
    .getByRole("button", { name: "Mundo", exact: true })
    .first()
    .click();

  await abrir(page, /^Munchkins/);
  await expect(page.getByText("Oficina da cultura (5/8)")).toBeVisible();
  await expect(page.locator(".culture-workshop")).toContainText(
    "Festa da libertação",
  );
  await expect(page.locator("main")).toContainText("Calmo");

  await abrir(page, /^Winkies/);
  await expect(
    page.getByRole("list", { name: "Comércio possível" }),
  ).toContainText("joias");

  await abrir(page, /^O respeito às Bruxas/);
  const ceu = page.getByRole("group", {
    name: "Panteão de O respeito às Bruxas",
  });
  await expect(ceu.getByRole("button")).toHaveText([
    "Bruxa do Norte",
    "Glinda",
    "Bruxa Má do Leste",
    "Bruxa Má do Oeste",
  ]);
  await ceu.getByRole("button", { name: "Glinda" }).click();
  await expect(
    page.getByRole("region", { name: "Glinda" }).getByRole("textbox").first(),
  ).toHaveValue(/o Sul/);
});

test("Oz: rotas com dias no mapa", async ({ page }) => {
  await page.goto("/app/?exemplo");
  await page
    .getByRole("navigation", { name: "Áreas" })
    .getByRole("button", { name: "Mundo", exact: true })
    .first()
    .click();
  await openPart(page, "Mapas");
  await expect(page.locator(".atlas-road-label")).toHaveCount(3);
  await expect(
    page.getByRole("button", {
      name: /de Onde a casa caiu a Cidade das Esmeraldas: 7 dias/,
    }),
  ).toBeVisible();
});
