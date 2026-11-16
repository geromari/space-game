import { test, expect, type Page } from "@playwright/test";
async function begin(
  page: Page,
  destination: "earth" | "moon" | "mars" | "asteroid" = "mars",
  manual = false,
  demo = false,
) {
  await page.addInitScript(() =>
    localStorage.setItem(
      "vydex-tutorial-v1",
      JSON.stringify({ enabled: false, completed: [] }),
    ),
  );
  await page.goto("/");
  const names = {
    earth: "EARTH ORBIT",
    moon: "MOON",
    mars: "MARS",
    asteroid: "ASTEROID",
  };
  await page
    .getByRole("button", { name: new RegExp("^" + names[destination]) })
    .click();
  await page
    .getByRole("button", {
      name: demo
        ? "Mars 3-minute demo"
        : manual
          ? "Manual mission → choose rocket"
          : "Starter mission → choose rocket",
      exact: true,
    })
    .click();
  await page.getByRole('button',{name:/Use (Scout|Pioneer|Titan) & assemble/}).click();
}
async function launch(page: Page, skip = true) {
  await page.getByRole("button", { name: /Run preflight/ }).click();
  await page.getByRole("button", { name: /Authorize launch/ }).click();
  await expect(
    page.getByRole("button", { name: /Skip cinematic after authorization/ }),
  ).toBeDisabled();
  for (const name of [
    "Verify payload fairing",
    "Switch to internal power",
    "Release launch interlocks",
  ])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "follow", exact: true }).click();
  if (skip)
    await page
      .getByRole("button", { name: /Skip cinematic after authorization/ })
      .click();
  else
    await expect(
      page.getByText("LAUNCH VEHICLE SEPARATION", { exact: true }),
    ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Hibernate", exact: true })
    .click({ timeout: 45000 });
  await page.getByRole("button", { name: "Execute burn", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: /Begin final descent|Begin satellite deployment|Begin rendezvous/,
    }),
  ).toBeEnabled({ timeout: 60000 });
  await page
    .getByRole("button", {
      name: /Begin final descent|Begin satellite deployment|Begin rendezvous/,
    })
    .click();
}
async function land(page: Page) {
  await page.getByRole("button", { name: /Take control/ }).click();
  await page
    .getByRole("button", { name: /Deploy rover/ })
    .click({ timeout: 180000 });
}
async function marsScience(page: Page, names: string[]) {
  await page.getByLabel("Earth-command mode").check();
  for (const name of names) {
    await page.getByRole("button", { name: `Queue drive to ${name}` }).click();
    await expect(page.locator('.target-row').filter({hasText:name})).toContainText('STORED',{timeout:140000});
  }
  await page.getByRole("button", { name: /Transmit/ }).click();
  await expect(
    page.getByText("MISSION COMPLETE / EARTH ACKNOWLEDGED"),
  ).toBeVisible({ timeout: 15000 });
}
test("manual assembly, incompatible part explanation, drag installation, removal and every information guide", async ({
  page,
}) => {
  await begin(page, "moon", true);
  await page
    .getByRole("button", { name: "Install Structural bus", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select Battery pack", exact: true })
    .click();
  const card = page.locator(".workshop-card").filter({
    has: page.getByRole("button", {
      name: "Select Battery pack",
      exact: true,
    }),
  });
  await card.dragTo(
    page.getByRole("button", {
      name: "Mount Battery pack at Energy bay",
      exact: true,
    }),
  );
  await expect(
    page.getByRole("button", { name: "Remove Battery pack", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", {
      name: "Information about Battery pack",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Battery pack information" }),
  ).toContainText("600 Wh");
  await page
    .getByRole("button", { name: "Close component information" })
    .click();
  await page
    .getByRole("button", { name: "Remove Battery pack", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Install Battery pack", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Select Solar exploration rover",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Install Solar exploration rover",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Mars");
});
test("tutorial skip and replay preserve the same craft", async ({ page }) => {
  await page.goto("/");
  const tutorial = page.getByRole("region", { name: "Interactive tutorial" });
  await tutorial.getByRole("button", { name: /Next/ }).click();
  await page.getByRole("button", { name: /^MOON/ }).click();
  await page
    .getByRole("button", { name: "Starter mission → choose rocket", exact: true })
    .click();
  await expect(tutorial).toContainText("Choose the right carrier");
  await tutorial.getByRole('button',{name:'Skip',exact:true}).click();
  await page.getByRole('button',{name:/Use Pioneer & assemble/}).click();
  await expect(tutorial).not.toBeVisible();
  const mass = await page
    .getByText("/ 800 kg", { exact: true })
    .locator("..")
    .textContent();
  await page
    .getByRole("button", { name: "Pause mission", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Replay tutorial", exact: true })
    .click();
  await expect(tutorial).toBeVisible();
  await expect(
    page.getByText("/ 800 kg", { exact: true }).locator(".."),
  ).toHaveText(mass!);
});
test("Earth orbit: complete launch separation, stabilize, deploy, observe and downlink", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await begin(page, "earth");
  await launch(page, false);
  const deploy = page.getByRole("button", {
    name: "Deploy satellite & solar array",
    exact: true,
  });
  await expect(deploy).toBeEnabled({ timeout: 30000 });
  await deploy.click();
  await page.getByRole("button", { name: /EARTH OBSERVATION/ }).click();
  await expect(
    page.getByRole("button", { name: /✓ EARTH OBSERVATION/ }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Transmit observations", exact: true })
    .click();
  await expect(
    page.getByText("MISSION COMPLETE / EARTH ACKNOWLEDGED"),
  ).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
});
test("Moon: airless landing, panorama, spectrum and downlink", async ({
  page,
}) => {
  await begin(page, "moon");
  await launch(page);
  await page.getByRole("button", { name: /Take control/ }).click();
  await page
    .getByRole("button", { name: /Deploy rover|Begin lunar science/ })
    .click({ timeout: 180000 });
  for (let i = 0; i < 2; i++) {
    const collect = page
      .getByRole("button", { name: "Collect", exact: true })
      .first();
    await collect.click();
    await expect(page.getByText(/M[12] ·/)).not.toBeVisible({ timeout: 15000 });
  }
  await page
    .getByRole("button", { name: "Transmit lunar observations", exact: true })
    .click();
  await expect(
    page.getByText("MISSION COMPLETE / EARTH ACKNOWLEDGED"),
  ).toBeVisible({ timeout: 15000 });
});
test("Asteroid: actual RCS approach, spectral scan, sample and downlink", async ({
  page,
}) => {
  await begin(page, "asteroid");
  await launch(page);
  await page
    .getByRole("button", { name: "Approach science corridor", exact: true })
    .click();
  for (const name of ["VY-26 SPECTRUM", "CONTACT SAMPLE"]) {
    const button = page.getByRole("button", { name: new RegExp("^" + name) });
    await expect(button).toBeEnabled({ timeout: 120000 });
    await button.click();
    await expect(
      page.getByRole("button", { name: new RegExp("^✓ " + name) }),
    ).toBeVisible({ timeout: 20000 });
  }
  await page
    .getByRole("button", { name: "Transmit observations", exact: true })
    .click();
  await expect(
    page.getByText("MISSION COMPLETE / EARTH ACKNOWLEDGED"),
  ).toBeVisible({ timeout: 15000 });
});
test("Mars: original three-target imaging campaign remains complete", async ({
  page,
}) => {
  await begin(page);
  await launch(page);
  await land(page);
  await marsScience(page, ["THE SENTINEL", "ECHO RIDGE", "PALE BASIN"]);
});
test("Mars judge demo uses the same real systems", async ({ page }) => {
  await begin(page, "mars", false, true);
  await launch(page);
  await land(page);
  await marsScience(page, ["THE SENTINEL"]);
});
test("mobile information panel and install UI stay accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page, "earth");
  await page
    .getByRole("button", {
      name: "Information about Navigation computer",
      exact: true,
    })
    .tap();
  await expect(page.getByRole("dialog")).toContainText("Navigation computer");
  await page.getByRole("button", { name: "Close component information" }).tap();
  await page.getByRole("button", { name: "Settings", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: /Install \/ download game/ }),
  ).toBeVisible();
});

// Browser infrastructure may be unavailable in restricted environments; these run against the real app.
test('rocket catalogue uses model images, enforces route capacity and keeps assembly when switching',async({page})=>{
 await begin(page,'mars');
 await page.getByRole('button',{name:/Switch carrier/}).click();
 await expect(page.locator('.launcher-card img')).toHaveCount(3);
 await page.locator('.launcher-select').filter({hasText:'Vydex Scout'}).click();
 await expect(page.getByRole('button',{name:/Use Scout & assemble/})).toBeDisabled();
 await page.getByRole('button',{name:'Explain Destination payload capacity',exact:true}).first().click();
 await expect(page.getByRole('dialog',{name:'Launch vehicle information'})).toContainText('Wet mass');
 await page.getByRole('button',{name:'Close rocket information'}).click();
 await page.locator('.launcher-select').filter({hasText:'Vydex Titan'}).click();
 await page.getByRole('button',{name:/Use Titan & assemble/}).click();
 await expect(page.getByRole('button',{name:'Select Solar exploration rover',exact:true})).toBeVisible();
});
test('close-up inspection and control information resume without losing the vehicle',async({page})=>{
 await begin(page,'earth');
 await page.getByRole('button',{name:'engine',exact:true}).click();
 await page.getByRole('button',{name:'Reset camera',exact:true}).click();
 await page.getByRole('button',{name:'Pause mission',exact:true}).click();
 await page.getByRole('button',{name:'Inspect spacecraft & components',exact:true}).click();
 await page.getByLabel('Labels',{exact:true}).check();
 await page.getByRole('button',{name:'Resume same mission',exact:true}).click();
 await expect(page.getByRole('button',{name:/Run preflight/})).toBeVisible();
});
