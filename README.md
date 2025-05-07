# getNearbyPlaces

Appwrite Function: Devuelve hasta 100 lugares cercanos de la colección `place` de la base de datos `places` según latitud, longitud y nivel de zoom.

## Descripción
Esta función recibe un objeto con `latitude`, `longitude` y `zoom`, y retorna un array de lugares dentro de un radio calculado en base al zoom. Si el zoom es menor a 10, no devuelve resultados.

- Valida los parámetros de entrada.
- Convierte el zoom a un radio geográfico aproximado.
- Calcula la distancia usando la fórmula de Haversine.
- Filtra y limita los resultados a 100 documentos.

## Uso
La función está diseñada para ejecutarse como función serverless en Appwrite Functions.

## Estructura esperada de la colección `place`
Ver archivo `src/index.ts` para detalles del modelo. 