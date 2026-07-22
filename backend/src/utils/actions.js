export const ACTIONS = [
  // TRANSPORTE
  { id: 't01', area: 'transport', co2Reduction: 230,  label: 'Tomo el tren en lugar del avión para una escapada de fin de semana',              description: 'Ejemplo: Madrid–Santiago de Compostela.' },
  { id: 't02', area: 'transport', co2Reduction: 1000, label: 'Cambio las vacaciones a las Islas por Cantabria, y el avión por el coche, viajamos al menos dos.',            description: 'Elijo destino nacional y comparto el trayecto.' },
  { id: 't03', area: 'transport', co2Reduction: 250,  label: 'Tomo el autobús en lugar del coche para mis desplazamientos diarios',              description: 'El autobús urbano emite hasta 6× menos CO₂ por pasajero.' },
  { id: 't04', area: 'transport', co2Reduction: 130,  label: 'Voy en bicicleta en lugar de utilizar el coche para mis desplazamientos diarios',  description: 'Cero emisiones y mejor salud.' },
  { id: 't05', area: 'transport', co2Reduction: 560, label: 'Tomo el tren en lugar del coche para mis desplazamientos diarios',                description: 'El tren de cercanías emite hasta 10× menos que el coche.' },
  { id: 't06', area: 'transport', co2Reduction: 2500, label: 'Elijo un vuelo de corta distancia en lugar de uno transoceánico para mis vacaciones', description: 'Voy a Lisboa en vez de Nueva York.' },
  { id: 't07', area: 'transport', co2Reduction: 350, label: 'Comparto coche con tres personas para mis desplazamientos diarios',                       description: 'Ejemplo: Madrid–Bilbao (700 km ida y vuelta).' },

  // VIVIENDA / ENERGÍA
  { id: 'v01', area: 'energy', co2Reduction: 800, label: 'Sustituyo la caldera de gas por una bomba de calor',                            description: 'Además, reduzco mi factura energética.' },
  { id: 'v02', area: 'energy', co2Reduction: 25,  label: 'Sustituyo las bombillas por LED de bajo consumo (10 bombillas)',                description: 'Las LED consumen hasta un 80% menos de energía.' },
  { id: 'v03', area: 'energy', co2Reduction: 47,  label: 'Limito la temperatura en casa a 19,5 °C en invierno',                          description: 'Cada grado menos ahorra un 7% en calefacción.' },
  { id: 'v04', area: 'energy', co2Reduction: 47,  label: 'Cierro ventanas al encender la calefacción',                                   description: 'Evita pérdidas de calor innecesarias.' },
  { id: 'v05', area: 'energy', co2Reduction: 36,  label: 'Utilizo los programas eco de los electrodomésticos',                           description: 'Ahorra agua caliente y electricidad.' },
  { id: 'v06', area: 'energy', co2Reduction: 35,  label: 'Cuelgo la ropa para secar en lugar de usar la secadora',                       description: 'La secadora es uno de los electrodomésticos más consumidores.' },
  { id: 'v07', area: 'energy', co2Reduction: 5,   label: 'Desconecto los dispositivos electrónicos sin uso',                             description: 'El modo standby puede suponer hasta el 10% de la factura.' },

  // ALIMENTACIÓN
  { id: 'a01', area: 'food', co2Reduction: 1400, label: 'Dejo de consumir carne en mis comidas y cenas',                                  description: 'Una de las acciones individuales de mayor impacto.' },
  { id: 'a02', area: 'food', co2Reduction: 150,  label: 'Hago compost en casa',                                                           description: 'Reduce el metano generado por residuos orgánicos en vertederos.' },
  { id: 'a03', area: 'food', co2Reduction: 550,  label: 'Sustituyo la carne roja por carne blanca (2–3 veces por semana)',                description: 'La carne de vacuno emite 6× más que el pollo.' },
  { id: 'a04', area: 'food', co2Reduction: 700,  label: 'Reduzco a 2 comidas por semana el consumo de ternera',                          description: 'Las sustituyo por verduras, frutas y cereales.' },
  { id: 'a05', area: 'food', co2Reduction: 35,   label: 'Compro a granel',                                                                description: 'Reduce el embalaje y el desperdicio alimentario.' },
  { id: 'a06', area: 'food', co2Reduction: 75,   label: 'Consumo alimentos de temporada y locales',                                       description: 'Reduce el transporte y la refrigeración.' },
  { id: 'a07', area: 'food', co2Reduction: 200,  label: 'Participo en iniciativas como "Lunes sin carne"',                               description: 'Un día sin carne a la semana marca la diferencia.' },
  { id: 'a08', area: 'food', co2Reduction: 18,   label: 'Me tomo solo 1 café al día',                                                     description: 'El café tiene una huella hídrica y de carbono significativa.' },
  { id: 'a09', area: 'food', co2Reduction: 35,   label: 'Reemplazo una taza de café por té cada día',                                     description: 'El té emite hasta 4× menos CO₂ que el café.' },
  { id: 'a10', area: 'food', co2Reduction: 250,  label: 'Dejo de beber agua en botella de plástico (uso una botella reutilizable)',       description: 'Elimina la fabricación y transporte de plástico.' },

  // CONSUMO
  { id: 'c01', area: 'consumption', co2Reduction: 280, label: 'Compro electrodomésticos reparados',                                       description: 'Contribuyo a la economía circular.' },
  { id: 'c02', area: 'consumption', co2Reduction: 200, label: 'Compro menos ropa pero de mejor calidad',                                  description: 'La moda rápida genera el 10% de las emisiones globales.' },
  { id: 'c03', area: 'consumption', co2Reduction: 50,  label: 'Compro o intercambio artículos de segunda mano',                           description: 'Alargar la vida de los productos reduce su huella.' },
  { id: 'c04', area: 'consumption', co2Reduction: 480, label: 'Compro y utilizo ropa de segunda mano',                                    description: 'Cada prenda reutilizada ahorra agua, energía y emisiones.' },
  { id: 'c05', area: 'consumption', co2Reduction: 400, label: 'Reparo mi electrodoméstico averiado',                                      description: 'Alargar la vida útil 2 años reduce la huella a la mitad.' },
  { id: 'c06', area: 'consumption', co2Reduction: 80,  label: 'Practico deportes más sostenibles como correr en lugar de golf',            description: 'El golf requiere grandes extensiones de terreno y agua.' },
  { id: 'c07', area: 'consumption', co2Reduction: 15,  label: 'Opto por productos de limpieza ecológicos y biodegradables',                description: 'Menos químicos, menos energía en producción.' },
  { id: 'c08', area: 'consumption', co2Reduction: 30,  label: 'Doy una segunda oportunidad a mi smartphone',                              description: 'La fabricación representa el 80% de la huella de un móvil.' },
  { id: 'c09', area: 'consumption', co2Reduction: 7,   label: 'Dejo de fumar',                                                            description: 'Además de los beneficios para la salud, reduce residuos y emisiones.' },

  // VIDA DIGITAL
  { id: 'd01', area: 'waste', co2Reduction: 15, label: 'Cancelo suscripciones digitales que no uso',                                      description: 'Cada servicio en la nube activo consume energía aunque no lo uses.' },
  { id: 'd02', area: 'waste', co2Reduction: 20, label: 'Veo el streaming en SD en lugar de HD cuando no lo necesito',                     description: 'Reduce el consumo de datos un 80%.' },
  { id: 'd03', area: 'waste', co2Reduction: 15, label: 'Escucho música en streaming de audio en lugar de vídeo',                          description: 'Spotify vs YouTube: el audio consume 10× menos que el vídeo.' },
  { id: 'd04', area: 'waste', co2Reduction: 10, label: 'Uso la IA solo cuando la necesito',                                               description: 'Una consulta de IA consume 10 veces más energía que una búsqueda en Google.' },
  { id: 'd05', area: 'waste', co2Reduction: 20, label: 'Borro lo que no uso en la nube: fotos, archivos y emails',                        description: 'Los servidores nunca descansan — menos datos, menos energía.' },
]