// archivo: public/js/registro.js
document.getElementById('btnRegister').addEventListener('click', async function (e) {
    e.preventDefault();

    const nombre = document.getElementById('RegisterNombre').value.trim();
    const email = document.getElementById('RegisterEmail').value.trim();
    const contraseña = document.getElementById('RegisterContraseña').value.trim();
    const rol = document.getElementById('RegisterRol').value;

    if (!nombre || !email || !contraseña || !rol) {
        alert('Por favor completa todos los campos.');
        return;
    }

    try {
        const res = await fetch('/operadores/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, contraseña, rol })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Registro exitoso.');
            document.getElementById('RegisterNombre').value = '';
            document.getElementById('RegisterEmail').value = '';
            document.getElementById('RegisterContraseña').value = '';
            document.getElementById('RegisterRol').value = '';
        } else {
            alert(data.error || 'Error al registrar.');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión con el servidor.');
    }
});
