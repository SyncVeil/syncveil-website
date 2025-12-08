document.addEventListener('DOMContentLoaded',()=>{
  const showLogin=document.getElementById('show-login');
  const showSignup=document.getElementById('show-signup');
  const formArea=document.getElementById('form-area');

  function renderLogin(){
    formArea.innerHTML=`
    <form id="loginForm">
      <label>Email<input name="email" type="email" required></label>
      <label>Password<input name="password" type="password" required></label>
      <div style="display:flex;gap:8px">
        <button class="btn">Login</button>
        <a href="/register.html" class="btn ghost">Create Account</a>
      </div>
      <div id="loginMsg" style="margin-top:10px;color:#fff;"></div>
    </form>`;
    const f=document.getElementById('loginForm');
    f.addEventListener('submit',async e=>{
      e.preventDefault();
      const data=Object.fromEntries(new FormData(f).entries());
      const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const j=await res.json();
      if(j.success)location.href='/dashboard.html';
      else document.getElementById('loginMsg').innerText=j.error||'Login failed';
    });
  }

  showLogin.addEventListener('click',renderLogin);
  showSignup.addEventListener('click',()=>location.href='/register.html');
  renderLogin();
});
