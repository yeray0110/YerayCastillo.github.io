Coloca aqui Biblias completas como:

- `es.json`
- `en.json`

Formato recomendado:

```json
{
  "books": {
    "Juan": {
      "label": "Juan",
      "testament": "Nuevo Testamento",
      "chapters": {
        "3": {
          "16": "Texto del versiculo..."
        }
      }
    }
  }
}
```

Tambien funciona este formato simple:

```json
{
  "Juan": {
    "3": {
      "16": "Texto del versiculo..."
    }
  }
}
```
