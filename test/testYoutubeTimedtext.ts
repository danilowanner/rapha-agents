const testVideoId = "nn-lTCcMJWM";

async function getCaptionTracks(videoId: string) {
  console.log("Fetching video page to find caption tracks...");
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const html = await response.text();

  const captionsMatch = html.match(/"captionTracks":(\[.*?\])/);
  if (captionsMatch) {
    const tracks = JSON.parse(captionsMatch[1]);
    console.log("\nAvailable caption tracks:");
    tracks.forEach((track: any) => {
      console.log(`- ${track.languageCode} (${track.name?.simpleText || "auto"}) - ${track.baseUrl}`);
    });
    return tracks;
  }

  console.log("No caption tracks found in page");
  return null;
}

async function testDirectFetch(videoId: string): Promise<void> {
  console.log(`\n=== Testing direct timedtext API ===`);
  const languages = ["en", "en-US", "en-GB"];

  for (const lang of languages) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`;
      console.log(`\nTrying ${lang}: ${url}`);

      const response = await fetch(url);
      console.log(`Status: ${response.status}`);

      const xml = await response.text();
      console.log(`XML length: ${xml.length} characters`);

      if (xml.length > 0) {
        console.log(`First 200 chars:\n${xml.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`Error:`, error);
    }
  }
}

async function testWithCaptionUrl(track: any): Promise<void> {
  console.log(`\n=== Testing with caption URL ===`);
  console.log(`Full URL: ${track.baseUrl}`);

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const response = await fetch(track.baseUrl, { headers });
  const xml = await response.text();

  console.log(`Status: ${response.status}`);
  console.log(`Content-Type: ${response.headers.get("content-type")}`);
  console.log(`XML length: ${xml.length} characters`);

  if (xml.length > 0) {
    console.log(`First 1000 chars:\n${xml.substring(0, 1000)}`);

    const textMatches = Array.from(xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs));
    console.log(`\nFound ${textMatches.length} text segments`);

    if (textMatches.length > 0) {
      console.log(`First 3 segments:`);
      textMatches.slice(0, 3).forEach((m, i) => console.log(`  ${i + 1}. ${m[1]}`));
    }
  } else {
    console.log("Empty response - API may require different authentication or be blocked");
  }
}

async function main() {
  console.log(`Testing video: ${testVideoId}\n`);

  const tracks = await getCaptionTracks(testVideoId);

  await testDirectFetch(testVideoId);

  if (tracks && tracks.length > 0) {
    const enTrack = tracks.find((t: any) => t.languageCode === "en" || t.languageCode.startsWith("en"));
    if (enTrack) {
      await testWithCaptionUrl(enTrack);
    }
  }
}

main();
