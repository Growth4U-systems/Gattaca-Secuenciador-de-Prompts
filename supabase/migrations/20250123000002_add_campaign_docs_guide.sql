-- Add campaign_docs_guide field to projects table
-- This field contains instructions for users about what additional documents
-- they need to generate/upload for each campaign

ALTER TABLE projects
ADD COLUMN campaign_docs_guide TEXT DEFAULT 'Para cada campaña, considera subir los siguientes documentos específicos:

1. **Análisis de competidores específicos del ECP**: Investiga cómo los competidores abordan este problema específico.

2. **Research de mercado del segmento**: Datos y estadísticas específicas del segmento objetivo de la campaña.

3. **Casos de uso específicos**: Ejemplos o testimonios relevantes para este ECP particular.

4. **Materiales de producto relevantes**: Características o beneficios del producto que aplican especialmente a este ECP.';

COMMENT ON COLUMN projects.campaign_docs_guide IS 'Markdown instructions for users about what documents to upload for each campaign';
