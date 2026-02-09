async function generateToken() {
  const client = document.getElementById('client').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const resultDiv = document.getElementById('result');

  if (!client || !username || !password) {
    resultDiv.textContent = "Please fill in all fields.";
    return;
  }

  const url = `https://${client}-api.aswat.co/auth/login`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: username,
        password: password
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const token = data?.content?.access_token;

    if (token) {
      resultDiv.textContent = token;
    } else {
      resultDiv.textContent = "Token not found. Check credentials.";
    }

  } catch (err) {
    console.error(err);
    resultDiv.textContent = `Error: ${err.message}`;
  }
}
