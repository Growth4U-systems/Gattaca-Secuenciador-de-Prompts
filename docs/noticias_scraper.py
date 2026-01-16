import requests
from bs4 import BeautifulSoup
import trafilatura
import pandas as pd
import time
import re

# -------------------------------
# CONFIGURACIÓN
# -------------------------------
# Lista de empresas a buscar
queries = [
    "Sumup Empresas",
]

# Código de país/mercado para la búsqueda de Bing News.
# Algunos ejemplos:
#   "es-ES" -> Español (España)
#   "es-MX" -> Español (México)
#   "en-US" -> Inglés (Estados Unidos)
#   "en-GB" -> Inglés (Reino Unido)
#   "fr-FR" -> Francés (Francia)
pais_filtro = "es-ES"

# Número máximo de páginas de resultados de Bing News por empresa
max_paginas = 20

# Encabezados para la solicitud HTTP para evitar ser bloqueado
headers = {"User-Agent": "Mozilla/5.0"}

# Lista para almacenar todos los resultados de las noticias
todos_resultados = []

# -------------------------------
# PROCESAMIENTO POR EMPRESA
# -------------------------------
for query in queries:
    print(f"\n🔍 Procesando empresa: {query}")
    # Conjunto para evitar duplicados por URL o título
    vistos = set()

    for pagina in range(max_paginas):
        offset = pagina * 10
        # Codifica la consulta para la URL
        encoded_query = query.replace(' ', '+')
        # URL de búsqueda en Bing News, ahora incluye el filtro de país (setmkt)
        url_busqueda = f"https://www.bing.com/news/search?q={encoded_query}&first={offset}&form=QBNH&setmkt={pais_filtro}"

        print(f"  🔎 Página {pagina + 1}: {url_busqueda}")

        try:
            # Realiza la solicitud HTTP
            res = requests.get(url_busqueda, headers=headers, timeout=10)
            # Analiza el HTML
            soup = BeautifulSoup(res.text, "html.parser")
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Error al obtener la página: {e}")
            continue

        # Selecciona los enlaces a las noticias, que suelen tener la clase 'title'
        articulos = soup.select("a.title")

        if not articulos:
            print("  ⚠️ No hay más resultados en esta página o no se encontraron noticias.")
            break

        for art in articulos:
            titulo = art.get_text(strip=True)
            url = art.get("href")

            # Omite si la URL o el título ya han sido procesados para evitar duplicados
            if url in vistos or titulo in vistos:
                continue
            vistos.add(url)
            vistos.add(titulo)

            print(f"    ➡️ {titulo}")

            # -----------------------------------
            # EXTRACCIÓN DE CONTENIDO Y FECHA
            # -----------------------------------
            try:
                # Descarga el HTML de la noticia
                raw_html = trafilatura.fetch_url(url)
                if raw_html:
                    # Extrae el contenido principal del artículo
                    contenido = trafilatura.extract(raw_html)
                    
                    # Extrae los metadatos para obtener la fecha de publicación
                    metadata = trafilatura.extract_metadata(raw_html)
                    fecha = metadata.date if metadata and metadata.date else None
                else:
                    contenido = None
                    fecha = None

            except Exception as e:
                print(f"    ❌ Error extrayendo contenido y fecha de {url}: {e}")
                contenido = None
                fecha = None

            # Agrega los resultados a la lista
            todos_resultados.append({
                "empresa": query,
                "titulo": titulo,
                "url": url,
                "contenido": contenido if contenido else "No extraído",
                "fecha_publicacion": fecha if fecha else "No extraída",
                "pais": pais_filtro  # Agrega el país al resultado
            })

            # Pausa de 1 segundo para evitar ser bloqueado por el servidor
            time.sleep(1)

# -------------------------------
# GUARDAR RESULTADOS
# -------------------------------
df = pd.DataFrame(todos_resultados)
# Guarda el DataFrame en un archivo CSV
df.to_csv("noticias_empresas_unificado.csv", index=False, encoding="utf-8-sig")
print(f"\n✅ Guardado completo: {len(df)} artículos en 'noticias_empresas_unificado.csv'")
