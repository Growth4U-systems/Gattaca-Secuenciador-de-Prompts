### LinkedIn Signal‑Based Outreach + Lead Magnet

Documento maestro con 3 versiones: Interno (Mode 10), Cliente y One‑pager.

---

## 1. PRD INTERNO (MODE 10 – COMPLETO)

### Portada / Metadatos

- **Título:** LinkedIn Signal‑Based Outreach + Lead Magnet (Playbook + Sistema)
- **Tipo:** PRD interno Growth4U (Mode 10 – Stephen Pope Framework)
- **Versión:** v1
- **Owner:** Growth4U (Martin)
- **Fecha:** 2026‑01‑17

---

### 0. Quick Start Snapshot (Stephen Pope)

**Project**  

LinkedIn Signal‑Based Outreach + Lead Magnet PRD

**Why**  

Subir el **% de respuestas positivas** en campañas LinkedIn usando señales de intención (reacciones a posts virales) + lead magnet relevante, y convertirlo en un **playbook y sistema productizable** para Growth4U y clientes.

**Wow factors**

- Encontrar y evaluar posts potentes con una **checklist clara**, no por intuición vaga.
- Scrappear **200–1.000 leads** por campaña con contexto: post origen, tipo de interacción, comentario.
- Filtrar ICP en una **BBDD operable** (Notion/CSV) con mensajes personalizados + lead magnet ya listos.
- Flujo compatible con **Apify / Phantombuster vía API** sin desarrollo pesado a medida.

**Deal Breakers**

- Scraping de LinkedIn no viable/estable en el volumen objetivo.
- Posts virales que no concentran buen ICP (mucha señal ruido).
- Lead magnet sin impacto en % de respuestas.
- Fricción técnica que haga que nadie quiera operar el flujo de forma recurrente.

**Outcome principal**  

Demostrar en 1–2 campañas que se puede montar el flujo completo (posts → leads ICP → mensajes + lead magnet → outreach) con fricción aceptable y con un **uplift claro en % de respuestas positivas** frente a campañas normales.

---

### 1. Contexto y problema (What should you build?)

Hoy:

- Las campañas LinkedIn se basan en **filtros estáticos** (cargo, sector, localización) y mensajes fríos genéricos.
- Hay mucho trabajo manual:
    - Buscar posts e ideas.
    - Montar listas en Excel / Sales Navigator.
    - Redactar mensajes uno por uno.

Resultado: baja tasa de respuesta y poca claridad de qué parte del sistema funciona.

Lo que queremos construir:

- Un **sistema y playbook** que:
    1. **Encuentre posts de LinkedIn** relevantes y con tracción (virales, mínimo +40 interacciones).
    2. **Scrapee los perfiles** de quienes reaccionan/comentan (señales de intención).
    3. Permita **filtrar por ICP** (Growth Managers, Heads of Growth, y variantes).
    4. Genere **mensajes personalizados** que usan:
        - El post como contexto compartido.
        - La reacción/comentario del lead como hook.
        - Un **lead magnet** fuerte como primer gesto de buena voluntad.
    5. Entregue un **output plug & play**:
        - Tabla en Notion y/o CSV lista para importar en herramienta de outreach.

---

### 2. Valor y resultados esperados (What value will this generate?)

**Para Growth4U (interno):**

- Aumentar el **% de respuestas positivas** en campañas LinkedIn.
- Reducir el tiempo para montar campañas:
    - De varios días manuales a **≈1 día de trabajo estructurado** para 200–1.000 leads.
- Estandarizar el enfoque en un **playbook replicable** para clientes (producto/servicio).

**Señales de valor:**

- Comparar campañas A/B:
    - Outreach tradicional vs outreach signal‑based + lead magnet.
- Ver mejora en:
    - % respuestas totales.
    - % respuestas positivas (interés real).
    - Nº de oportunidades / reuniones generadas por 100 leads.

---

### 3. Wow factors

1. **Descubrimiento estructurado de posts:**  
    - Playbook con:
        - Búsqueda por hashtags, keywords, autores.
        - Checklist de calidad: encaje temático, tracción, calidad de conversación, relevancia del autor.
    - Posibilidad de usar Apify/Phantombuster para un feed de posts candidatos.
2. **Pipeline de leads con contexto rico:**  
    - De 3–10 posts semilla → 200–1.000 leads.
    - Por lead:
        - URL perfil, cargo, empresa, localización.
        - Tipo de interacción (like, comentario, repost).
        - Texto del comentario, si existe.
        - Post origen y campaña asociada.
3. **Mensajes personalizados a escala:**  
    - Mensajes que mencionan:
        - El post.
        - El tipo de reacción / contenido del comentario.
        - El lead magnet y su beneficio.
    - Variantes auto‑generadas y luego revisadas por humano.
4. **Lead magnet integrado desde el primer toque:**  
    - No se pide call fría.
    - Se ofrece un recurso útil (Notion page, PDF, checklist) directamente en el primer mensaje.
5. **Output listo para herramienta de outreach:**  
    - BBDD limpia que se exporta a CSV / se usa en Notion.
    - Campos ya pensados para mapeo con outreach tools.

---

### 4. Deal Breakers & aprendizaje previo

**DB1 – Estabilidad scraping (Apify/Phantombuster)**  

[Supuesto] Se puede scrapear posts y reacciones dentro de límites razonables sin bloqueos fuertes.

- [Pendiente validar] Probar actors con 2–3 posts (200–500 reacciones):
    - Medir velocidad, errores, bloqueos/captchas.

**DB2 – Posts virales ↔ ICP aprovechable**  

[Supuesto] Si elegimos bien tema y autor, la audiencia se parece al ICP.

- [Pendiente validar]
    - 1 campaña piloto:
        - 3–5 posts con checklist.
        - Medir % leads marcados “Dentro de ICP”.

**DB3 – Potencia del lead magnet**  

[Supuesto] Un buen lead magnet mejora visiblemente el % de respuesta.

- [Pendiente validar]
    - Test simple:
        - Segmento A: mensaje con lead magnet.
        - Segmento B: mensaje similar sin lead magnet.
    - Medir uplift.

**DB4 – Fricción operativa**  

[Supuesto] Flujo operable en 1 día/campaña sin quemar al operador.

- [Pendiente validar]
    - Ejecutar flujo completo 1–2 veces midiendo:
        - Tiempo por etapa.
        - Cuellos de botella.

---

### 5. Triggers & Steps (visión de flujo)

**Triggers principales**

1. Nueva campaña LinkedIn decidida.
2. Tema + ICP definidos.
3. Post candidato identificado.
4. Post aprobado tras checklist.
5. Leads filtrados por ICP → listos para outreach.

#### Flujo MVP

1. **Definir campaña (BBDD Campañas)**  
    - Cliente/vertical.
    - ICP (Growth managers / Heads of Growth).
    - B2C/B2B.
    - Objetivo % respuesta.
    - Tipo lead magnet (Notion/PDF/checklist).
2. **Descubrir posts**  
    - Búsqueda manual:
        - Hashtags, keywords, autores.
    - Opcional: actor Apify/Phantombuster (posts por hashtag/autor).
    - Registrar candidatos en “Posts”:
        - URL, autor, tema, texto abreviado.
3. **Evaluar y aprobar posts**  
    - Obtener métricas:
        - Nº reacciones, nº comentarios (actor o manual MVP).
    - Aplicar checklist:
        - Encaje temático (1–5).
        - Calidad conversación (1–5).
        - Relevancia autor (1–5).
    - Verificar **≥ 40 interacciones**.
    - Marcar `Aprobado = Sí` para 3–10 posts semilla.
4. **Scrapear reacciones → leads brutos**  
    - Correr actor por post aprobado.
    - Output: CSV/JSON con perfiles que reaccionan/comentan.
    - Importar a “Leads”:
        - Nombre, URL, cargo, empresa, ubicación.
        - Tipo interacción.
        - Texto comentario.
        - Post origen, campaña.
5. **Filtrar por ICP**  
    - Filtrar por cargo, industria, país, tamaño empresa (B2B).
    - Marcar:
        - `Dentro de ICP / Dudoso / Fuera`.
    - Mantener 200–1.000 leads finales/campaña.
6. **Definir y preparar lead magnet**  
    - Elegir formato:
        - Notion page / PDF / checklist.
    - Generar estructura + borrador (con IA).
    - Publicar link para la campaña.
7. **Generar mensajes personalizados**  
    - Inputs por lead:
        - Texto post.
            - Tipo interacción / comentario.
            - Cargo/empresa.
            - Lead magnet (tipo + beneficio).
    - Generar 1–2 borradores:
        1. Referencia al post.
        2. Conexión con rol/problema.
        3. Entrega de lead magnet.
        4. CTA suave.
    - Operador revisa y fija mensaje final.
8. **Exportar a herramienta de outreach**  
    - Exportar leads `Dentro de ICP` + mensaje final:
        - CSV o uso directo desde Notion.
    - Mapear campos y lanzar secuencias (fuera scope técnico).