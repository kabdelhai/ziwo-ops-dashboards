// Generate access token
async function generateToken() {
  const client = document.getElementById('client').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const output = document.getElementById('output');
  const tokenField = document.getElementById('accessToken');

  if (!client || !username || !password) {
    output.style.display = 'block';
    output.textContent = "All fields are required!";
    return;
  }

  output.style.display = 'block';
  output.textContent = "Generating access token...";

  try {
    const res = await fetch(`https://${client}-api.aswat.co/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password })
    });

    const data = await res.json();
    console.log("Token Response:", data);

    const token = data?.content?.access_token;
    if (!token) {
      output.textContent = "Login failed. Check credentials.";
      tokenField.value = '';
      return;
    }

    tokenField.value = token;
    output.textContent = "Access token generated successfully!";
  } catch (err) {
    console.error(err);
    output.textContent = "Failed to generate access token. Check network.";
  }
}

// Download agents CSV
async function downloadAgentsCSV() {
  const client = document.getElementById('client').value.trim();
  const token = document.getElementById('accessToken').value.trim();
  const output = document.getElementById('output');

  if (!client || !token) {
    output.style.display = 'block';
    output.textContent = "Please generate the access token first!";
    return;
  }

  output.textContent = "Fetching agents...";

  try {
    const res = await fetch(`https://${client}-api.aswat.co/callHistory/listAgents?deleted=false`, {
      headers: { 'access_token': token }
    });

    const data = await res.json();
    console.log("Agents Response:", data);

    const agents = Array.isArray(data) ? data : data.content; 
    if (!agents || agents.length === 0) {
      output.textContent = "No agents found.";
      return;
    }

    output.textContent = "Preparing CSV...";

    // Convert JSON to CSV
    const csvRows = [];
    const headers = Object.keys(agents[0]);
    csvRows.push(headers.join(','));

    agents.forEach(agent => {
      const values = headers.map(h => `"${(agent[h] || '').toString().replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'agents.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    output.textContent = "CSV downloaded successfully!";
  } catch (err) {
    console.error(err);
    output.textContent = "Failed to fetch agents. Check token or network.";
  }
}

