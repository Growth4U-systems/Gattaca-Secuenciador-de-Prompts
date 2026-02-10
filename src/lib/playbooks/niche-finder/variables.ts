export interface PlaybookInputVariable {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean'
  required: boolean
  defaultValue?: string
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  description?: string
}

export const INPUT_VARIABLES: PlaybookInputVariable[] = [
  {
    name: 'company_name',
    label: 'Nombre de la Empresa',
    type: 'text',
    required: true,
    placeholder: 'Ej: N26, Revolut, Stripe...',
    description: 'Nombre de la empresa a investigar',
  },
  {
    name: 'country',
    label: 'Pa\u00eds',
    type: 'select',
    required: true,
    defaultValue: 'Espa\u00f1a',
    options: [
      { label: 'Espa\u00f1a', value: 'Espa\u00f1a' },
      { label: 'M\u00e9xico', value: 'M\u00e9xico' },
      { label: 'Argentina', value: 'Argentina' },
      { label: 'Colombia', value: 'Colombia' },
      { label: 'Chile', value: 'Chile' },
      { label: 'Per\u00fa', value: 'Per\u00fa' },
    ],
  },
  {
    name: 'context_type',
    label: 'Tipo de Cliente',
    type: 'select',
    required: true,
    defaultValue: 'both',
    options: [
      { label: 'B2C (consumidor final)', value: 'personal' },
      { label: 'B2B (empresas)', value: 'business' },
      { label: 'Ambos (B2C + B2B)', value: 'both' },
    ],
  },
  {
    name: 'product_docs_summary',
    label: 'Resumen del Producto',
    type: 'textarea',
    required: false,
    placeholder: 'Descripci\u00f3n del producto/servicio (opcional, mejora la estrategia)',
    description: 'Si lo proporcionas, la estrategia ser\u00e1 m\u00e1s precisa',
  },
]

export const VARIABLE_GROUPS = {
  required: {
    label: 'Informaci\u00f3n Requerida',
    variables: ['company_name', 'country', 'context_type'],
  },
  optional: {
    label: 'Contexto Adicional (Opcional)',
    variables: ['product_docs_summary'],
  },
}
