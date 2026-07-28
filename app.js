// ============================================
// DATOS
// ============================================
const AMIGOS = ["garcia","fer","jaco","ricis","sevi","sergio","isra","samu","pablo","lagu","carlitos"];

const RETOS = [
  // Fáciles - 1 punto
  { id: "f1", categoria: "facil", puntos: 1, texto: "Conseguir 3 o más Instagrams" },
  { id: "f2", categoria: "facil", puntos: 1, texto: "Meterse en medio de una foto" },
  { id: "f3", categoria: "facil", puntos: 1, texto: "Quitarse la camiseta 5 minutos" },

  // Medios - 2 puntos
  { id: "m1", categoria: "medio", puntos: 2, texto: "Hacerle una foto a unas tías y luego enseñarles una foto de unos quesos" },
  { id: "m2", categoria: "medio", puntos: 2, texto: "Subirse a algún sitio (escenario si hay)" },
  { id: "m3", categoria: "medio", puntos: 2, texto: "Hacerse pasar por guiri" },
  { id: "m4", categoria: "medio", puntos: 2, texto: "Hacerse pasar por gay" },
  { id: "m5", categoria: "medio", puntos: 2, texto: "Camelar a una gorda (liarse con ella es opcional)" },
  { id: "m6", categoria: "medio", puntos: 2, texto: "Llevarse mobiliario urbano (conos, por ejemplo)" },
  { id: "m7", categoria: "medio", puntos: 2, texto: "Liarse con una" },

  // Difíciles - 3 puntos
  { id: "d1", categoria: "dificil", puntos: 3, texto: "Conseguirle tía a otro" },
  { id: "d2", categoria: "dificil", puntos: 3, texto: "Conseguir que inviten a una copa (no vale invitar tú antes)" },
  { id: "d3", categoria: "dificil", puntos: 3, texto: "Conseguir after o que se vengan de after" },
  { id: "d4", categoria: "dificil", puntos: 3, texto: "Estar media hora solos por ahí y, si es posible, hacer amigos" },

  // Muy difíciles - 4 puntos
  { id: "md1", categoria: "muydificil", puntos: 4, texto: "Hacer un trío" },
  { id: "md2", categoria: "muydificil", puntos: 4, texto: "Enseñar un cacho de escroto y decir que es chicle pegao" },
];

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
let supabase = null;
let configPendiente = false;

try {
  if (typeof SUPABASE_URL === "undefined" || SUPABASE_URL.includes("TU-PROYECTO")) {
    configPendiente = true;
    console.warn("Falta configurar config.js con tu URL y anon key de Supabase.");
  } else if (!window.supabase) {
    console.error("La librería de Supabase no se ha cargado (revisa tu conexión a internet o el <script> del CDN).");
  } else {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

  if (!supabase) {
    mostrarAvisoConfig();
    return;
  }

  const { data, error } = await supabase.from("progreso").select("amigo, reto").eq("completado", true);
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

async function marcarReto(amigo, retoId, conseguido) {
  if (!supabase) {
    mostrarAvisoConfig();
    return;
  }
  if (conseguido) {
    const { error } = await supabase.from("progreso")
      .upsert({ amigo, reto: retoId, completado: true }, { onConflict: "amigo,reto" });
    if (error) console.error(error);
  } else {
    const { error } = await supabase.from("progreso")
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
  img.src = `fotos/${nombre}.jpg`;
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
// NAVEGACIÓN
// ============================================
function cambiarPestana(pestana) {
  document.getElementById("vista-perfil").classList.toggle("oculto", pestana !== "perfil");
  document.getElementById("vista-clasificacion").classList.toggle("oculto", pestana !== "clasificacion");
  document.getElementById("tab-perfil").classList.toggle("activo", pestana === "perfil");
  document.getElementById("tab-clasificacion").classList.toggle("activo", pestana === "clasificacion");
  if (pestana === "clasificacion") pintarClasificacion();
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
    document.getElementById("btn-cambiar").onclick = cambiarUsuario;

    if (usuarioActual) {
      await mostrarApp();
    }
  } catch (e) {
    console.error("Error inicializando la app:", e);
  }
}

document.addEventListener("DOMContentLoaded", init);
