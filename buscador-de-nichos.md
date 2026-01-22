## Sistema Buscador de Nichos 100x en Foros

> "El nicho más rentable no es el más grande, sino el que presenta la mayor brecha de rendimiento viable."[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)
> 

Este documento explica, de forma operativa, cómo funciona el sistema **Buscador de Nichos 100x en Foros**, qué problema resuelve, cómo se alimenta, qué pasos sigue y qué outputs genera, además de cómo se está integrando en **Gattaca**.

---

### 1. Objetivo del sistema

El Buscador de Nichos 100x en Foros es un sistema diseñado para:

- Identificar **nichos de mercado con alto dolor y alto encaje** a partir de conversaciones reales en foros y comunidades.
- Reducir el riesgo de mercado pasando de miles de posibles combinaciones de nichos a un **conjunto pequeño y priorizado** (por ejemplo, de 10.000 opciones a 3 nichos viables).[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)
- Entregar una **Matriz de Nichos** lista para usar en GTM, contenido, outbound y priorización de producto.

Se apoya en tres marcos:

- **Jobs To Be Done (JTBD):** entender el “trabajo” que la persona intenta lograr.
- **Pain Point Marketing (PPM):** intensidad y tipo de dolor que empuja a buscar solución.
- **Gap Analysis:** medir la brecha entre el estado actual del mercado y el resultado deseado.[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)

---

### 2. Inputs del sistema

#### 2.1. Capacidades internas y contexto

Antes de lanzar el sistema se definen:

- **Capacidades de Solución (CS)** de Growth4U / del cliente (ej. optimizar CAC, escalar usuarios sin paid, mejorar activación).
- **Etapas o contextos clave** (p. ej. lanzamiento de negocio, expansión a nuevo país, post‑ronda, cambio regulatorio).[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)

Con esto se genera una **Matriz de Búsqueda** (CS × contexto) que se traduce en combinaciones de keywords que el sistema usará para rastrear foros.

#### 2.2. Fuentes de datos

Las fuentes principales son:

- **Reddit** (subreddits relevantes para el ICP).
- Otros foros, comunidades y plataformas UGC según el caso.
- En versiones posteriores, se puede complementar con G2, reseñas, redes sociales, etc.[[2]](https://www.notion.so/Definir-que-Scrapers-vamos-a-usar-2125dacf4f148023ac18e32123088175?pvs=21)

#### 2.3. Herramientas técnicas

El sistema usa (según diseño actual del sistema):

- **n8n** como orquestador de flujos.
- **Scrapers / APIs**: RedditAPI, SERPAPI, Firecrawl, etc.[[3]](https://www.notion.so/Buscador-de-Nichos-100x-en-Foros-2835dacf4f148075957dc000b523a040?pvs=21)[[2]](https://www.notion.so/Definir-que-Scrapers-vamos-a-usar-2125dacf4f148023ac18e32123088175?pvs=21)
- **LLMs vía OpenRouter u otros proveedores** para el Motor de Razonamiento.
- **Google Sheets / CSV + Notion / Gattaca** como capas de almacenamiento y visualización.[[3]](https://www.notion.so/Buscador-de-Nichos-100x-en-Foros-2835dacf4f148075957dc000b523a040?pvs=21)

---

### 3. Flujo operativo paso a paso

#### 3.1. Fase 0 – Diseño de la búsqueda

1. Definir **ICP** y objetivos del proyecto (ej. fintech B2B, fase Serie A, foco en reducir CAC sin Meta Ads).[[4]](https://www.notion.so/Framework-para-encontrar-27-nichos-en-60-d-as-3e323113f5c74eb485e28d69c62af6a6?pvs=21)
2. Mapear **Capacidades de Solución** y **Etapas / triggers** (lanzamiento país, post‑ronda, cambio regulatorio, etc.).
3. Generar la **Matriz de Búsqueda** con combinaciones de keywords para rastrear foros.

Esta fase puede apoyarse en prompts específicos que sugerirán keywords y foros según si el caso es B2B o B2C.[[5]](https://www.notion.so/Crear-prompt-KWs-y-foros-en-Buscador-de-Nichos-2925dacf4f1480f8ad43d3c57b9273af?pvs=21)

#### 3.2. Fase 1 – Rastreo y acopio (n8n + scrapers)

1. El flujo en **n8n** itera sobre cada combinación de la Matriz de Búsqueda.
2. Para cada combinación ejecuta llamadas HTTP a APIs de foros (ej. Reddit) y scrapers configurados.
3. Recupera títulos, texto y metadatos de hilos y comentarios relevantes.
4. Consolida todo en una **Variable de Contexto (VC)** que alimenta al Motor de Razonamiento.[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)

Resultado: un dataset bruto de conversaciones reales etiquetado por keyword / contexto.

#### 3.3. Fase 2 – Deep Research automatizado (Motor de Razonamiento)

Sobre cada bloque de conversaciones, el modelo aplica una lógica en dos pasos:[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)

1. **Extracción JTBD / Pain:**
    - Identifica el **Problema Puro** (qué está intentando lograr la persona y dónde falla).
    - Extrae **citas de evidencia** representativas del dolor (en palabras literales del usuario).
2. **Clasificación y scoring preliminar:**
    - Asigna una **Intensidad del Dolor (1‑10)**.
    - Mide el **% de Alineación** con las capacidades de la solución (qué bien podemos resolver ese problema).

Este proceso se repite para cada posible nicho implícito en los datos.

#### 3.4. Fase 3 – Construcción de la Matriz de Nichos

Con los resultados del Motor de Razonamiento se genera una tabla estructurada para cada nicho, típica con campos como:[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)

- Nombre / descripción del **nicho**.
- **Problema Puro** en 1–2 frases.
- Citas de evidencia (fragmentos de foros).
- **Dolor** (1–10).
- **Alineación / encaje solución** (0–100%).
- Otros factores: tamaño de mercado, reachability, willingness to pay, etc. (según versión).

Esta tabla puede vivir en:

- Una hoja de cálculo.
- Una base en Notion.
- El **Visualizador de Nichos** / tooling de cliente (ej. Excalibur, Monzo niche explorer).[[6]](https://docs.google.com/spreadsheets/d/1ru-O5vc89S2VJRB0SHDm3evLiltL-zNqQUPuEhSKvIw#gid=0)

#### 3.5. Fase 4 – Niche Score y priorización

Sobre la Matriz de Nichos se calcula un **Niche Score** que combina:[[4]](https://www.notion.so/Framework-para-encontrar-27-nichos-en-60-d-as-3e323113f5c74eb485e28d69c62af6a6?pvs=21)[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)

- Dolor (con peso mayor).
- Tamaño del nicho.
- Reachability (qué fácil es llegar a ese público).
- Willingness to pay.
- Fair chance / moat (probabilidad real de ganar en ese nicho).

La fórmula concreta puede variar, pero un ejemplo conceptual es:

> Niche Score = (Dolor × 2) + Tamaño + Reachability + (WTP × 1,5) + (Fair Chance × 1,5)
> 

Con este score se clasifican los nichos en:

- **Tier A** (apuestas serias, p. ej. ≥28 puntos).
- **Tier B** (laboratorio / explorar más, p. ej. 20–27 puntos).
- **Descartar o aparcar** (por debajo de umbral).[[7]](^https://www.notion.so/3e323113f5c74eb485e28d69c62af6a6)

#### 3.6. Fase 5 – Validación y decisión

Una vez priorizados los nichos:

- Se diseñan **micro‑tests** de validación (mensajes, canales, ofertas) sin depender de paid.[[4]](https://www.notion.so/Framework-para-encontrar-27-nichos-en-60-d-as-3e323113f5c74eb485e28d69c62af6a6?pvs=21)[[8]](https://www.notion.so/Playbook-De-foros-a-nichos-rentables-en-14-d-as-Reddit-G2-comunidades-bdc9206a92404a94ad45de750c424b24?pvs=21)
- Se miden métricas simples (reply rate, leads cualificados, demos, etc.).
- Se acota el foco a **2–3 nichos core** donde los números y el ajuste narrativo son claros.[[4]](https://www.notion.so/Framework-para-encontrar-27-nichos-en-60-d-as-3e323113f5c74eb485e28d69c62af6a6?pvs=21)

La salida final de esta fase alimenta:

- Posicionamiento y mensajes (ECP positioning, USP/UVP, etc.).[[9]](https://www.notion.so/ECP-Add-Size-Pain-Reachability-step-3-2885dacf4f14808fbc0fe5087bebcc83?pvs=21)[[10]](https://growth4ugrupo.slack.com/archives/C08U2LYJK38/p1768409477835559?cid=C08U2LYJK38&thread_ts=1768342887.714739)
- Playbooks de outbound (Signal‑Based Outreach, etc.).[[11]](https://www.notion.so/Gatacca-Orquestador-de-playbooks-2b75dacf4f14809680b6fb79e494d3f5?pvs=21)
- Estrategia de contenido por nicho.[[4]](https://www.notion.so/Framework-para-encontrar-27-nichos-en-60-d-as-3e323113f5c74eb485e28d69c62af6a6?pvs=21)[[12]](https://www.notion.so/C-mo-encontramos-27-nichos-de-clientes-en-2-meses-3b700637788045c9b7ca77c9a0117d28?pvs=21)

---

### 4. Casos de uso y aplicaciones

#### 4.1. Estrategia GTM y Trust Engine

El sistema se utiliza como parte de la **Fase 0 GTM** y del análisis de competidores para:

- Encontrar **nichos de oportunidad** donde la propuesta del cliente es 10x mejor.
- Definir el **“dónde” (nicho)** y el **“cómo” (mensaje)** antes de construir motores de crecimiento (Trust Engine + outbound).[[13]](https://growth4ugrupo.slack.com/archives/C0A21DQ4918/p1768226657479319?cid=C0A21DQ4918&thread_ts=1768217628.050049)[[14]](https://www.notion.so/Eleva-tus-ads-growth4u-2ed5dacf4f1480a98fd7f4ff08549c9f?pvs=21)

#### 4.2. Monzo / Visualizador de Nichos

En proyectos como Monzo, los outputs del buscador de nichos alimentan:

- Una **app de exploración de nichos** con fichas por segmento (p. ej. "Flatmates Managing Shared Bills", "Accidental Landlords", etc.).[[6]](https://docs.google.com/spreadsheets/d/1ru-O5vc89S2VJRB0SHDm3evLiltL-zNqQUPuEhSKvIw#gid=0)
- Tablas de **ECP positioning** para cada nicho, que luego se sincronizan con herramientas internas (Excalibur, Notion, etc.).[[10]](https://growth4ugrupo.slack.com/archives/C08U2LYJK38/p1768409477835559?cid=C08U2LYJK38&thread_ts=1768342887.714739)

#### 4.3. Framework “27 nichos en 60 días”

El playbook de **“20–30 nichos en 60 días”** reusa este sistema como columna vertebral:

- Fase 1: recolectar señales internas + scraping cualitativo (Reddit, comunidades).
- Fase 2: expandir lista de nichos.
- Fase 3–4: filtrar con 3‑Filter Framework (Pay, Moat, Priority) y puntuar con Niche Score.
- Fase 5–6: validar y decidir 2–3 apuestas serias.[[4]](https://www.notion.so/Framework-para-encontrar-27-nichos-en-60-d-as-3e323113f5c74eb485e28d69c62af6a6?pvs=21)[[15]](https://www.notion.so/Fintech-Espa-a-El-m-todo-de-los-100-nichos-C-mo-captamos-5-000-usuarios-sin-1-en-Ads-2f05dacf4f1480eb998bf8facaeda4e1?pvs=21)[[16]](https://www.notion.so/Es-posible-escalar-una-Fintech-sin-Meta-Ads-El-algoritmo-de-los-100-nichos-2ce5dacf4f1480f3a67ee1eebc2e39c3?pvs=21)

---

### 5. Integración con Gattaca

El Buscador de Nichos no se queda en documentación; se está convirtiendo en un **playbook dentro de Gattaca**:[[11]](https://www.notion.so/Gatacca-Orquestador-de-playbooks-2b75dacf4f14809680b6fb79e494d3f5?pvs=21)[[17]](https://www.notion.so/Pasar-Buscador-Nichos-a-Gattaca-2b25dacf4f1480d5bc79e4384bef1927?pvs=21)[[18]](https://growth4ugrupo.slack.com/archives/D08HRRNUP8U/p1768525731069919)

1. **Playbook “Niche Finder” en Gattaca**
    - Gattaca actúa como **orquestador de prompts y scrapers**.
    - El Niche Finder ya existe como playbook junto con otros (ECP, Competitor Analysis, Signal‑Based Outreach).[[11]](https://www.notion.so/Gatacca-Orquestador-de-playbooks-2b75dacf4f14809680b6fb79e494d3f5?pvs=21)
2. **Conexión con scrapers**
    - Desde Gattaca se lanzan scrapers (Reddit, redes, etc.) que antes vivían como sistemas separados.
    - Los resultados se guardan en el **Context Lake** para trazabilidad y reuso.[[11]](https://www.notion.so/Gatacca-Orquestador-de-playbooks-2b75dacf4f14809680b6fb79e494d3f5?pvs=21)[[19]](https://www.notion.so/G4U-Weekly-2c45dacf4f148022a79af01974425284?pvs=21)
3. **Outputs conectados a otros playbooks**
    - Los nichos priorizados sirven de input directo para:
        - ECP Positioning (profundizar en mensaje, objeciones, pruebas).
        - Signal‑Based Outreach (diseñar campañas por nicho y trigger).
        - Visualizador de Nichos / herramientas de cliente.
4. **Estado actual**
    - El sistema está en **estadío “Prototipo Martin”**, con prioridad de desarrollo alta y próximo paso explícito: “Pasar a prototipo interno G4U” y **convertirlo en playbook dentro de Gattaca**.[[3]](https://www.notion.so/Buscador-de-Nichos-100x-en-Foros-2835dacf4f148075957dc000b523a040?pvs=21)[[17]](https://www.notion.so/Pasar-Buscador-Nichos-a-Gattaca-2b25dacf4f1480d5bc79e4384bef1927?pvs=21)[[20]](https://growth4ugrupo.slack.com/archives/D08HRRNUP8U/p1768289143568169)

---

### 6. Resumen ejecutivo

- El **Buscador de Nichos 100x en Foros** es un sistema para transformar conversaciones caóticas (Reddit, foros, comunidades) en una lista priorizada de nichos con **Niche Score**.
- Combina **JTBD + Pain Point Marketing + Gap Analysis** para puntuar cada nicho por dolor, encaje, tamaño y probabilidad de ganar.[[1]](https://www.notion.so/SOP-Buscador-100x-Niches-en-Foros-2865dacf4f148003a8bde9729bb1db79?pvs=21)
- La salida alimenta GTM, Trust Engine, contenido, outbound y decisiones de producto.
- Actualmente se está integrando como **playbook “Niche Finder” dentro de Gattaca**, con scrapers conectados y uso en proyectos reales (ej. Monzo).[[11]](https://www.notion.so/Gatacca-Orquestador-de-playbooks-2b75dacf4f14809680b6fb79e494d3f5?pvs=21)[[18]](https://growth4ugrupo.slack.com/archives/D08HRRNUP8U/p1768525731069919)

Este documento sirve como **pieza central de referencia** para cualquiera que necesite entender el sistema (equipo interno, desarrollo de Gattaca, clientes) sin leer todos los SOPs y notas técnicas originales.