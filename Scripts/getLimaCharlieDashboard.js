module.exports = async function () {
	const platformMap = {
    268435456: "Windows",
    536870912: "Linux",
    805306368: "MacOS",
    1073741824: "iOS",
    1342177280: "Android",
    1610612736: "ChromeOS",
    2147483648: "Text",
    2415919104: "JSON",
    2684354560: "GCP",
    2952790016: "AWS",
    3221225472: "VMWare",
    3489660928: "1Password",
    3758096384: "Microsoft/Office",
    16777216: "CrowdStrike",
    33554432: "XML",
    50331648: "Windows",
    67108864: "Microsoft",
    83886080: "Duo",
    134217728: "GitHub",
    150994944: "Slack",
    167772160: "Common",
    184549376: "LimaCharlie",
    201326592: "Azure",
    218103808: "Azure",
    234881024: "Canary",
    251658240: "Guard"
  };

  const res = await fetch("http://localhost:3040/lc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: "sensors/{oid}" })
  });

  if (!res.ok) {
    new Notice("❌ Failed to fetch agent list.");
    return;
  }

  const { sensors } = await res.json();
  const file = app.workspace.getActiveFile();

  if (!file) {
    new Notice("❌ No active file found.");
    return;
  }

  // Add the dashboard header
  await app.vault.append(file, "## Agents\n\n");

  // Initialize table rows array
  const rows = [];
  const platformCount = {}; // Object to hold the platform counts

  // Iterate over each sensor (agent)
  for (const s of sensors) {
    const sid = s.sid;
    const hostname = s.hostname || sid;
    const ip = s.ext_ip || "?";
    const lastSeen = s.alive || "?";
	const version = s.version || "?";
	const status = s.is_isolated || "?";
    

    // Map platform ID to platform name
    const platformName = platformMap[s.plat] || "Unknown";

    // Count the platforms
    platformCount[platformName] = platformCount[platformName] ? platformCount[platformName] + 1 : 1;

    // Construct the agent note content
    const agentNoteContent = [
      `# Agent ${hostname}`,
      `- **SID**: ${sid}`,
      `- **External IP**: ${ip}`,
      `- **Last Seen**: ${lastSeen}`,
       `- **OS**: ${platformName}`,
      `- **Version**: ${version || "Unknown"}`,
      `- **Status**: ${s.status || "Unknown"}`
    ].join("\n");

    const path = `Agents/${sid}.md`;

    // Create or update the agent's note
    const fileExists = app.vault.getAbstractFileByPath(path);
    if (fileExists) {
      await app.vault.modify(fileExists, agentNoteContent);
      /* #=new Notice(`✅ Updated note for ${hostname}`); */
    } else {
      await app.vault.create(path, agentNoteContent);
      /* new Notice(`✅ Created new note for ${hostname}`); */
    }

    // Add agent data to the rows for the table
    const agentNoteLink = `[View ${hostname}](${path})`; // Proper link syntax
    rows.push([hostname, sid, ip, lastSeen, agentNoteLink]);
  }

  // Generate and append the Dataview table in the note
  const tableMarkdown = [
    "### Agent List\n",
    "| Hostname | SID | External IP | Last Seen | Action |",
    "|----------|-----|-------------|-----------|--------|", // Adjusted for proper markdown table
    ...rows.map(r => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]} |`)
  ].join("\n");

  await app.vault.append(file, tableMarkdown + "\n\n");

const chartLabels = Object.keys(platformCount);  // Platform names (labels)
const chartData = Object.values(platformCount);  // Counts of each platform

// Correct chart Markdown syntax for Obsidian Chart plugin
const chartMarkdown = `
### Platform Distribution Chart

\`\`\`chart
type: pie
labels: ["${chartLabels.join('","')}"]
series:
- title: Count
  data: [${chartData.join(',')}]
tension: 0.2
width: 15%
labelColors: true
fill: false
beginAtZero: false
bestFit: false
bestFitTitle: undefined
bestFitNumber: 0
\`\`\`
`;

  // Append the chart to the note
	await app.vault.append(file, chartMarkdown + "\n\n");

	new Notice("✅ Agent dashboard generated with platform pie chart.");

// Fetch detections for all agents via the proxy server
// Get current time and convert it to a Unix timestamp (in seconds)
const now = Math.floor(Date.now() / 1000);

// Example: Set start to 24 hours ago
const start = now - 24 * 60 * 60;  // 24 hours in seconds

// Set end as the current time (now)
const end = now;

// Correct fetch request for detections (no sensor_id filtering)
const detectionsRes = await fetch("http://localhost:3040/lc", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    endpoint: `insight/{oid}/detections?start=${start}&end=${end}`, // No sensor_id, fetch all detections
    params: {
      start: start, // start time in Unix timestamp format
      end: end,     // end time in Unix timestamp format
    }
  })
});

// Debugging - log the initial response for detections
console.log("Initial Detections Response: ", detectionsRes);

let detectionsTable = "";

// Optional: Add a delay to ensure proper response processing
await new Promise(resolve => setTimeout(resolve, 2000));  // 2 seconds delay to wait for the response

if (detectionsRes.ok) {
  const detectionsData = await detectionsRes.json();
  console.log("Parsed Detections Data: ", detectionsData);  // Log the parsed detections data
  detectionsTable = generateDetectionsTable(detectionsData.detects); // Use the 'detects' object
} else {
  detectionsTable = "❌ Failed to fetch detections.";
  console.error("Error fetching detections: ", detectionsRes.status, detectionsRes.statusText); // Log error if fetching fails
}

// Append the detections table to the note
await app.vault.append(file, "### Latest Detections (last 24 Hours)\n\n" + detectionsTable + "\n\n");
};

// Helper function to generate the detections table
function generateDetectionsTable(detects) {
  if (!detects || detects.length === 0) {
    return "No detections found."; // Return message if there are no detections
  }

  let table = "| Detection ID | Category | Priority | Timestamp | Link |\n";
  table += "|--------------|----------|----------|-----------|------|\n";

  detects.forEach(d => {
    const genTime = new Date(d.gen_time).toLocaleString(); // Convert gen_time to a readable date
    table += `| ${d.detect_id} | ${d.cat} | ${d.priority} | ${genTime} | [View Detection](${d.link}) |\n`;
  });

  return table; // Return the formatted table as a string
}