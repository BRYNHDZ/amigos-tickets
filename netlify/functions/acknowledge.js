const NOTION_VERSION = "2022-06-28";

function parseNames(s) {
  return (s || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

function toTitleCase(n) {
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

async function notion(path, method, token, body) {
  return fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let id, who, status;
  try {
    ({ id, who, status } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "No ticket ID provided" }) };
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server not configured" }) };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Action Required complete flow — single-sign-off, no multi-person logic.
  if (status === "Resolved") {
    const res = await notion(`pages/${id}`, "PATCH", token, {
      properties: {
        "🔵 Status": { status: { name: "Resolved" } },
        "🔵 Date Resolved": { date: { start: today } },
      },
    });
    if (!res.ok) {
      const detail = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Notion update failed", detail }) };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, allDone: true, status: "Resolved" }),
    };
  }

  // Acknowledgement flow — may be single- or multi-person.
  const getRes = await notion(`pages/${id}`, "GET", token);
  if (!getRes.ok) {
    return { statusCode: 404, body: JSON.stringify({ error: "Ticket not found" }) };
  }
  const page = await getRes.json();
  const p = page.properties;

  const assigned = (p["Crew Names"]?.rollup?.array || []).map((item) => (item.title || []).map((rt) => rt.plain_text).join("") || (item.rich_text || []).map((rt) => rt.plain_text).join("")).filter(Boolean);
  const acked = parseNames(p["Acknowledged By"]?.rich_text?.map((r) => r.plain_text).join(""));

  const ackedLower = new Set(acked.map((n) => n.toLowerCase()));
  const whoName = who ? toTitleCase(who.trim()) : null;

  if (whoName && !ackedLower.has(whoName.toLowerCase())) {
    acked.push(whoName);
    ackedLower.add(whoName.toLowerCase());
  }

  const assignedLower = assigned.map((n) => n.toLowerCase());
  const allDone = assignedLower.length === 0
    ? true // nobody assigned → any ack closes it
    : assignedLower.every((n) => ackedLower.has(n));

  const properties = {
    "Acknowledged By": {
      rich_text: [{ type: "text", text: { content: acked.join(", ") } }],
    },
  };
  if (allDone) {
    properties["🔵 Status"] = { status: { name: "Completed" } };
    properties["🔵 Date Resolved"] = { date: { start: today } };
  }

  const patchRes = await notion(`pages/${id}`, "PATCH", token, { properties });
  if (!patchRes.ok) {
    const detail = await patchRes.text();
    return { statusCode: 502, body: JSON.stringify({ error: "Notion update failed", detail }) };
  }

  const waiting = assigned.filter((n) => !ackedLower.has(n.toLowerCase()));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      ok: true,
      allDone,
      who: whoName,
      acknowledgedBy: acked,
      assignedTo: assigned,
      waiting,
    }),
  };
};
