import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

/**
 * Componente que muestra la lista de compra de un usuario
 * basándose en los platos de su menú semanal
 */
const ListaCompra = React.memo(function ListaCompra({ menu, tipoMenu }) {
  const [listaCompra, setListaCompra] = useState({});
  const [loading, setLoading] = useState(false);
  const [seccionesColapsadas, setSeccionesColapsadas] = useState({
    lacteos: true,
    carnes: true,
    pescados: true,
    frutas: true,
    verduras: true,
    legumbres: true,
    cereales: true,
    frutos_secos: true,
    huevos: true,
    aceites: true,
    otros: true
  });
  const [productosComprados, setProductosComprados] = useState({});

  useEffect(() => {
    generarListaCompra();
  }, [menu, tipoMenu]);

  const generarListaCompra = async () => {
    setLoading(true);
    try {
      // Extraer todos los platos del menú
      const platosSet = new Set();
      const categorias = ["desayuno", "almuerzo", "comida", "merienda", "cena"];
      
      // Si es menú tabla (array de 7 días)
      if (Array.isArray(menu)) {
        menu.forEach(dia => {
          if (dia && typeof dia === 'object') {
            categorias.forEach(cat => {
              if (dia[cat]) {
                // Separar por líneas y limpiar
                const platos = dia[cat].split('\n')
                  .map(line => line.replace(/^[•\-*]\s*/, '').trim())
                  .filter(line => {
                    if (!line || line.length === 0) return false;
                    // Filtrar líneas muy cortas que probablemente sean fragmentos
                    if (line.length < 3) return false;
                    // Filtrar si empieza o termina con signos raros
                    if (/^[+\-*.,;:\(\)\[\]{}]/.test(line) || /[+\-*,;:\(\)\[\]{}]$/.test(line)) return false;
                    // Filtrar si solo contiene símbolos y espacios
                    if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]{2,}/.test(line)) return false;
                    return true;
                  });
                platos.forEach(plato => platosSet.add(plato));
              }
            });
          }
        });
      }
      // Si es menú vertical (objeto con arrays)
      else if (typeof menu === 'object' && menu) {
        categorias.forEach(cat => {
          if (menu[cat] && Array.isArray(menu[cat])) {
            menu[cat].forEach(plato => {
              if (plato && plato.trim()) {
                const platoLimpio = plato.trim();
                // Filtrar con las mismas reglas
                if (platoLimpio.length >= 3 && 
                    !/^[+\-*.,;:\(\)\[\]{}]/.test(platoLimpio) &&
                    !/[+\-*,;:\(\)\[\]{}]$/.test(platoLimpio) &&
                    /[a-záéíóúñA-ZÁÉÍÓÚÑ]{2,}/.test(platoLimpio)) {
                  platosSet.add(platoLimpio);
                }
              }
            });
          }
        });
      }

      // Convertir a array y ordenar alfabéticamente
      const platosArray = Array.from(platosSet).sort((a, b) => a.localeCompare(b));
      
      // Agrupar por categoría
      const listaAgrupada = await agruparPorCategoria(platosArray);
      setListaCompra(listaAgrupada);
      
    } catch (err) {
      console.error("Error generando lista de compra:", err);
    } finally {
      setLoading(false);
    }
  };

  // Función para normalizar texto (eliminar acentos, convertir a minúsculas, quitar plurales)
  const normalizarTexto = (texto) => {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/s$/, ''); // Quitar 's' final (plurales simples)
  };

  const agruparPorCategoria = async (platos) => {
    const resultado = {
      lacteos: new Set(),
      carnes: new Set(),
      pescados: new Set(),
      frutas: new Set(),
      verduras: new Set(),
      legumbres: new Set(),
      cereales: new Set(),
      frutos_secos: new Set(),
      huevos: new Set(),
      aceites: new Set(),
      otros: new Set()
    };

    // Palabras clave para clasificar productos con sus nombres normalizados
    // Ahora incluimos sinónimos y variaciones
    const clasificacion = {
      lacteos: [
        { palabras: ['leche'], nombre: 'Leche' },
        { palabras: ['yogur'], nombre: 'Yogur' },
        { palabras: ['queso'], nombre: 'Queso' },
        { palabras: ['kefir'], nombre: 'Kéfir' },
        { palabras: ['nata'], nombre: 'Nata' },
        { palabras: ['mantequilla'], nombre: 'Mantequilla' },
        { palabras: ['requeson'], nombre: 'Requesón' },
        { palabras: ['cuajada'], nombre: 'Cuajada' },
        { palabras: ['batido'], nombre: 'Batido' }
      ],
      carnes: [
        { palabras: ['pollo'], nombre: 'Pollo' },
        { palabras: ['pavo'], nombre: 'Pavo' },
        { palabras: ['ternera'], nombre: 'Ternera' },
        { palabras: ['cerdo'], nombre: 'Cerdo' },
        { palabras: ['cordero'], nombre: 'Cordero' },
        { palabras: ['pechuga'], nombre: 'Pechuga de pollo' },
        { palabras: ['lomo'], nombre: 'Lomo' },
        { palabras: ['jamon'], nombre: 'Jamón' },
        { palabras: ['fiambre'], nombre: 'Fiambre' },
        { palabras: ['salchicha'], nombre: 'Salchicha' },
        { palabras: ['carne'], nombre: 'Carne' }
      ],
      pescados: [
        { palabras: ['salmon'], nombre: 'Salmón' },
        { palabras: ['atun'], nombre: 'Atún' },
        { palabras: ['merluza'], nombre: 'Merluza' },
        { palabras: ['bacalao'], nombre: 'Bacalao' },
        { palabras: ['pescado'], nombre: 'Pescado' },
        { palabras: ['marisco'], nombre: 'Marisco' },
        { palabras: ['gamba'], nombre: 'Gambas' },
        { palabras: ['langostino'], nombre: 'Langostinos' },
        { palabras: ['mejillon'], nombre: 'Mejillones' },
        { palabras: ['calamar'], nombre: 'Calamar' },
        { palabras: ['pulpo'], nombre: 'Pulpo' },
        { palabras: ['caballa'], nombre: 'Caballa' },
        { palabras: ['sardina'], nombre: 'Sardinas' },
        { palabras: ['dorada'], nombre: 'Dorada' },
        { palabras: ['lubina'], nombre: 'Lubina' }
      ],
      frutas: [
        { palabras: ['manzana'], nombre: 'Manzanas' },
        { palabras: ['platano', 'banana'], nombre: 'Plátanos' },
        { palabras: ['naranja'], nombre: 'Naranjas' },
        { palabras: ['pera'], nombre: 'Peras' },
        { palabras: ['fresa'], nombre: 'Fresas' },
        { palabras: ['kiwi'], nombre: 'Kiwis' },
        { palabras: ['uva'], nombre: 'Uvas' },
        { palabras: ['melon'], nombre: 'Melón' },
        { palabras: ['sandia'], nombre: 'Sandía' },
        { palabras: ['pina'], nombre: 'Piña' },
        { palabras: ['melocoton'], nombre: 'Melocotones' },
        { palabras: ['albaricoque'], nombre: 'Albaricoques' },
        { palabras: ['ciruela'], nombre: 'Ciruelas' },
        { palabras: ['cereza'], nombre: 'Cerezas' },
        { palabras: ['frambuesa'], nombre: 'Frambuesas' },
        { palabras: ['arandano'], nombre: 'Arándanos' },
        { palabras: ['mandarina'], nombre: 'Mandarinas' },
        { palabras: ['limon'], nombre: 'Limones' },
        { palabras: ['pomelo'], nombre: 'Pomelos' },
        { palabras: ['mango'], nombre: 'Mango' },
        { palabras: ['papaya'], nombre: 'Papaya' },
        { palabras: ['aguacate'], nombre: 'Aguacate' },
        { palabras: ['coco'], nombre: 'Coco' }
      ],
      verduras: [
        { palabras: ['lechuga'], nombre: 'Lechuga' },
        { palabras: ['tomate'], nombre: 'Tomates' },
        { palabras: ['pepino'], nombre: 'Pepino' },
        { palabras: ['zanahoria'], nombre: 'Zanahorias' },
        { palabras: ['brocoli'], nombre: 'Brócoli' },
        { palabras: ['espinaca'], nombre: 'Espinacas' },
        { palabras: ['acelga'], nombre: 'Acelgas' },
        { palabras: ['calabacin'], nombre: 'Calabacín' },
        { palabras: ['berenjena'], nombre: 'Berenjenas' },
        { palabras: ['pimiento'], nombre: 'Pimientos' },
        { palabras: ['cebolla'], nombre: 'Cebollas' },
        { palabras: ['ajo'], nombre: 'Ajos' },
        { palabras: ['coliflor'], nombre: 'Coliflor' },
        { palabras: ['col'], nombre: 'Col' },
        { palabras: ['esparrago'], nombre: 'Espárragos' },
        { palabras: ['apio'], nombre: 'Apio' },
        { palabras: ['remolacha'], nombre: 'Remolacha' },
        { palabras: ['rabano'], nombre: 'Rábanos' },
        { palabras: ['puerro'], nombre: 'Puerros' },
        { palabras: ['judia verde'], nombre: 'Judías verdes' },
        { palabras: ['guisante'], nombre: 'Guisantes' },
        { palabras: ['alcachofa'], nombre: 'Alcachofas' },
        { palabras: ['champinon', 'seta'], nombre: 'Champiñones/Setas' },
        { palabras: ['cogollo'], nombre: 'Cogollos' },
        { palabras: ['cherry', 'tomate cherry'], nombre: 'Tomates Cherry' },
        { palabras: ['patata'], nombre: 'Patatas' },
        { palabras: ['batata', 'boniato'], nombre: 'Batata/Boniato' }
      ],
      legumbres: [
        { palabras: ['lenteja'], nombre: 'Lentejas' },
        { palabras: ['garbanzo'], nombre: 'Garbanzos' },
        { palabras: ['alubia'], nombre: 'Alubias' },
        { palabras: ['judia'], nombre: 'Judías' },
        { palabras: ['soja'], nombre: 'Soja' },
        { palabras: ['tofu'], nombre: 'Tofu' },
        { palabras: ['hummus'], nombre: 'Hummus' }
      ],
      cereales: [
        { palabras: ['arroz'], nombre: 'Arroz' },
        { palabras: ['pasta'], nombre: 'Pasta' },
        { palabras: ['pan', 'tosta', 'tostada'], nombre: 'Pan/Tostadas' },
        { palabras: ['avena'], nombre: 'Avena' },
        { palabras: ['quinoa'], nombre: 'Quinoa' },
        { palabras: ['trigo'], nombre: 'Trigo' },
        { palabras: ['centeno'], nombre: 'Centeno' },
        { palabras: ['cebada'], nombre: 'Cebada' },
        { palabras: ['maiz'], nombre: 'Maíz' },
        { palabras: ['cereal'], nombre: 'Cereales' },
        { palabras: ['tortita'], nombre: 'Tortitas' },
        { palabras: ['integral'], nombre: 'Pan integral' },
        { palabras: ['muesli'], nombre: 'Muesli' },
        { palabras: ['granola'], nombre: 'Granola' }
      ],
      frutos_secos: [
        { palabras: ['almendra'], nombre: 'Almendras' },
        { palabras: ['nuez', 'nuece'], nombre: 'Nueces' },
        { palabras: ['avellana'], nombre: 'Avellanas' },
        { palabras: ['pistacho'], nombre: 'Pistachos' },
        { palabras: ['anacardo'], nombre: 'Anacardos' },
        { palabras: ['cacahuete'], nombre: 'Cacahuetes' },
        { palabras: ['castana'], nombre: 'Castañas' },
        { palabras: ['pinon'], nombre: 'Piñones' },
        { palabras: ['crema de cacahuete'], nombre: 'Crema de cacahuete' },
        { palabras: ['mantequilla de almendra'], nombre: 'Mantequilla de almendra' }
      ],
      huevos: [
        { palabras: ['huevo'], nombre: 'Huevos' },
        { palabras: ['clara'], nombre: 'Claras de huevo' },
        { palabras: ['yema'], nombre: 'Yemas de huevo' },
        { palabras: ['tortilla'], nombre: 'Huevos (tortilla)' }
      ],
      aceites: [
        { palabras: ['aceite'], nombre: 'Aceite' },
        { palabras: ['oliva'], nombre: 'Aceite de oliva' },
        { palabras: ['girasol'], nombre: 'Aceite de girasol' },
        { palabras: ['vinagre'], nombre: 'Vinagre' },
        { palabras: ['salsa'], nombre: 'Salsa' },
        { palabras: ['especia'], nombre: 'Especias' },
        { palabras: ['sal'], nombre: 'Sal' },
        { palabras: ['pimienta'], nombre: 'Pimienta' },
        { palabras: ['oregano'], nombre: 'Orégano' },
        { palabras: ['curcuma'], nombre: 'Cúrcuma' },
        { palabras: ['jengibre'], nombre: 'Jengibre' },
        { palabras: ['chia'], nombre: 'Semillas de chía' },
        { palabras: ['lino'], nombre: 'Semillas de lino' },
        { palabras: ['sesamo'], nombre: 'Semillas de sésamo' },
        { palabras: ['miel'], nombre: 'Miel' }
      ]
    };

    // Procesar cada plato
    platos.forEach(plato => {
      const platoNormalizado = normalizarTexto(plato);
      let encontrado = false;
      
      // Buscar en cada categoría
      Object.entries(clasificacion).forEach(([categoria, items]) => {
        items.forEach(item => {
          // Verificar si alguna de las palabras clave está en el plato (normalizadas)
          const match = item.palabras.some(palabra => {
            const palabraNormalizada = normalizarTexto(palabra);
            return platoNormalizado.includes(palabraNormalizada);
          });
          
          if (match && !encontrado) {
            resultado[categoria].add(item.nombre);
            encontrado = true;
          }
        });
      });
      
      // Si no se clasificó, verificar si es un ingrediente válido antes de añadir a "otros"
      if (!encontrado) {
        // Validaciones para asegurar que es un ingrediente válido
        const esValido = validarIngrediente(plato);
        if (esValido) {
          resultado.otros.add(plato);
        }
      }
    });

    // Convertir Sets a arrays ordenados
    const resultadoFinal = {};
    Object.keys(resultado).forEach(categoria => {
      resultadoFinal[categoria] = Array.from(resultado[categoria]).sort((a, b) => 
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );
    });

    return resultadoFinal;
  };

  // Función para validar si un texto es un ingrediente válido
  const validarIngrediente = (texto) => {
    // Longitud mínima
    if (texto.length < 4) return false;
    
    // Debe contener al menos una palabra completa (3+ letras consecutivas)
    if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]{3,}/.test(texto)) return false;
    
    // No debe empezar o terminar con símbolos raros
    if (/^[+\-*.,;:\(\)\[\]{}]/.test(texto) || /[+\-*,;:\(\)\[\]{}]$/.test(texto)) return false;
    
    // No debe contener muchos símbolos (más del 20% del texto)
    const simbolos = (texto.match(/[^a-záéíóúñA-ZÁÉÍÓÚÑ\s]/g) || []).length;
    if (simbolos / texto.length > 0.2) return false;
    
    // No debe ser una frase muy larga (probablemente es descripción de plato completo)
    const palabras = texto.split(/\s+/).length;
    if (palabras > 6) return false;
    
    // No debe contener palabras que indican que es un plato preparado completo
    const patronesPlatos = [
      /^ensalada completa/i,
      /^plato completo/i,
      /con salsa de/i,
      /acompañado de/i,
      /al horno con/i,
      /a la plancha con/i,
      /salteado con/i,
      /en salsa/i
    ];
    if (patronesPlatos.some(patron => patron.test(texto))) return false;
    
    // No debe contener palabras clave que indican preparación completa
    const palabrasExcluir = [
      'completa con', 
      'acompañado', 
      'junto con',
      'batido juntos',
      'todo junto',
      'mezclado con'
    ];
    const textoLower = texto.toLowerCase();
    if (palabrasExcluir.some(palabra => textoLower.includes(palabra))) return false;
    
    // Debe ser un nombre sustantivo (generalmente ingredientes son sustantivos)
    // Rechazar si empieza con preposiciones o conectores
    const iniciosInvalidos = /^(con|de|para|sin|y|o|el|la|los|las|un|una|unos|unas)\s/i;
    if (iniciosInvalidos.test(texto)) return false;
    
    return true;
  };

  const imprimirLista = () => {
    window.print();
  };

  const desmarcarTodo = () => {
    setProductosComprados({});
  };

  const toggleProducto = (categoria, plato) => {
    const key = `${categoria}_${plato}`;
    setProductosComprados(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const categoriaLabels = {
    lacteos: "🥛 Lácteos",
    carnes: "🍖 Carnes",
    pescados: "🐟 Pescados y Mariscos",
    frutas: "🍎 Frutas",
    verduras: "🥬 Verduras y Hortalizas",
    legumbres: "🫘 Legumbres",
    cereales: "🌾 Cereales y Panes",
    frutos_secos: "🥜 Frutos Secos",
    huevos: "🥚 Huevos",
    aceites: "🫒 Aceites y Condimentos",
    otros: "📝 Otros"
  };

  const categoriasConPlatos = Object.entries(listaCompra).filter(([_, platos]) => platos.length > 0);
  const totalPlatos = categoriasConPlatos.reduce((sum, [_, platos]) => sum + platos.length, 0);

  if (loading) {
    return (
      <div style={{
        padding: "40px",
        textAlign: "center",
        color: "#64748b"
      }}>
        <p style={{ fontSize: "16px", margin: 0 }}>⏳ Generando tu lista de compra...</p>
      </div>
    );
  }

  if (totalPlatos === 0) {
    return (
      <div style={{
        padding: "40px",
        textAlign: "center",
        background: "#fef3c7",
        borderRadius: "8px",
        border: "2px solid #fbbf24",
        margin: "20px"
      }}>
        <p style={{ fontSize: "16px", margin: 0, color: "#92400e" }}>
          ⚠️ No tienes menú asignado todavía
        </p>
      </div>
    );
  }

  return (
    <div className="lista-compra-container" style={{ padding: "20px" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <h2 style={{ 
            margin: "0 0 4px 0", 
            fontSize: "22px", 
            fontWeight: "700",
            color: "#15803d"
          }}>
            🛒 Mi Lista de la Compra
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            {totalPlatos} alimento{totalPlatos !== 1 ? 's' : ''} en {categoriasConPlatos.length} categoría{categoriasConPlatos.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="no-print" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={desmarcarTodo}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#64748b",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            ✓ Desmarcar todo
          </button>
          <button
            onClick={imprimirLista}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#3b82f6",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {Object.entries(listaCompra).map(([categoria, platos]) => {
          // No mostrar categorías vacías
          if (platos.length === 0) return null;
          
          const isCollapsed = seccionesColapsadas[categoria];
          
          return (
            <div key={categoria} style={{
              background: "#f8fafc",
              borderRadius: "8px",
              padding: "16px",
              border: "1px solid #e2e8f0"
            }}>
              <div 
                onClick={() => setSeccionesColapsadas(prev => ({ 
                  ...prev, 
                  [categoria]: !prev[categoria] 
                }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  marginBottom: isCollapsed ? "0" : "12px",
                  paddingBottom: isCollapsed ? "0" : "8px",
                  borderBottom: isCollapsed ? "none" : "2px solid #e2e8f0"
                }}
              >
                <h3 style={{
                  margin: "0",
                  fontSize: "17px",
                  fontWeight: "700",
                  color: "#1e293b"
                }}>
                  {categoriaLabels[categoria] || categoria}
                  <span style={{ 
                    marginLeft: "8px", 
                    fontSize: "14px", 
                    color: "#64748b",
                    fontWeight: "500"
                  }}>
                    ({platos.length})
                  </span>
                </h3>
                <span style={{
                  fontSize: "20px",
                  color: "#64748b",
                  transition: "transform 0.2s",
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)"
                }}>
                  ▼
                </span>
              </div>
              
              {/* Mensaje informativo para la categoría "Otros" */}
              {categoria === 'otros' && !isCollapsed && platos.length > 0 && (
                <div style={{
                  padding: "8px 12px",
                  background: "#fef3c7",
                  borderRadius: "4px",
                  marginBottom: "10px",
                  fontSize: "12px",
                  color: "#92400e",
                  border: "1px solid #fbbf24"
                }}>
                  ℹ️ Ingredientes que no se han podido clasificar automáticamente
                </div>
              )}
              
              {!isCollapsed && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  {platos.map((plato, idx) => {
                    const key = `${categoria}_${plato}`;
                    const isChecked = productosComprados[key];
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleProducto(categoria, plato)}
                        style={{
                          padding: "8px 12px",
                          background: "white",
                          borderRadius: "4px",
                          fontSize: "15px",
                          color: isChecked ? "#94a3b8" : "#334155",
                          border: "1px solid #e2e8f0",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          textDecoration: isChecked ? "line-through" : "none",
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{
                          width: "20px",
                          height: "20px",
                          border: `2px solid ${isChecked ? "#16a34a" : "#d1d5db"}`,
                          borderRadius: "4px",
                          background: isChecked ? "#16a34a" : "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 0.2s"
                        }}>
                          {isChecked && (
                            <span style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>✓</span>
                          )}
                        </div>
                        <span>{plato}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mensaje informativo sobre el filtrado */}
      <div className="no-print" style={{
        marginTop: "20px",
        padding: "12px 16px",
        background: "#f0f9ff",
        borderRadius: "6px",
        border: "1px solid #bae6fd",
        fontSize: "13px",
        color: "#075985",
        lineHeight: "1.6"
      }}>
        <strong>💡 Información:</strong> Esta lista muestra únicamente ingredientes individuales extraídos de tu menú. 
        Los platos completos o descripciones no se incluyen para mantener la lista clara y profesional.
      </div>

      {/* Estilos para impresión */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          .lista-compra-container {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
});

export default ListaCompra;
