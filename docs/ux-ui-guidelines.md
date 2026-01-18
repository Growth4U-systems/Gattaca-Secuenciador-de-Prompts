# UX/UI Guidelines - Gattaca

Este documento define las reglas y patrones de diseño para mantener consistencia en toda la aplicación.

---

## Colores de Texto

### Regla Principal: Texto Oscuro en Campos de Entrada

**SIEMPRE** usar `text-gray-900` en campos de entrada para garantizar legibilidad.

```typescript
// CORRECTO
className="bg-white text-gray-900 border border-gray-300 ..."

// INCORRECTO - El texto puede verse blanco en algunos temas
className="border border-gray-300 ..." // Sin text-gray-900
```

### Fondos de Campos de Entrada

**SIEMPRE** especificar `bg-white` explícitamente en inputs, textareas y selects.

```typescript
// CORRECTO
<input className="bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2 ..." />

// INCORRECTO
<input className="border border-gray-300 rounded-lg px-4 py-2 ..." />
```

---

## Campos de Formulario

### Input de Texto Estándar

```typescript
<input
  type="text"
  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
```

### Textarea Estándar

```typescript
<textarea
  rows={3}
  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
```

### Select Estándar

```typescript
<select
  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
>
  <option value="...">...</option>
</select>
```

### Textarea para Código/Mono

```typescript
<textarea
  className="w-full h-64 p-3 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
```

---

## Labels

```typescript
<label className="block text-sm font-medium text-gray-700 mb-1">
  Nombre del campo
  {required && <span className="text-red-500 ml-1">*</span>}
</label>
```

---

## Botones

### Botón Primario

```typescript
<button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
  <Icon size={16} />
  Texto del botón
</button>
```

### Botón Secundario

```typescript
<button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
  <Icon size={16} />
  Texto del botón
</button>
```

### Botón Outline/Ghost

```typescript
<button className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
  <Icon size={14} />
  Texto
</button>
```

---

## Mensajes de Error

```typescript
<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
  {errorMessage}
</div>
```

---

## Mensajes de Éxito

```typescript
<div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
  {successMessage}
</div>
```

---

## Cards/Contenedores

### Card Básica

```typescript
<div className="bg-white rounded-lg border border-gray-200 p-4">
  {content}
</div>
```

### Card con Header

```typescript
<div className="border border-gray-200 rounded-lg overflow-hidden">
  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
    <h3 className="font-medium text-gray-900">Título</h3>
  </div>
  <div className="p-4">
    {content}
  </div>
</div>
```

---

## Modales

```typescript
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">Título</h2>
      <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
        <X size={20} />
      </button>
    </div>

    {/* Content */}
    <div className="p-6 overflow-y-auto max-h-[60vh]">
      {content}
    </div>

    {/* Footer */}
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
      {actions}
    </div>
  </div>
</div>
```

---

## Dropdowns

```typescript
<div className="relative">
  <button
    onClick={() => setOpen(!open)}
    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ..."
  >
    {label}
    <ChevronDown size={16} />
  </button>

  {open && (
    <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => select(item)}
          className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50"
        >
          {item.label}
        </button>
      ))}
    </div>
  )}
</div>
```

---

## Badges/Tags

### Status Badge

```typescript
// Success
<span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
  Completado
</span>

// Warning
<span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
  En progreso
</span>

// Error
<span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
  Error
</span>

// Info
<span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
  Info
</span>

// Neutral
<span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
  Pendiente
</span>
```

---

## Iconos

Usamos **Lucide React** para todos los iconos.

```typescript
import { Settings, ChevronDown, Plus, Folder, X, Check } from 'lucide-react'

// Tamaños estándar
<Icon size={14} />  // Pequeño (en botones compactos)
<Icon size={16} />  // Normal (en botones, inline)
<Icon size={20} />  // Mediano (en headers)
<Icon size={24} />  // Grande (standalone)
```

---

## Espaciado

### Gaps Estándar

- `gap-1` (4px) - Elementos muy cercanos
- `gap-2` (8px) - Elementos en grupo
- `gap-3` (12px) - Elementos relacionados
- `gap-4` (16px) - Secciones dentro de un contenedor
- `gap-6` (24px) - Secciones principales

### Padding Estándar

- `p-2` / `px-2 py-1` - Botones compactos
- `p-3` / `px-3 py-2` - Elementos pequeños
- `p-4` / `px-4 py-2` - Elementos normales
- `p-6` - Contenedores principales

---

## Tipografía

### Títulos

```typescript
<h2 className="text-lg font-semibold text-gray-900">Título Principal</h2>
<h3 className="text-base font-medium text-gray-900">Subtítulo</h3>
<h4 className="text-sm font-medium text-gray-700">Título Pequeño</h4>
```

### Texto

```typescript
<p className="text-sm text-gray-600">Texto normal</p>
<p className="text-xs text-gray-500">Texto pequeño/secundario</p>
<p className="text-xs text-gray-400">Texto muy secundario</p>
```

---

## Checklist para Nuevos Componentes

Antes de hacer PR, verificar:

- [ ] Todos los inputs tienen `bg-white text-gray-900`
- [ ] Labels usan `text-gray-700`
- [ ] Botones primarios usan `bg-blue-600 text-white`
- [ ] Iconos usan tamaños consistentes (16px default)
- [ ] Modales tienen z-50 y overlay con `bg-black/50`
- [ ] Dropdowns tienen `z-50` para estar sobre otros elementos
- [ ] Focus states usan `focus:ring-2 focus:ring-blue-500`

---

**Última actualización**: 2026-01-18
