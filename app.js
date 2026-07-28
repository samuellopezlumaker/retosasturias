// ============================================
// DATOS
// ============================================
const AMIGOS = ["garcia","fer","jaco","ricis","sevi","sergio","isra","samu","pablo","lagu","carlitos"];

// Estos son los retos con los que arranca la tabla 'retos' en Supabase
// (ver supabase_retos.sql). Aquí se guardan solo como copia de reserva por
// si Supabase no está disponible; la lista real que se usa es la que se
// carga desde la base de datos en cargarRetos().
const RETOS_SEMILLA = [
  { id: "f1", categoria: "facil", puntos: 1, texto: "Conseguir 3 o más Instagrams" },
  { id: "f2", categoria: "facil", puntos: 1, texto: "Meterse en medio de una foto" },
  { id: "f3", categoria: "facil", puntos: 1, texto: "Quitarse la camiseta 5 minutos" },
  { id: "m1", categoria: "medio", puntos: 2, texto: "Hacerle una foto a unas tías y luego enseñarles una foto de unos quesos" },
  { id: "m2", categoria: "medio", puntos: 2, texto: "Subirse a algún sitio (escenario si hay)" },
  { id: "m3", categoria: "medio", puntos: 2, texto: "Hacerse pasar por guiri" },
  { id: "m4", categoria: "medio", puntos: 2, texto: "Hacerse pasar por gay" },
  { id: "m5", categoria: "medio", puntos: 2, texto: "Camelar a una gorda (liarse con ella es opcional)" },
  { id: "m6", categoria: "medio", puntos: 2, texto: "Llevarse mobiliario urbano (conos, por ejemplo)" },
  { id: "m7", categoria: "medio", puntos: 2, texto: "Liarse con una" },
  { id: "d1", categoria: "dificil", puntos: 3, texto: "Conseguirle tía a otro" },
  { id: "d2", categoria: "dificil", puntos: 3, texto: "Conseguir que inviten a una copa (no vale invitar tú antes)" },
  { id: "d3", categoria: "dificil", puntos: 3, texto: "Conseguir after o que se vengan de after" },
  { id: "d4", categoria: "dificil", puntos: 3, texto: "Estar media hora solos por ahí y, si es posible, hacer amigos" },
  { id: "md1", categoria: "muydificil", puntos: 4, texto: "Hacer un trío" },
  { id: "md2", categoria: "muydificil", puntos: 4, texto: "Enseñar un cacho de escroto y decir que es chicle pegao" },
];

let RETOS = RETOS_SEMILLA;

const ORDEN_CATEGORIA = { facil: 0, medio: 1, dificil: 2, muydificil: 3 };
const PUNTOS_POR_CATEGORIA = { facil: 1, medio: 2, dificil: 3, muydificil: 4 };

const ETIQUETAS_CATEGORIA = {
  facil: "Fácil · 1 pt",
  medio: "Medio · 2 pts",
  dificil: "Difícil · 3 pts",
  muydificil: "Muy difícil · 4 pts",
};

// ============================================
// SUPABASE
// ============================================
// Ojo: esto se construye nada más cargar la página. Si falla (config.js sin
// rellenar, el script de Supabase no ha cargado, etc.) NO debe impedir que
// se pinte la pantalla de selección de nombre, así que va en try/catch.
let supabaseClient = null;
let configPendiente = false;

try {
  if (typeof SUPABASE_URL === "undefined" || SUPABASE_URL.includes("TU-PROYECTO")) {
    configPendiente = true;
    console.warn("Falta configurar config.js con tu URL y anon key de Supabase.");
  } else if (!window.supabase) {
    console.error("La librería de Supabase no se ha cargado (revisa tu conexión a internet o el <script> del CDN).");
  } else {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("Error al crear el cliente de Supabase:", e);
}

let usuarioActual = localStorage.getItem("retos_usuario") || null;
let progreso = {}; // { amigo: Set(reto_ids conseguidos) }

// ============================================
// CARGA DE DATOS
// ============================================
async function cargarProgreso() {
  progreso = {};
  AMIGOS.forEach(a => progreso[a] = new Set());

  if (!supabaseClient) {
    mostrarAvisoConfig();
    return;
  }

  const { data, error } = await supabaseClient.from("progreso").select("amigo, reto").eq("completado", true);
  if (error) {
    console.error("Error cargando progreso:", error);
    mostrarAvisoConfig("No se ha podido conectar con Supabase. Revisa config.js y la tabla 'progreso'.");
    return;
  }
  data.forEach(fila => {
    if (!progreso[fila.amigo]) progreso[fila.amigo] = new Set();
    progreso[fila.amigo].add(fila.reto);
  });
}

async function cargarRetos() {
  if (!supabaseClient) {
    RETOS = RETOS_SEMILLA;
    return;
  }
  const { data, error } = await supabaseClient.from("retos").select("*");
  if (error) {
    console.error("Error cargando retos:", error);
    mostrarAvisoConfig("No se ha podido cargar la lista de retos. Revisa la tabla 'retos'.");
    RETOS = RETOS_SEMILLA;
    return;
  }
  if (!data || data.length === 0) {
    RETOS = RETOS_SEMILLA;
    return;
  }
  RETOS = data.sort((a, b) => {
    const porCategoria = ORDEN_CATEGORIA[a.categoria] - ORDEN_CATEGORIA[b.categoria];
    if (porCategoria !== 0) return porCategoria;
    return (a.creado_en || "").localeCompare(b.creado_en || "");
  });
}

async function agregarReto(texto, categoria) {
  if (!supabaseClient) {
    mostrarAvisoConfig();
    return false;
  }
  const nuevoReto = {
    id: crypto.randomUUID(),
    texto: texto.trim(),
    categoria,
    puntos: PUNTOS_POR_CATEGORIA[categoria],
  };
  const { error } = await supabaseClient.from("retos").insert(nuevoReto);
  if (error) {
    console.error("Error añadiendo reto:", error);
    return false;
  }
  await cargarRetos();
  return true;
}

async function borrarReto(retoId) {
  if (!supabaseClient) {
    mostrarAvisoConfig();
    return;
  }
  // Primero quitamos el progreso guardado de ese reto, luego el reto en sí
  await supabaseClient.from("progreso").delete().eq("reto", retoId);
  const { error } = await supabaseClient.from("retos").delete().eq("id", retoId);
  if (error) console.error("Error borrando reto:", error);
  await cargarRetos();
  Object.keys(progreso).forEach(amigo => progreso[amigo].delete(retoId));
}

async function marcarReto(amigo, retoId, conseguido) {
  if (!supabaseClient) {
    mostrarAvisoConfig();
    return;
  }
  if (conseguido) {
    const { error } = await supabaseClient.from("progreso")
      .upsert({ amigo, reto: retoId, completado: true }, { onConflict: "amigo,reto" });
    if (error) console.error(error);
  } else {
    const { error } = await supabaseClient.from("progreso")
      .delete().eq("amigo", amigo).eq("reto", retoId);
    if (error) console.error(error);
  }
}

function mostrarAvisoConfig(mensaje) {
  const aviso = document.querySelector(".aviso");
  if (!aviso) return;
  aviso.textContent = mensaje || "Falta configurar Supabase en config.js: los puntos no se están guardando todavía.";
  aviso.style.color = "var(--pink)";
}

function puntosDe(amigo) {
  const hechos = progreso[amigo] || new Set();
  let total = 0;
  RETOS.forEach(r => { if (hechos.has(r.id)) total += r.puntos; });
  return total;
}

// ============================================
// UTILIDADES DE AVATAR
// ============================================
function crearAvatarImg(nombre, claseBase) {
  const img = document.createElement("img");
  img.src = `${nombre}.jpg`;
  img.alt = nombre;
  img.className = claseBase;
  img.onerror = function () {
    // Si no existe la foto, mostramos la inicial en su lugar
    const div = document.createElement("div");
    div.className = claseBase + " placeholder";
    div.textContent = nombre.charAt(0).toUpperCase();
    img.replaceWith(div);
  };
  return img;
}

// ============================================
// PANTALLA DE SELECCIÓN
// ============================================
function pintarSeleccion() {
  const grid = document.getElementById("grid-amigos");
  grid.innerHTML = "";
  AMIGOS.forEach(nombre => {
    const btn = document.createElement("button");
    btn.className = "btn-amigo";
    btn.appendChild(crearAvatarImg(nombre, "avatar-mini"));
    const span = document.createElement("span");
    span.textContent = nombre;
    btn.appendChild(span);
    btn.onclick = () => seleccionarUsuario(nombre);
    grid.appendChild(btn);
  });
}

function seleccionarUsuario(nombre) {
  usuarioActual = nombre;
  localStorage.setItem("retos_usuario", nombre);
  mostrarApp();
}

// ============================================
// VISTA PERFIL
// ============================================
function pintarPerfil() {
  const cont = document.getElementById("vista-perfil");
  cont.innerHTML = "";

  const cabecera = document.createElement("div");
  cabecera.className = "cabecera-perfil";
  cabecera.appendChild(crearAvatarImg(usuarioActual, "avatar-grande"));
  const nombreEl = document.createElement("div");
  nombreEl.className = "nombre-perfil";
  nombreEl.textContent = usuarioActual;
  cabecera.appendChild(nombreEl);
  const puntosEl = document.createElement("div");
  puntosEl.className = "puntos-perfil";
  puntosEl.textContent = `${puntosDe(usuarioActual)} puntos`;
  cabecera.appendChild(puntosEl);
  cont.appendChild(cabecera);

  ["facil", "medio", "dificil", "muydificil"].forEach(cat => {
    const titulo = document.createElement("div");
    titulo.className = "categoria-titulo";
    titulo.innerHTML = `<span class="etiqueta-categoria ${cat}">${ETIQUETAS_CATEGORIA[cat]}</span><div class="barra"></div>`;
    cont.appendChild(titulo);

    RETOS.filter(r => r.categoria === cat).forEach(reto => {
      cont.appendChild(crearTarjetaReto(reto));
    });
  });
}

function crearTarjetaReto(reto) {
  const hechos = progreso[usuarioActual] || new Set();
  const conseguido = hechos.has(reto.id);

  const div = document.createElement("div");
  div.className = "reto" + (conseguido ? " conseguido" : "");

  const check = document.createElement("div");
  check.className = "check-reto";
  check.textContent = "✓";
  div.appendChild(check);

  const texto = document.createElement("div");
  texto.className = "texto-reto";
  texto.textContent = reto.texto;
  div.appendChild(texto);

  const valor = document.createElement("div");
  valor.className = "valor-reto";
  valor.textContent = `+${reto.puntos}`;
  div.appendChild(valor);

  const sello = document.createElement("div");
  sello.className = "sello";
  sello.textContent = "¡CONSEGUIDO!";
  div.appendChild(sello);

  div.onclick = async () => {
    const yaEstaba = (progreso[usuarioActual] || new Set()).has(reto.id);
    const nuevoEstado = !yaEstaba;
    if (nuevoEstado) progreso[usuarioActual].add(reto.id);
    else progreso[usuarioActual].delete(reto.id);
    div.classList.toggle("conseguido", nuevoEstado);
    document.getElementById("vista-perfil").querySelector(".puntos-perfil").textContent = `${puntosDe(usuarioActual)} puntos`;
    await marcarReto(usuarioActual, reto.id, nuevoEstado);
  };

  return div;
}

// ============================================
// VISTA CLASIFICACIÓN
// ============================================
function pintarClasificacion() {
  const cont = document.getElementById("vista-clasificacion");
  cont.innerHTML = "";

  const ranking = AMIGOS
    .map(a => ({ nombre: a, puntos: puntosDe(a) }))
    .sort((a, b) => b.puntos - a.puntos);

  const maxPuntos = Math.max(1, ranking[0]?.puntos || 1);

  ranking.forEach((item, i) => {
    const fila = document.createElement("div");
    fila.className = "fila-ranking";
    if (i === 0) fila.classList.add("oro");
    else if (i === 1) fila.classList.add("plata");
    else if (i === 2) fila.classList.add("bronce");

    const puesto = document.createElement("div");
    puesto.className = "puesto";
    puesto.textContent = i === 0 ? "🏆" : `${i + 1}º`;
    fila.appendChild(puesto);

    fila.appendChild(crearAvatarImg(item.nombre, "avatar-ranking"));

    const info = document.createElement("div");
    info.className = "info-ranking";
    const nombreEl = document.createElement("div");
    nombreEl.className = "nombre-ranking";
    nombreEl.textContent = item.nombre;
    info.appendChild(nombreEl);
    const barra = document.createElement("div");
    barra.className = "barra-puntos";
    const relleno = document.createElement("div");
    relleno.className = "barra-puntos-relleno";
    relleno.style.width = `${(item.puntos / maxPuntos) * 100}%`;
    barra.appendChild(relleno);
    info.appendChild(barra);
    fila.appendChild(info);

    const puntos = document.createElement("div");
    puntos.className = "puntos-ranking";
    puntos.textContent = item.puntos;
    fila.appendChild(puntos);

    cont.appendChild(fila);
  });
}

// ============================================
// VISTA ADMIN (añadir / quitar retos)
// ============================================
function pintarAdmin() {
  const cont = document.getElementById("vista-admin");
  cont.innerHTML = "";

  const titulo = document.createElement("h2");
  titulo.className = "titular titulo-admin";
  titulo.textContent = "Añadir un reto nuevo";
  cont.appendChild(titulo);

  const form = document.createElement("form");
  form.className = "form-admin";

  const textarea = document.createElement("textarea");
  textarea.className = "input-admin";
  textarea.placeholder = "Describe el reto...";
  textarea.rows = 2;
  form.appendChild(textarea);

  const filaSelect = document.createElement("div");
  filaSelect.className = "fila-select-admin";

  const select = document.createElement("select");
  select.className = "select-admin";
  [
    ["facil", "Fácil · 1 pt"],
    ["medio", "Medio · 2 pts"],
    ["dificil", "Difícil · 3 pts"],
    ["muydificil", "Muy difícil · 4 pts"],
  ].forEach(([valor, texto]) => {
    const opt = document.createElement("option");
    opt.value = valor;
    opt.textContent = texto;
    select.appendChild(opt);
  });
  filaSelect.appendChild(select);

  const btnAdd = document.createElement("button");
  btnAdd.type = "submit";
  btnAdd.className = "btn-admin-add";
  btnAdd.textContent = "Añadir reto";
  filaSelect.appendChild(btnAdd);

  form.appendChild(filaSelect);

  const avisoForm = document.createElement("div");
  avisoForm.className = "aviso-form-admin oculto";
  form.appendChild(avisoForm);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const texto = textarea.value.trim();
    if (!texto) return;
    btnAdd.disabled = true;
    btnAdd.textContent = "Añadiendo...";
    const ok = await agregarReto(texto, select.value);
    btnAdd.disabled = false;
    btnAdd.textContent = "Añadir reto";
    if (ok) {
      textarea.value = "";
      pintarAdmin();
    } else {
      avisoForm.textContent = "No se ha podido guardar el reto. Revisa la conexión con Supabase.";
      avisoForm.classList.remove("oculto");
    }
  };

  cont.appendChild(form);

  const tituloLista = document.createElement("h2");
  tituloLista.className = "titular titulo-admin";
  tituloLista.textContent = "Retos actuales";
  cont.appendChild(tituloLista);

  ["facil", "medio", "dificil", "muydificil"].forEach(cat => {
    const retosCat = RETOS.filter(r => r.categoria === cat);
    if (retosCat.length === 0) return;

    const tituloCat = document.createElement("div");
    tituloCat.className = "categoria-titulo";
    tituloCat.innerHTML = `<span class="etiqueta-categoria ${cat}">${ETIQUETAS_CATEGORIA[cat]}</span><div class="barra"></div>`;
    cont.appendChild(tituloCat);

    retosCat.forEach(reto => {
      const fila = document.createElement("div");
      fila.className = "reto-admin";

      const texto = document.createElement("div");
      texto.className = "texto-reto";
      texto.textContent = reto.texto;
      fila.appendChild(texto);

      const btnBorrar = document.createElement("button");
      btnBorrar.className = "btn-borrar-admin";
      btnBorrar.textContent = "Eliminar";
      btnBorrar.onclick = async () => {
        if (!confirm(`¿Eliminar el reto "${reto.texto}"? Se borrará también el progreso guardado de este reto para todos.`)) return;
        btnBorrar.disabled = true;
        btnBorrar.textContent = "Eliminando...";
        await borrarReto(reto.id);
        pintarAdmin();
      };
      fila.appendChild(btnBorrar);

      cont.appendChild(fila);
    });
  });
}

// ============================================
// NAVEGACIÓN
// ============================================
function cambiarPestana(pestana) {
  document.getElementById("vista-perfil").classList.toggle("oculto", pestana !== "perfil");
  document.getElementById("vista-clasificacion").classList.toggle("oculto", pestana !== "clasificacion");
  document.getElementById("vista-admin").classList.toggle("oculto", pestana !== "admin");
  document.getElementById("tab-perfil").classList.toggle("activo", pestana === "perfil");
  document.getElementById("tab-clasificacion").classList.toggle("activo", pestana === "clasificacion");
  document.getElementById("tab-admin").classList.toggle("activo", pestana === "admin");
  if (pestana === "clasificacion") pintarClasificacion();
  if (pestana === "admin") pintarAdmin();
}

function cambiarUsuario() {
  localStorage.removeItem("retos_usuario");
  usuarioActual = null;
  document.getElementById("pantalla-app").classList.add("oculto");
  document.getElementById("pantalla-seleccion").classList.remove("oculto");
}

// ============================================
// ARRANQUE
// ============================================
async function mostrarApp() {
  document.getElementById("pantalla-seleccion").classList.add("oculto");
  document.getElementById("pantalla-app").classList.remove("oculto");
  await cargarRetos();
  await cargarProgreso();
  pintarPerfil();
  cambiarPestana("perfil");
}

async function init() {
  // Esto va siempre lo primero: pase lo que pase después, la pantalla de
  // selección de nombre tiene que aparecer.
  pintarSeleccion();

  try {
    document.getElementById("tab-perfil").onclick = () => cambiarPestana("perfil");
    document.getElementById("tab-clasificacion").onclick = () => cambiarPestana("clasificacion");
    document.getElementById("tab-admin").onclick = () => cambiarPestana("admin");
    document.getElementById("btn-cambiar").onclick = cambiarUsuario;

    if (usuarioActual) {
      await mostrarApp();
    }
  } catch (e) {
    console.error("Error inicializando la app:", e);
  }
}

document.addEventListener("DOMContentLoaded", init);
