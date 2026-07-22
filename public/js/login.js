// ============================================================
// LOGIN.JS - LÓGICA DE LOGIN
// ============================================================

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usuario = document.getElementById('usuario').value;
  const senha = document.getElementById('senha').value;
  const errorMsg = document.getElementById('error-msg');

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha })
    });
    const data = await response.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'funcionario.html';
    } else {
      errorMsg.textContent = 'Usuário ou senha inválidos';
    }
  } catch (err) {
    errorMsg.textContent = 'Erro ao conectar ao servidor';
  }
});
