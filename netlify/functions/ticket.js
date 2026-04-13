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
    complaintId: p["Complaint ID (auto)"]?.formula?.string || "",
    priority: p["Current Priority"]?.select?.name || "",
    incidentDate: p["Incident Date"]?.date?.start || "",
    complaint: p["Complaint"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    description: p["Description"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    fieldAction: p["Field Action"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    assignedTo: p["Assigned To"]?.rich_text?.map((r) => r.plain_text).join("") || "",
    crewNotes: p["Crew Notes"]?.rich_text?.map((r) => r.plain_text).join("") || "",
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(ticket),
  };
};
