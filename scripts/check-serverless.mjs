const inputBaseUrl = process.argv[2] || "http://localhost:3000";
const baseUrl = inputBaseUrl.replace(/\/+$/, "");

async function run() {
  const checks = [
    {
      name: "health endpoint",
      url: `${baseUrl}/api/health`,
      expectedStatus: 200,
    },
    {
      name: "generate-quiz method guard",
      url: `${baseUrl}/api/generate-quiz`,
      expectedStatus: 405,
    },
  ];

  let hasFailure = false;

  for (const check of checks) {
    try {
      const response = await fetch(check.url, { method: "GET" });
      const bodyText = await response.text();
      const pass = response.status === check.expectedStatus;
      const summary = `${check.name}: ${response.status} (expected ${check.expectedStatus})`;

      if (pass) {
        console.log(`PASS - ${summary}`);
      } else {
        hasFailure = true;
        console.error(`FAIL - ${summary}`);
        console.error(bodyText.slice(0, 400));
      }
    } catch (error) {
      hasFailure = true;
      console.error(`FAIL - ${check.name}: request error`);
      console.error(error instanceof Error ? error.message : String(error));
    }
  }

  if (hasFailure) {
    process.exit(1);
  }

  console.log("Serverless checks passed.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
