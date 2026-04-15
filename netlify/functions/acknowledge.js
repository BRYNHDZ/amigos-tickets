exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let id, status;
  try {
    ({ id, status } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "No ticket ID provided" }) };
  }

  const allowed = new Set(["Resolved", "Completed"]);
  const newStatus = allowed.has(status) ? status : "Resolved";

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server not configured" }) };
  }

  const today = new Date().toISOString().slice(0, 10);

  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        "🔵 Status": { status: { name: newStatus } },
        "🔵 Date Resolved": { date: { start: today } },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { statusCode: 502, body: JSON.stringify({ error: "Notion update failed", detail }) };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ ok: true, status: newStatus, dateResolved: today }),
  };
};
