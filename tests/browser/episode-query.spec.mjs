import { test, expect } from "@playwright/test";

const query = page => page.evaluate(() => SkipIntroEpisode.readQuery(document, "https://example.com/watch"));
async function fixture(page, html) {
  await page.goto("/popup.html");
  await page.setContent(html);
  await page.addScriptTag({ url: "/episode.js" });
}

test("reads a visible heading or social title when the tab title is generic", async ({ page }) => {
  await fixture(page, '<title>Example player</title><h1>The Mentalist S01E02</h1>');
  await expect.poll(() => query(page)).toEqual({ title: "The Mentalist", season: 1, episode: 2 });
  await fixture(page, '<title>Example player</title><meta property="og:title" content="The Mentalist (2008) 1x02">');
  expect(await query(page)).toEqual({ title: "The Mentalist", year: 2008, season: 1, episode: 2 });
});

test("combines a series heading with selected episode controls, not recommendation links", async ({ page }) => {
  await fixture(page, `<title>Watch online</title><h1>The Mentalist</h1>
    <label for="season">Season</label><select id="season"><option>1</option><option>2</option></select>
    <label for="episode">Episode</label><select id="episode"><option>Episode 2: Red Hair</option><option>Episode 3</option></select>
    <a href="/next">The Mentalist S01E03</a><aside><h1>Another Show S02E04</h1></aside>
    <button hidden aria-current="true">Season 9 Episode 9</button>`);
  expect(await query(page)).toEqual({ title: "The Mentalist", season: 1, episode: 2 });
  await page.getByLabel("Episode", { exact: true }).selectOption({ label: "Episode 3" });
  expect(await query(page)).toEqual({ title: "The Mentalist", season: 1, episode: 3 });
});

test("accepts an explicitly active episode but rejects ambiguity and bare names", async ({ page }) => {
  await fixture(page, '<h1>The Mentalist</h1><button aria-current="true">S1E2</button><button>S1E3</button>');
  expect(await query(page)).toEqual({ title: "The Mentalist", season: 1, episode: 2 });
  await page.locator('button').last().evaluate(node => node.setAttribute("aria-current", "true"));
  expect(await query(page)).toBeNull();
  await fixture(page, '<title>Show One S1E2</title><h1>Show Two S1E2</h1>');
  expect(await query(page)).toBeNull();
  await fixture(page, '<h1>The Mentalist</h1><button>Episode 2</button>');
  expect(await query(page)).toBeNull();
});

test("uses explicit URL episode numbers and rejects stale selected controls", async ({ page }) => {
  await fixture(page, '<h1>The Mentalist</h1>');
  expect(await page.evaluate(() => SkipIntroEpisode.readQuery(document, "https://example.com/watch?season=1&episode=2"))).toEqual({ title: "The Mentalist", season: 1, episode: 2 });
  await fixture(page, '<title>The Mentalist S1E2</title><button aria-selected="true">Episode 3</button>');
  expect(await query(page)).toBeNull();
});

test("reads Movy Next.js metadata from the document and follows episode URL changes", async ({ page }) => {
  const data = { page: "/tv/[...params]", query: { params: ["1413", "1", "1"] }, props: { pageProps: {
    tmdbId: "1413", details: { mediaType: "tv", tmdbId: 1413, imdbId: "tt1844624", episodeInfo: { imdb_id: "tt2030547" } }
  } } };
  await fixture(page, `<title>American Horror Story | Movy</title><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`);
  expect(await page.evaluate(() => SkipIntroEpisode.readDocument(document, "https://www.movy.sx/tv/1413/1/1?play=true"))).toEqual({ imdbId: "tt1844624", tmdbId: 1413, season: 1, episode: 1 });
  expect(await page.evaluate(() => SkipIntroEpisode.readDocument(document, "https://www.movy.sx/tv/1413/1/2?play=true"))).toEqual({ imdbId: "tt1844624", tmdbId: 1413, season: 1, episode: 2 });
});
