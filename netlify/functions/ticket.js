exports.handler = async (event) => {
  const id = event.queryStringParameters?.id;

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: "No ticket ID provided" }) };
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server not configured" }) };
  }

  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!res.ok) {
    return { statusCode: 404, body: JSON.stringify({ error: "Ticket not found" }) };
  }

  const data = await res.json();
  const p = data.properties;

  const ticket = {
    customerName: p["Customer Name"]?.title?.[0]?.plain_text || "",
    ticketId: p["Ticket ID"]?.formula?.string || "",
    priority: p["Current Priority"]?.select?.name || "",
    incidentDate: p["Incident Date"]?.date?.start || "",
    ticketDescription: p["Ticket Description"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    description: p["Description"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    fieldAction: p["Field Action"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    assignedTo: (p["Crew First Names"]?.rollup?.array || []).map((item) => (item.rich_text || []).map((rt) => rt.plain_text).join("") || (item.title || []).map((rt) => rt.plain_text).join("")).filter(Boolean).join(", "),
    address: p["Address"]?.place?.name || p["Address"]?.place?.address || p["Address"]?.place?.title || p["Address"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    acknowledgedBy: p["Acknowledged By"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    crewNotes: p["Crew Notes"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    ticketType: p["Ticket Type"]?.select?.name || "Action Required",
    status: p["🔵 Status"]?.status?.name || "",
    photos: (p["Photos"]?.files || []).map((f) => f.type === "external" ? f.external?.url : f.file?.url).filter(Boolean),
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(ticket),
  };
};
