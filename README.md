# Estación de Ensamble MDF · Vista 3D

Visualización 3D interactiva de una estación de ensamble asistida construida en MDF. Permite explorar todos los componentes de la estación desde diferentes ángulos con controles de cámara orbital.

## Componentes de la estación

| # | Componente | Descripción |
|---|---|---|
| — | **Mesa MDF** | Superficie de trabajo con entrepaño inferior |
| — | **Pórtico** | Estructura vertical con viga superior |
| — | **Bins (1–8)** | 8 bandejas con sensores para piezas del ensamble |
| — | **Nido** | Área central de ensamble sobre la mesa |
| — | **Cámara** | Montada en brazo MDF sobre el nido |
| — | **Monitor** | Pantalla principal con vista en vivo |
| — | **Tablet** | HMI en poste flexible al lado del ESP32 |
| — | **ESP32** | Controlador con antena WiFi |
| — | **CPU** | PC de escritorio en el entrepaño inferior |
| — | **RFID** | Lector para identificación de operador/pieza |
| — | **Andon** | Franja LED en la viga (verde/ámbar/rojo) + buzzer |
| — | **Fuente 5V** | Alimentación en el entrepaño inferior |

## Controles

| Acción | Control |
|---|---|
| Rotar vista | Arrastrar con mouse / touch |
| Pan | Shift + arrastrar / click derecho |
| Zoom | Scroll / pinch |
| Vista isométrica | Tecla **F** |
| Vistas predefinidas | Botones: General, Trabajo, Pantallas, Bajo mesa, Arriba |

## Estructura de archivos

```
├── index.html      ← HTML (estructura)
├── style.css       ← Estilos
├── app.js          ← Lógica 3D (Three.js)
├── config.json     ← Labels, colores y textos editables
└── README.md
```

## Configuración

Edita [`config.json`](config.json) para personalizar:

- **`labels`** — Nombres de cada componente (etiquetas 3D)
- **`bins`** — Nombres de las 8 piezas del ensamble
- **`monitorTexts`** / **`tabletTexts`** — Textos en las pantallas
- **`colors`** — Paleta de colores de los materiales

## Tecnologías

- [Three.js](https://threejs.org/) r128 (CDN)
- HTML5 Canvas para texturas de pantallas
- CSS puro, sin frameworks
